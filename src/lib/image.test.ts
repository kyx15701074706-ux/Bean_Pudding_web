// @vitest-environment happy-dom
import { afterEach, expect, it, vi } from 'vitest'
import { imageToPattern } from './image'
import { getCell } from './pattern'
import { getPalette } from './palette'

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals() })

it('浏览器没有Worker时，回退配色也使用所选色卡', async () => {
  vi.stubGlobal('Worker', undefined)
  const black = getPalette('221').colors.find(color => color.code === 'H7')!
  const context = {
    drawImage: vi.fn(),
    getImageData: (_x: number, _y: number, width: number, height: number) => ({ data: new Uint8ClampedArray(Array.from({ length: width * height }, () => [...black.rgb, 255]).flat()) }),
  }
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(context as unknown as CanvasRenderingContext2D)
  for (const id of ['88', '72', '144', '221'] as const) {
    const pattern = await imageToPattern(new Image(), 2, 1, { mode: 'standard', sharpness: 0, contrast: 0 }, { paletteId: id })
    expect(pattern.paletteId).toBe(id)
    expect(getCell(pattern, 0)?.code).toBe(id === '88' ? 'H07' : 'H7')
  }
})
