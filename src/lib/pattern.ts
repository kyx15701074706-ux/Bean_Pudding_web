import { labDistanceSquared, rgbToLab } from './color'
import { getPalette, palette } from './palette'
import type { BeadColor, ColorUsage, PaletteId, Pattern, RGB } from './types'

export const EMPTY_CELL = 255

export function validateDimension(value: number): number {
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new Error('横向和纵向豆数需为正整数')
  }
  return value
}

export function fitDimensions(value: number, ratio: number, axis: 'width' | 'height'): { width: number; height: number } {
  validateDimension(value)
  if (!Number.isFinite(ratio) || ratio <= 0) throw new Error('图片比例无效')
  const width = axis === 'width' ? value : Math.max(1, Math.round(value * ratio))
  const height = axis === 'height' ? value : Math.max(1, Math.round(value / ratio))
  validateDimension(width)
  validateDimension(height)
  return { width, height }
}

export function nearestColor(rgb: RGB, colors: readonly BeadColor[] = palette): BeadColor {
  if (colors.length === 0) throw new Error('色表不能为空')
  const lab = rgbToLab(rgb)
  let nearest = colors[0]
  let distance = Infinity
  for (const color of colors) {
    const candidate = labDistanceSquared(lab, color.lab)
    if (candidate < distance) {
      nearest = color
      distance = candidate
    }
  }
  return nearest
}

export function createPixelMatcher(colors: readonly BeadColor[] = palette) {
  const cache = new Map<number, number>()
  return (data: Uint8ClampedArray): Uint8Array => {
    const cells = new Uint8Array(data.length / 4)
    for (let offset = 0; offset < data.length; offset += 4) {
    // Less than 50% coverage is an empty bead; partial coverage is composited on white.
    const alpha = data[offset + 3] / 255
    if (alpha < 0.5) {
      cells[offset / 4] = EMPTY_CELL
      continue
    }
    const composite = (channel: number) => Math.round(data[offset + channel] * alpha + 255 * (1 - alpha))
    const rgb: RGB = [composite(0), composite(1), composite(2)]
    const key = (rgb[0] << 16) | (rgb[1] << 8) | rgb[2]
    let color = cache.get(key)
    if (color === undefined) {
      color = colors.indexOf(nearestColor(rgb, colors))
      if (cache.size >= 65536) cache.clear()
      cache.set(key, color)
    }
    cells[offset / 4] = color
    }
    return cells
  }
}

export function validateGrid(width: number, height: number): number {
  validateDimension(width)
  validateDimension(height)
  const size = width * height
  if (!Number.isSafeInteger(size)) throw new Error('图纸总格数超出可准确计算的范围，请减小尺寸。')
  return size
}

export function matchPixels(data: Uint8ClampedArray, width: number, height: number, paletteId: PaletteId = '221'): Pattern {
  const size = validateGrid(width, height)
  if (data.length !== size * 4) throw new Error('图片像素数据与网格尺寸不一致')
  return { width, height, paletteId, cells: createPixelMatcher(getPalette(paletteId).colors)(data) }
}

export function getCell(pattern: Pattern, index: number): BeadColor | null {
  return getPalette(pattern.paletteId).colors[pattern.cells[index]] ?? null
}

export function getUsage(pattern: Pattern): ColorUsage[] {
  const colors = getPalette(pattern.paletteId).colors
  const counts = new Float64Array(colors.length)
  for (const index of pattern.cells) if (index !== EMPTY_CELL) counts[index]++
  return colors.flatMap((color, index) => counts[index] ? [{ color, count: counts[index] }] : [])
    .sort((a, b) => b.count - a.count || a.color.code.localeCompare(b.color.code, 'en', { numeric: true }))
}
