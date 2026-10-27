import { describe, expect, it } from 'vitest'
import { getPalette, palettes } from './palette'
import { EMPTY_CELL, getCell, getUsage, matchPixels } from './pattern'
import { usageCsv } from './export'

describe('各套色卡与配色结果', () => {
  it('提供72、88、144、221色，数量和编号唯一', () => {
    expect(palettes.map(item => item.id)).toEqual(['72', '88', '144', '221'])
    for (const item of palettes) {
      expect(item.colors).toHaveLength(Number(item.id))
      expect(new Set(item.colors.map(color => color.code)).size).toBe(Number(item.id))
    }
  })

  it('72和144色复用221色值，88色保留X编号及前导零', () => {
    const full = new Map(getPalette('221').colors.map(color => [color.code, color.hex]))
    for (const id of ['72', '144'] as const) {
      for (const color of getPalette(id).colors) expect(color.hex).toBe(full.get(color.code))
    }
    expect(getPalette('144').colors.slice(-9).map(color => color.code)).toEqual(['M7', 'M8', 'M9', 'M10', 'M11', 'M12', 'M13', 'M14', 'M15'])
    const mediumCodes = new Set(getPalette('144').colors.map(color => color.code))
    expect(getPalette('72').colors.every(color => mediumCodes.has(color.code))).toBe(true)
    const special = getPalette('88').colors
    expect(special.filter(color => color.code.startsWith('X'))).toHaveLength(76)
    for (const [code, canonical] of [['H01', 'H1'], ['H07', 'H7'], ['D03', 'D3'], ['A02', 'A2']]) {
      expect(special.find(color => color.code === code)?.hex).toBe(full.get(canonical))
    }
    expect(getPalette('72').colors.some(color => color.code === 'A10')).toBe(false)
  })

  for (const selected of palettes) {
    it(`${selected.id}色逐色回匹配，统计和CSV仅包含该套编号`, () => {
      const pixels = new Uint8ClampedArray(selected.colors.flatMap(color => [...color.rgb, 255]).concat([0, 0, 0, 0]))
      const pattern = matchPixels(pixels, selected.colors.length + 1, 1, selected.id)
      expect(pattern.paletteId).toBe(selected.id)
      expect(pattern.cells.at(-1)).toBe(EMPTY_CELL)
      for (const [index, color] of selected.colors.entries()) expect(getCell(pattern, index)).toEqual(color)
      const usage = getUsage(pattern)
      expect(usage).toHaveLength(selected.colors.length)
      expect(usage.every(row => row.count === 1)).toBe(true)
      const csv = usageCsv(pattern)
      for (const color of selected.colors) expect(csv).toContain(`${color.code},${color.hex},1\r\n`)
    })
  }

  it('相同输入在88色使用H07，在221色使用H7；旧图纸保持原编号', () => {
    const black = getPalette('221').colors.find(color => color.code === 'H7')!
    const pixels = new Uint8ClampedArray([...black.rgb, 255])
    const old = matchPixels(pixels, 1, 1, '221')
    const current = matchPixels(pixels, 1, 1, '88')
    expect(getCell(current, 0)?.code).toBe('H07')
    expect(getCell(old, 0)?.code).toBe('H7')
    expect(usageCsv(current)).toContain(`H07,${black.hex},1`)
    expect(usageCsv(current)).not.toContain('\r\nH7,')
  })
})
