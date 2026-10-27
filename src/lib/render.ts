import { textColor } from './color'
import { getCell, getUsage } from './pattern'
import { getPalette } from './palette'
import type { ColorUsage, Pattern, PatternRegion } from './types'

export const CELL_SIZE = 30
export const AXIS_SIZE = 30

export interface RenderOptions {
  numbers?: boolean
  grid?: boolean
  region?: PatternRegion
  offset?: { x: number; y: number }
}

export function drawPattern(canvas: HTMLCanvasElement, pattern: Pattern, options: RenderOptions = {}): void {
  const { numbers = true, grid = true, region = { x: 0, y: 0, width: pattern.width, height: pattern.height } } = options
  const chartWidth = region.width * CELL_SIZE + AXIS_SIZE * 2
  const chartHeight = region.height * CELL_SIZE + AXIS_SIZE * 2
  if (!options.offset) {
    canvas.width = chartWidth
    canvas.height = chartHeight
  }
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('无法绘制图纸')
  ctx.save()
  ctx.translate(options.offset?.x ?? 0, options.offset?.y ?? 0)
  ctx.fillStyle = '#FFFFFF'
  ctx.fillRect(0, 0, chartWidth, chartHeight)
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.font = '10px system-ui, sans-serif'
  ctx.fillStyle = '#78716C'
  for (let x = 0; x < region.width; x++) {
    const center = AXIS_SIZE + x * CELL_SIZE + CELL_SIZE / 2
    ctx.fillText(String(region.x + x + 1), center, AXIS_SIZE / 2, CELL_SIZE - 2)
    ctx.fillText(String(region.x + x + 1), center, chartHeight - AXIS_SIZE / 2, CELL_SIZE - 2)
  }
  for (let y = 0; y < region.height; y++) {
    const center = AXIS_SIZE + y * CELL_SIZE + CELL_SIZE / 2
    ctx.fillText(String(region.y + y + 1), AXIS_SIZE / 2, center, AXIS_SIZE - 2)
    ctx.fillText(String(region.y + y + 1), chartWidth - AXIS_SIZE / 2, center, AXIS_SIZE - 2)
  }
  for (let index = 0; index < region.width * region.height; index++) {
    const localX = index % region.width
    const localY = Math.floor(index / region.width)
    const color = getCell(pattern, (region.y + localY) * pattern.width + region.x + localX)
    const x = AXIS_SIZE + localX * CELL_SIZE
    const y = AXIS_SIZE + localY * CELL_SIZE
    ctx.fillStyle = color?.hex ?? '#FAFAF9'
    ctx.fillRect(x, y, CELL_SIZE, CELL_SIZE)
    if (!color) {
      ctx.fillStyle = '#F0EFED'
      ctx.fillRect(x, y, CELL_SIZE / 2, CELL_SIZE / 2)
      ctx.fillRect(x + CELL_SIZE / 2, y + CELL_SIZE / 2, CELL_SIZE / 2, CELL_SIZE / 2)
    }
    if (color && numbers) {
      ctx.fillStyle = textColor(color.rgb)
      ctx.font = '600 10px system-ui, sans-serif'
      ctx.fillText(color.code, x + CELL_SIZE / 2, y + CELL_SIZE / 2)
    }
  }
  if (grid) {
    for (let x = 0; x <= region.width; x++) {
      ctx.beginPath()
      ctx.lineWidth = (region.x + x) % 5 === 0 ? 1.2 : 0.5
      ctx.strokeStyle = (region.x + x) % 5 === 0 ? '#78716C' : '#A8A29E'
      ctx.moveTo(AXIS_SIZE + x * CELL_SIZE, AXIS_SIZE)
      ctx.lineTo(AXIS_SIZE + x * CELL_SIZE, chartHeight - AXIS_SIZE)
      ctx.stroke()
    }
    for (let y = 0; y <= region.height; y++) {
      ctx.beginPath()
      ctx.lineWidth = (region.y + y) % 5 === 0 ? 1.2 : 0.5
      ctx.strokeStyle = (region.y + y) % 5 === 0 ? '#78716C' : '#A8A29E'
      ctx.moveTo(AXIS_SIZE, AXIS_SIZE + y * CELL_SIZE)
      ctx.lineTo(chartWidth - AXIS_SIZE, AXIS_SIZE + y * CELL_SIZE)
      ctx.stroke()
    }
  }
  ctx.restore()
}

