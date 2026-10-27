import { beforeEach, describe, expect, it, vi } from 'vitest'
import { strFromU8, unzipSync } from 'fflate'
import { createPatternDownload } from './export'
import type { Pattern } from './types'

const renderer = vi.hoisted(() => ({ createExportCanvas: vi.fn(), drawOverview: vi.fn() }))
vi.mock('./render', () => renderer)

function canvas(toBlob?: (callback: BlobCallback) => void): HTMLCanvasElement {
  return {
    width: 1980,
    toBlob: toBlob ?? (callback => callback(new Blob([new Uint8Array([137, 80, 78, 71])], { type: 'image/png' }))),
  } as HTMLCanvasElement
}

const pattern: Pattern = { paletteId: '221', width: 128, height: 128, cells: new Uint8Array(128 * 128) }

beforeEach(() => {
  vi.clearAllMocks()
  renderer.createExportCanvas.mockImplementation(() => canvas())
  vi.stubGlobal('document', { createElement: () => canvas() })
})

describe('整张PNG与可选分区导出', () => {
  it('超过64格的大图默认返回单个PNG，不按尺寸自动拆分', async () => {
    const result = await createPatternDownload(pattern, '人像.png')
    expect(result.name).toBe('人像-128x128-拼豆图纸.png')
    expect(result.blob.type).toBe('image/png')
    expect(renderer.createExportCanvas).toHaveBeenCalledTimes(1)
    expect(renderer.createExportCanvas).toHaveBeenCalledWith(pattern, '人像.png')
  })

  it('只有明确选择分区时才返回ZIP，包含所有分区与整图统计', async () => {
    const result = await createPatternDownload(pattern, '人像.png', { format: 'tiles' })
    expect(result.name).toBe('人像-128x128-分区图纸.zip')
    expect(result.blob.type).toBe('application/zip')
    const entries = unzipSync(new Uint8Array(await result.blob.arrayBuffer()))
    expect(Object.keys(entries).filter(path => path.startsWith('pages/')).sort()).toEqual([
      'pages/row-1-col-1.png', 'pages/row-1-col-2.png', 'pages/row-2-col-1.png', 'pages/row-2-col-2.png',
    ])
    expect(strFromU8(entries['usage.csv'])).toContain('A1,#FCFBDD,16384')
  })

  it('整图绘制失败时提示分区，不擅自改为多个文件', async () => {
    renderer.createExportCanvas.mockImplementation(() => { throw new Error('Canvas allocation failed') })
    await expect(createPatternDownload(pattern, '人像.png')).rejects.toThrow('请点击“分区导出”')
    expect(renderer.createExportCanvas).toHaveBeenCalledTimes(1)
  })

  it('88色分区清单保留X系列编号，并在说明中标记实际色卡', async () => {
    const selected: Pattern = { paletteId: '88', width: 65, height: 1, cells: new Uint8Array(65) }
    const result = await createPatternDownload(selected, '色卡.png', { format: 'tiles' })
    const entries = unzipSync(new Uint8Array(await result.blob.arrayBuffer()))
    expect(strFromU8(entries['usage.csv'])).toContain('X1,#DF3442,65')
    expect(strFromU8(entries['usage.csv'])).not.toContain('A1,')
    expect(strFromU8(entries['README.txt'])).toContain('88色拼豆色卡')
  })

  it('PNG编码失败时同样提示分区', async () => {
    renderer.createExportCanvas.mockImplementation(() => canvas(callback => callback(null)))
    await expect(createPatternDownload(pattern, '人像.png')).rejects.toThrow('请点击“分区导出”')
  })

  it('取消编码保留AbortError，不误报为画布容量不足', async () => {
    const controller = new AbortController()
    renderer.createExportCanvas.mockImplementation(() => canvas(callback => {
      controller.abort()
      callback(new Blob())
    }))
    await expect(createPatternDownload(pattern, '人像.png', { signal: controller.signal })).rejects.toMatchObject({ name: 'AbortError' })
  })
})
