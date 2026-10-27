import { afterEach, expect, it, vi } from 'vitest'
import { getPalette } from '../lib/palette'
import type { MatchRequest } from '../lib/types'

afterEach(() => vi.unstubAllGlobals())

it('Worker按请求色卡配色，切换时清除上一套索引缓存', async () => {
  const postMessage = vi.fn()
  const scope = { onmessage: null as ((event: MessageEvent<MatchRequest>) => void) | null, postMessage }
  vi.stubGlobal('self', scope)
  await import('./match.worker')
  const rgb = getPalette('221').colors.find(color => color.code === 'H7')!.rgb
  for (const id of ['221', '88', '72', '144', '88'] as const) {
    scope.onmessage!({ data: { paletteId: id, pixels: new Uint8ClampedArray([...rgb, 255, 0, 0, 0, 0]) } } as MessageEvent<MatchRequest>)
    const cells = postMessage.mock.calls.at(-1)![0] as Uint8Array
    expect(getPalette(id).colors[cells[0]].code).toBe(id === '88' ? 'H07' : 'H7')
    expect(cells[1]).toBe(255)
  }
})
