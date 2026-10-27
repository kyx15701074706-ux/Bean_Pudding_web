import { describe, expect, it } from 'vitest'
import { DEFAULT_DETAIL, enhanceTile } from './enhance'
import { regions, pageCount, regionAt, throwIfAborted } from './tiles'
import { overviewSize } from './render'

describe('细节增强', () => {
  const source = new Uint8ClampedArray(8 * 4 * 4)
  for (let i = 0; i < 32; i++) source.set([60 + i % 8 * 20, 70 + i % 8 * 18, 80 + i % 8 * 16, i % 8 === 0 ? 0 : 255], i * 4)
  function halo(x: number, y: number, width: number, height: number) {
    const pixels = new Uint8ClampedArray((width + 2) * (height + 2) * 4)
    for (let row = -1; row <= height; row++) for (let col = -1; col <= width; col++) {
      const sx = Math.max(0, Math.min(7, x + col))
      const sy = Math.max(0, Math.min(3, y + row))
      pixels.set(source.subarray((sy * 8 + sx) * 4, (sy * 8 + sx) * 4 + 4), ((row + 1) * (width + 2) + col + 1) * 4)
    }
    return pixels
  }

  it('标准模式及零增强完整保留RGB和透明度', () => {
    expect(enhanceTile(halo(0, 0, 8, 4), 8, 4, { ...DEFAULT_DETAIL, mode: 'standard' })).toEqual(source)
    expect(enhanceTile(halo(0, 0, 8, 4), 8, 4, { mode: 'detail', sharpness: 0, contrast: 0 })).toEqual(source)
  })

  it('增强改变明暗细节但保留透明度', () => {
    const enhanced = enhanceTile(halo(0, 0, 8, 4), 8, 4, DEFAULT_DETAIL)
    expect(enhanced).not.toEqual(source)
    for (let i = 3; i < source.length; i += 4) expect(enhanced[i]).toBe(source[i])
  })

  it('分块增强与整图增强逐像素一致，不产生接缝', () => {
    const full = enhanceTile(halo(0, 0, 8, 4), 8, 4, DEFAULT_DETAIL)
    const combined = new Uint8ClampedArray(source.length)
    for (let x = 0; x < 8; x += 4) {
      const tile = enhanceTile(halo(x, 0, 4, 4), 4, 4, DEFAULT_DETAIL)
      for (let y = 0; y < 4; y++) combined.set(tile.subarray(y * 16, (y + 1) * 16), (y * 8 + x) * 4)
    }
    expect(combined).toEqual(full)
  })
})

describe('大图分区', () => {
  it('不规则边界分区覆盖每格且不重叠', () => {
    const coverage = new Uint8Array(129 * 67)
    const pages = [...regions(129, 67)]
    expect(pageCount(129, 67)).toBe(6)
    expect(pages.at(-1)).toEqual({ x: 128, y: 64, width: 1, height: 3 })
    for (const tile of pages) for (let y = 0; y < tile.height; y++) for (let x = 0; x < tile.width; x++) coverage[(tile.y + y) * 129 + tile.x + x]++
    expect(coverage.every(count => count === 1)).toBe(true)
    expect(regionAt(129, 67, 2, 1)).toEqual(pages.at(-1))
  })

  it('总览画布保持有界，图纸本身没有固定豆数上限', () => {
    expect(overviewSize({ paletteId: '221', width: 100000, height: 50000, cells: new Uint8Array() })).toEqual({ width: 1024, height: 512 })
    expect(pageCount(100000, 1)).toBe(1563)
  })

  it('取消请求被识别为AbortError', () => {
    const controller = new AbortController()
    controller.abort()
    expect(() => throwIfAborted(controller.signal)).toThrowError(expect.objectContaining({ name: 'AbortError' }))
  })
})
