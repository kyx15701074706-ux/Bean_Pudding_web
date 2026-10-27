// @vitest-environment happy-dom
import { mount } from '@vue/test-utils'
import { expect, it, vi } from 'vitest'
import App from './App.vue'
import type { SourceImage } from './lib/types'

vi.mock('./composables/useSourceImage', async () => {
  const { shallowRef } = await import('vue')
  return { useSourceImage: () => {
    const source = shallowRef<SourceImage | null>(null)
    return {
      source, loading: shallowRef(false), error: shallowRef(''), upload: vi.fn(),
      loadDemo: () => {
        const image = new Image()
        Object.defineProperties(image, { naturalWidth: { value: 32 }, naturalHeight: { value: 32 } })
        source.value = { image, url: '/fixture.png', name: 'fixture.png' }
      },
    }
  } }
})
vi.mock('./lib/image', async () => {
  const { matchPixels } = await import('./lib/pattern')
  const { getPalette } = await import('./lib/palette')
  return { imageToPattern: vi.fn(async (_image, width, height, _detail, options) => {
    const black = getPalette('221').colors.find(color => color.code === 'H7')!
    const pixels = new Uint8ClampedArray(Array.from({ length: width * height }, () => [...black.rgb, 255]).flat())
    return matchPixels(pixels, width, height, options.paletteId)
  }) }
})

it('切换色卡后保留旧图编号并禁止导出，重新生成后使用新编号和数量', async () => {
  const wrapper = mount(App, { global: { stubs: { PatternPreview: true } } })
  try {
    const png = () => wrapper.findAll('button').find(button => button.text().includes('导出整张图纸'))!
    const csv = () => wrapper.findAll('button').find(button => button.text().includes('导出用量清单'))!
    await vi.waitFor(() => expect(wrapper.get('tbody').text()).toContain('H7'))
    expect(png().attributes('disabled')).toBeUndefined()
    await wrapper.get('[aria-label="豆色色卡"]').setValue('88')
    expect(wrapper.get('tbody').text()).toContain('H7')
    expect(wrapper.text()).toContain('设置已调整，请重新生成图纸')
    expect(png().attributes('disabled')).toBeDefined()
    expect(csv().attributes('disabled')).toBeDefined()
    await wrapper.findAll('button').find(button => button.text().includes('生成拼豆图纸'))!.trigger('click')
    await vi.waitFor(() => expect(wrapper.get('tbody').text()).toContain('H07'))
    expect(wrapper.get('[aria-label="图纸摘要"]').text()).toContain('/ 88色')
    expect(png().attributes('disabled')).toBeUndefined()
    expect(csv().attributes('disabled')).toBeUndefined()
  } finally { wrapper.unmount() }
})
