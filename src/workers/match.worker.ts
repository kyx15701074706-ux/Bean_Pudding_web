import { createPixelMatcher } from '../lib/pattern'
import { getPalette } from '../lib/palette'
import type { MatchRequest, PaletteId } from '../lib/types'

let match: ReturnType<typeof createPixelMatcher> | undefined
let paletteId: PaletteId | undefined
const scope = self as unknown as {
  onmessage: ((event: MessageEvent<MatchRequest>) => void) | null
  postMessage: (data: Uint8Array, transfer: Transferable[]) => void
}
scope.onmessage = event => {
  if (!match || paletteId !== event.data.paletteId) {
    paletteId = event.data.paletteId
    match = createPixelMatcher(getPalette(paletteId).colors)
  }
  const cells = match(event.data.pixels)
  scope.postMessage(cells, [cells.buffer])
}
