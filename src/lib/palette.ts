import source from '../../data/palettes/bead-colors-221/bead-colors-221.json'
import source72 from '../../data/palettes/bead-colors-72/bead-colors-72.json'
import source88 from '../../data/palettes/bead-colors-88/bead-colors-88.json'
import source144 from '../../data/palettes/bead-colors-144/bead-colors-144.json'
import { hexToRgb, rgbToLab } from './color'
import type { BeadColor, BeadPalette, PaletteId } from './types'

function buildColors(data: Record<string, string>): readonly BeadColor[] {
  return Object.entries(data).map(([code, hex]) => {
    const rgb = hexToRgb(hex)
    return { code, hex, rgb, lab: rgbToLab(rgb) }
  })
}

export const palettes: readonly BeadPalette[] = [
  { id: '72', label: '72色拼豆色卡', colors: buildColors(source72) },
  { id: '88', label: '88色拼豆色卡', colors: buildColors(source88) },
  { id: '144', label: '144色拼豆色卡', colors: buildColors(source144) },
  { id: '221', label: '221色拼豆色卡', colors: buildColors(source) },
]

export function getPalette(id: PaletteId = '221'): BeadPalette {
  const result = palettes.find(item => item.id === id)
  if (!result) throw new Error('色卡不存在，请重新选择。')
  return result
}

// Keep 221 colors as the default for callers that do not select a palette.
export const palette = getPalette().colors
