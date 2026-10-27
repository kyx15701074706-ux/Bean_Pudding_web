import type { PatternRegion } from './types'

export const PAGE_SIZE = 64
export const MATCH_TILE_SIZE = 128

export function regionAt(width: number, height: number, column: number, row: number, size = PAGE_SIZE): PatternRegion {
  const x = column * size
  const y = row * size
  return { x, y, width: Math.min(size, width - x), height: Math.min(size, height - y) }
}

export function* regions(width: number, height: number, size = PAGE_SIZE): Generator<PatternRegion> {
  for (let row = 0; row < Math.ceil(height / size); row++) {
    for (let col = 0; col < Math.ceil(width / size); col++) yield regionAt(width, height, col, row, size)
  }
}

export function pageCount(width: number, height: number): number {
  return Math.ceil(width / PAGE_SIZE) * Math.ceil(height / PAGE_SIZE)
}

export function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) throw new DOMException('操作已取消', 'AbortError')
}

export function yieldToBrowser(): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, 0))
}
