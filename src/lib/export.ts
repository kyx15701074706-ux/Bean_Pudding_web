import { Zip, ZipPassThrough, strToU8 } from 'fflate'
import { getUsage } from './pattern'
import { getPalette } from './palette'
import { createExportCanvas, drawOverview } from './render'
import { PAGE_SIZE, pageCount, regions, throwIfAborted, yieldToBrowser } from './tiles'
import type { Pattern, ProcessingOptions } from './types'

export interface ExportOptions extends ProcessingOptions {
  format?: 'png' | 'tiles'
}

export function usageCsv(pattern: Pattern): string {
  const lines = ['豆色编号,HEX,用量（颗）', ...getUsage(pattern).map(({ color, count }) => `${color.code},${color.hex},${count}`)]
  return '\uFEFF' + lines.join('\r\n') + '\r\n'
}

function download(blob: Blob, name: string): void {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = name
  anchor.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

function filename(name: string): string {
  return name.replace(/\.[^.]+$/, '').replace(/[\\/:*?"<>|]/g, '_') || '拼豆图纸'
}

async function pngBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  try {
    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(value => value ? resolve(value) : reject(new Error('PNG导出失败，请重试。')), 'image/png')
    })
  } finally { canvas.width = 1 }
}

export async function createPatternDownload(pattern: Pattern, name: string, options: ExportOptions = {}): Promise<{ blob: Blob; name: string }> {
  throwIfAborted(options.signal)
  const base = `${filename(name)}-${pattern.width}x${pattern.height}`
  if (options.format !== 'tiles') {
    await yieldToBrowser()
    throwIfAborted(options.signal)
    options.onProgress?.(0)
    let blob: Blob
    try {
      blob = await pngBlob(createExportCanvas(pattern, name))
    } catch {
      throwIfAborted(options.signal)
      throw new Error('整张PNG未能生成，可能超出当前浏览器的画布或内存容量。请点击“分区导出”保存图纸。')
    }
    throwIfAborted(options.signal)
    options.onProgress?.(100)
    return { blob, name: `${base}-拼豆图纸.png` }
  }
  const parts: ArrayBuffer[] = []
  let zipError: Error | null = null
  const zip = new Zip((error, data) => {
    if (error) zipError = error
    else parts.push(new Uint8Array(data).buffer)
  })
  function add(path: string, data: Uint8Array) {
    const entry = new ZipPassThrough(path)
    zip.add(entry)
    entry.push(data, true)
    if (zipError) throw zipError
  }
  try {
    const usage = getUsage(pattern)
    const total = pageCount(pattern.width, pattern.height)
    let completed = 0
    options.onProgress?.(0)
    for (const region of regions(pattern.width, pattern.height)) {
      await yieldToBrowser()
      throwIfAborted(options.signal)
      const blob = await pngBlob(createExportCanvas(pattern, name, region, usage))
      throwIfAborted(options.signal)
      const row = Math.floor(region.y / PAGE_SIZE) + 1
      const col = Math.floor(region.x / PAGE_SIZE) + 1
      add(`pages/row-${row}-col-${col}.png`, new Uint8Array(await blob.arrayBuffer()))
      options.onProgress?.(Math.round(++completed / total * 100))
    }
    throwIfAborted(options.signal)
    const overview = document.createElement('canvas')
    drawOverview(overview, pattern)
    add('overview.png', new Uint8Array(await (await pngBlob(overview)).arrayBuffer()))
    add('usage.csv', strToU8(usageCsv(pattern)))
    add('README.txt', strToU8(`豆格分区图纸\n色卡：${getPalette(pattern.paletteId).label}\n尺寸：${pattern.width}列 × ${pattern.height}行\n共${total}页，每页最多${PAGE_SIZE}×${PAGE_SIZE}格。\n按row（分区行）和col（分区列）拼接，无重复或遗漏格。\n每页坐标为全图坐标。每页图例和usage.csv均为整张图纸用量，勿重复累加。\noverview.png用于查看整体效果，编号见pages目录。\n`))
    throwIfAborted(options.signal)
    zip.end()
    if (zipError) throw zipError
    return { blob: new Blob(parts, { type: 'application/zip' }), name: `${base}-分区图纸.zip` }
  } finally { zip.terminate() }
}

export async function exportPng(pattern: Pattern, name: string, options: ExportOptions = {}): Promise<void> {
  const result = await createPatternDownload(pattern, name, options)
  throwIfAborted(options.signal)
  download(result.blob, result.name)
}

export function exportCsv(pattern: Pattern, name: string): void {
  download(new Blob([usageCsv(pattern)], { type: 'text/csv;charset=utf-8' }), `${filename(name)}-豆色用量.csv`)
}
