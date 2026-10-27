import type { DetailOptions } from './types'

export const DEFAULT_DETAIL: DetailOptions = { mode: 'detail', sharpness: 45, contrast: 15 }

// One-pixel halos sample the same global pixels across neighbouring tiles.
export function enhanceTile(data: Uint8ClampedArray, width: number, height: number, options: DetailOptions): Uint8ClampedArray {
  const stride = width + 2
  if (data.length !== stride * (height + 2) * 4) throw new Error('细节处理像素尺寸不一致')
  const output = new Uint8ClampedArray(width * height * 4)
  const sharpness = options.mode === 'detail' ? Math.max(0, Math.min(100, options.sharpness)) / 100 * 1.5 : 0
  const contrast = options.mode === 'detail' ? Math.max(0, Math.min(100, options.contrast)) / 100 * 0.5 : 0
  const luminance = (index: number) => data[index] * 0.2126 + data[index + 1] * 0.7152 + data[index + 2] * 0.0722
  const weights = [1, 2, 1]
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const from = ((y + 1) * stride + x + 1) * 4
      const to = (y * width + x) * 4
      const center = luminance(from)
      let blurred = 0
      let weightSum = 0
      if (sharpness) {
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
          const index = from + (dy * stride + dx) * 4
          const weight = weights[dy + 1] * weights[dx + 1] * data[index + 3] / 255
          blurred += luminance(index) * weight
          weightSum += weight
        }
      }
      const delta = (weightSum ? (center - blurred / weightSum) * sharpness : 0) + (center - 128) * contrast
      for (let channel = 0; channel < 3; channel++) output[to + channel] = Math.round(data[from + channel] + delta)
      output[to + 3] = data[from + 3]
    }
  }
  return output
}