export function createExportCanvas(pattern: Pattern, name: string, region?: PatternRegion, usage: readonly ColorUsage[] = getUsage(pattern)): HTMLCanvasElement {
  const chartWidth = (region?.width ?? pattern.width) * CELL_SIZE + AXIS_SIZE * 2
  const chartHeight = (region?.height ?? pattern.height) * CELL_SIZE + AXIS_SIZE * 2
  const columns = Math.max(1, Math.floor(Math.max(chartWidth, 720) / 180))
  const headerHeight = region ? 126 : 100
  const footerHeight = 90 + Math.ceil(usage.length / columns) * 36
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(chartWidth, 720)
  canvas.height = headerHeight + chartHeight + footerHeight
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('无法生成导出图纸')
  ctx.fillStyle = '#FFFFFF'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.fillStyle = '#292524'
  ctx.font = 'bold 24px system-ui, sans-serif'
  const safeName = name.replace(/\.[^.]+$/, '').slice(0, 32)
  ctx.fillText(`豆格 · ${safeName}`, 30, 38, canvas.width - 60)
  ctx.font = '14px system-ui, sans-serif'
  const total = usage.reduce((sum, row) => sum + row.count, 0)
  ctx.fillText(`${pattern.width} × ${pattern.height} 格  ·  ${total} 颗豆子  ·  ${usage.length} 种豆色  ·  ${getPalette(pattern.paletteId).label}`, 30, 70)
  if (region) ctx.fillText(`本页全局坐标：列 ${region.x + 1}–${region.x + region.width}，行 ${region.y + 1}–${region.y + region.height}；下方为全图备料清单`, 30, 96)
  // Draw the same chart directly into the final canvas; avoid a second full-size bitmap.
  drawPattern(canvas, pattern, { region, offset: { x: (canvas.width - chartWidth) / 2, y: headerHeight } })
  const legendY = headerHeight + chartHeight + 24
  ctx.fillStyle = '#57534E'
  ctx.fillText('豆色用量 / 空白格不放豆子', 30, legendY)
  for (let index = 0; index < usage.length; index++) {
    const { color, count } = usage[index]
    const x = 30 + index % columns * 180
    const y = legendY + 20 + Math.floor(index / columns) * 36
    ctx.fillStyle = color.hex
    ctx.fillRect(x, y, 18, 18)
    ctx.strokeStyle = '#D6D3D1'
    ctx.strokeRect(x, y, 18, 18)
    ctx.fillStyle = '#292524'
    ctx.fillText(`${color.code}  × ${count}`, x + 27, y + 14)
  }
  ctx.font = '12px system-ui, sans-serif'
  ctx.fillStyle = '#78716C'
  ctx.fillText('豆色来自图片取样，实际颜色请以实物为准。', 30, canvas.height - 20)
  return canvas
}

export function overviewSize(pattern: Pattern): { width: number; height: number } {
  const scale = Math.min(1, 1024 / Math.max(pattern.width, pattern.height))
  return { width: Math.max(1, Math.round(pattern.width * scale)), height: Math.max(1, Math.round(pattern.height * scale)) }
}

export function drawOverview(canvas: HTMLCanvasElement, pattern: Pattern): void {
  const size = overviewSize(pattern)
  canvas.width = size.width
  canvas.height = size.height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('无法绘制总览')
  const pixels = ctx.createImageData(size.width, size.height)
  for (let y = 0; y < size.height; y++) for (let x = 0; x < size.width; x++) {
    const sourceX = Math.min(pattern.width - 1, Math.floor((x + 0.5) * pattern.width / size.width))
    const sourceY = Math.min(pattern.height - 1, Math.floor((y + 0.5) * pattern.height / size.height))
    const color = getCell(pattern, sourceY * pattern.width + sourceX)
    const index = (y * size.width + x) * 4
    const rgb = color?.rgb ?? ((x + y) % 2 ? [240, 239, 237] : [250, 250, 249])
    pixels.data.set([...rgb, 255], index)
  }
  ctx.putImageData(pixels, 0, 0)
}
