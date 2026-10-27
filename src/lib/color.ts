import type { Lab, RGB } from './types'

export function hexToRgb(hex: string): RGB {
  if (!/^#[\da-f]{6}$/i.test(hex)) throw new Error('无效的HEX颜色')
  return [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)]
}

function linear(channel: number): number {
  const value = channel / 255
  return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
}

// sRGB → XYZ (D65) → CIELAB; nearest colour uses Delta E 1976.
export function rgbToLab(rgb: RGB): Lab {
  const [r, g, b] = rgb.map(linear)
  const transform = (t: number) => t > (6 / 29) ** 3 ? Math.cbrt(t) : t / (3 * (6 / 29) ** 2) + 4 / 29
  const x = transform((r * 0.4124564 + g * 0.3575761 + b * 0.1804375) / 0.95047)
  const y = transform(r * 0.2126729 + g * 0.7151522 + b * 0.072175)
  const z = transform((r * 0.0193339 + g * 0.119192 + b * 0.9503041) / 1.08883)
  return [116 * y - 16, 500 * (x - y), 200 * (y - z)]
}

export function labDistanceSquared(a: Lab, b: Lab): number {
  return (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2
}

export function textColor(rgb: RGB): string {
  const [r, g, b] = rgb.map(linear)
  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b
  return (luminance + 0.05) / 0.05 >= 1.05 / (luminance + 0.05) ? '#000000' : '#FFFFFF'
}
