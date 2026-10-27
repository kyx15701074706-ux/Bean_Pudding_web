import { enhanceTile } from './enhance'
import { createPixelMatcher, validateGrid } from './pattern'
import { getPalette } from './palette'
import { MATCH_TILE_SIZE, regions, throwIfAborted, yieldToBrowser } from './tiles'
import type { DetailOptions, MatchRequest, PaletteId, Pattern, PatternRegion, ProcessingOptions, SourceImage } from './types'

export async function loadImage(url: string, name: string): Promise<SourceImage> {
  const image = new Image()
  image.src = url
  try {
    await image.decode()
  } catch {
    throw new Error('图片无法读取，请选择有效的PNG、JPG或WebP图片。')
  }
  return { image, url, name }
}

function sampleTile(image: HTMLImageElement, width: number, height: number, region: PatternRegion, detail: DetailOptions): Uint8ClampedArray {
  const factor = detail.mode === 'detail' && (image.naturalWidth > width * 2 || image.naturalHeight > height * 2) ? 2 : 1
  const canvas = document.createElement('canvas')
  canvas.width = (region.width + 2) * factor
  canvas.height = (region.height + 2) * factor
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) throw new Error('当前浏览器无法处理图片，请使用支持Canvas的浏览器。')
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(image, (1 - region.x) * factor, (1 - region.y) * factor, width * factor, height * factor)
  let sampled = canvas
  if (factor > 1) {
    sampled = document.createElement('canvas')
    sampled.width = region.width + 2
    sampled.height = region.height + 2
    const downscale = sampled.getContext('2d', { willReadFrequently: true })
    if (!downscale) throw new Error('图片缩放失败')
    downscale.imageSmoothingQuality = 'high'
    downscale.drawImage(canvas, 0, 0, sampled.width, sampled.height)
  }
  const data = sampled.getContext('2d')!.getImageData(0, 0, region.width + 2, region.height + 2).data
  const enhanced = enhanceTile(data, region.width, region.height, detail)
  canvas.width = 1
  sampled.width = 1
  return enhanced
}

function workerMatch(worker: Worker, data: Uint8ClampedArray, paletteId: PaletteId, signal?: AbortSignal): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    const cleanup = () => signal?.removeEventListener('abort', abort)
    const abort = () => { cleanup(); reject(new DOMException('操作已取消', 'AbortError')) }
    worker.onmessage = (event: MessageEvent<Uint8Array>) => { cleanup(); resolve(event.data) }
    worker.onerror = () => { cleanup(); reject(new Error('配色线程运行失败，请重新生成。')) }
    signal?.addEventListener('abort', abort, { once: true })
    if (signal?.aborted) { abort(); return }
    worker.postMessage({ pixels: data, paletteId } satisfies MatchRequest, [data.buffer])
  })
}

export async function imageToPattern(image: HTMLImageElement, width: number, height: number, detail: DetailOptions, options: ProcessingOptions & { paletteId?: PaletteId } = {}): Promise<Pattern> {
  const size = validateGrid(width, height)
  throwIfAborted(options.signal)
  const selected = getPalette(options.paletteId)
  let cells: Uint8Array
  try { cells = new Uint8Array(size) } catch { throw new Error('当前设备无法分配这张图纸所需的内存，请减小尺寸。') }
  const worker = typeof Worker !== 'undefined' ? new Worker(new URL('../workers/match.worker.ts', import.meta.url), { type: 'module' }) : null
  const fallback = worker ? null : createPixelMatcher(selected.colors)
  let completed = 0
  options.onProgress?.(0)
  try {
    for (const region of regions(width, height, MATCH_TILE_SIZE)) {
      await yieldToBrowser()
      throwIfAborted(options.signal)
      const pixels = sampleTile(image, width, height, region, detail)
      const matched = worker ? await workerMatch(worker, pixels, selected.id, options.signal) : fallback!(pixels)
      throwIfAborted(options.signal)
      for (let y = 0; y < region.height; y++) cells.set(matched.subarray(y * region.width, (y + 1) * region.width), (region.y + y) * width + region.x)
      completed += region.width * region.height
      options.onProgress?.(Math.round(completed / size * 100))
    }
    return { width, height, cells, paletteId: selected.id }
  } finally { worker?.terminate() }
}
