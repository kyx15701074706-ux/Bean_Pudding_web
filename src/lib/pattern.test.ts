import { describe, expect, it } from 'vitest'
import { hexToRgb, rgbToLab, textColor } from './color'
import { palette } from './palette'
import { EMPTY_CELL, fitDimensions, getCell, getUsage, matchPixels, nearestColor, validateDimension, validateGrid } from './pattern'
import { usageCsv } from './export'

describe('颜色空间与221色色表', () => {
  it('D65标准色参考值正确', () => {
    const [l, a, b] = rgbToLab([255, 0, 0])
    expect(l).toBeCloseTo(53.2408, 3)
    expect(a).toBeCloseTo(80.0925, 3)
    expect(b).toBeCloseTo(67.2032, 3)
    expect(rgbToLab([0, 0, 0])).toEqual([0, 0, 0])
    expect(rgbToLab([255, 255, 255])[0]).toBeCloseTo(100, 3)
  })

  it('全部221个色值精确匹配回原始编号，包括相近的白色', () => {
    expect(palette).toHaveLength(221)
    for (const color of palette) expect(nearestColor(hexToRgb(color.hex)).code).toBe(color.code)
  })

  it('选择可读的编号文字颜色', () => {
    expect(textColor([0, 0, 0])).toBe('#FFFFFF')
    expect(textColor([255, 255, 255])).toBe('#000000')
  })
})

describe('网格、透明区域与用量', () => {
  const orange = palette.find(color => color.code === 'A10')!
  const green = palette.find(color => color.code === 'B5')!

  it('透明像素不算豆子，各色数量之和等于非空格数', () => {
    const pixels = new Uint8ClampedArray([...orange.rgb, 255, ...orange.rgb, 255, ...green.rgb, 255, 255, 0, 0, 0])
    const pattern = matchPixels(pixels, 2, 2)
    expect(Array.from(pattern.cells, (_, index) => getCell(pattern, index)?.code ?? null)).toEqual(['A10', 'A10', 'B5', null])
    expect(getUsage(pattern).map(row => [row.color.code, row.count])).toEqual([['A10', 2], ['B5', 1]])
    expect(getUsage(pattern).reduce((sum, row) => sum + row.count, 0)).toBe(3)
  })

  it('半透明像素按50%阈值及白底合成处理', () => {
    const pattern = matchPixels(new Uint8ClampedArray([0, 0, 0, 127, 0, 0, 0, 128]), 2, 1)
    expect(getCell(pattern, 0)).toBeNull()
    expect(getCell(pattern, 1)?.code).toBe(nearestColor([127, 127, 127]).code)
  })

  it('全透明图的用量为零', () => {
    const pattern = matchPixels(new Uint8ClampedArray(16), 2, 2)
    expect(Array.from(pattern.cells)).toEqual([EMPTY_CELL, EMPTY_CELL, EMPTY_CELL, EMPTY_CELL])
    expect(getUsage(pattern)).toEqual([])
  })

  it('保持宽高比，允许超过128并拒绝非正整数及不安全总数', () => {
    expect(fitDimensions(64, 2, 'width')).toEqual({ width: 64, height: 32 })
    expect(fitDimensions(30, 2, 'height')).toEqual({ width: 60, height: 30 })
    expect(fitDimensions(1, 100, 'width')).toEqual({ width: 1, height: 1 })
    for (const invalid of [0, -1, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]) expect(() => validateDimension(invalid)).toThrow()
    expect(fitDimensions(512, 0.5, 'width')).toEqual({ width: 512, height: 1024 })
    expect(validateDimension(100000)).toBe(100000)
    expect(() => validateGrid(Number.MAX_SAFE_INTEGER, 2)).toThrow()
    expect(() => matchPixels(new Uint8ClampedArray(4), 2, 2)).toThrow()
  })

  it('大网格每格仅存一个字节，并正确统计零号色与空格', () => {
    const cells = new Uint8Array(512 * 384)
    cells[0] = EMPTY_CELL
    const pattern = { paletteId: '221' as const, width: 512, height: 384, cells }
    expect(cells.byteLength).toBe(512 * 384)
    expect(getUsage(pattern).map(row => [row.color.code, row.count])).toEqual([['A1', 512 * 384 - 1]])
  })

  it('CSV包含可由Excel读取的BOM，且与图纸用量完全一致', () => {
    const pattern = matchPixels(new Uint8ClampedArray([...orange.rgb, 255, ...green.rgb, 255]), 2, 1)
    const csv = usageCsv(pattern)
    expect(csv.startsWith('\uFEFF豆色编号,HEX,用量（颗）\r\n')).toBe(true)
    expect(csv).toContain(`A10,${orange.hex},1\r\n`)
    expect(csv).toContain(`B5,${green.hex},1\r\n`)
    expect(csv.split('\r\n').filter(Boolean)).toHaveLength(3)
  })
})
