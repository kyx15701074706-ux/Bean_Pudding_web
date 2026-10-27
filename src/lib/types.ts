export type RGB = readonly [number, number, number]
export type Lab = readonly [number, number, number]
export type PaletteId = '72' | '88' | '144' | '221'

export interface BeadColor {
  code: string
  hex: string
  rgb: RGB
  lab: Lab
}

export interface Pattern {
  paletteId: PaletteId
  width: number
  height: number
  cells: Uint8Array
}

export interface BeadPalette {
  id: PaletteId
  label: string
  colors: readonly BeadColor[]
}

export interface MatchRequest {
  paletteId: PaletteId
  pixels: Uint8ClampedArray
}

export interface DetailOptions {
  mode: 'standard' | 'detail'
  sharpness: number
  contrast: number
}

export interface PatternRegion { x: number; y: number; width: number; height: number }
export interface ProcessingOptions { signal?: AbortSignal; onProgress?: (percent: number) => void }

export interface ColorUsage {
  color: BeadColor
  count: number
}

export interface SourceImage {
  image: HTMLImageElement
  url: string
  name: string
}
