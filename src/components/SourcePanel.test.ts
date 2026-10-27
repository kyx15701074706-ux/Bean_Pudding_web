// @vitest-environment happy-dom
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import SourcePanel from './SourcePanel.vue'
import type { SourceImage } from '../lib/types'

function setup() {
  const image = new Image()
  Object.defineProperties(image, { naturalWidth: { value: 200 }, naturalHeight: { value: 100 } })
  const source: SourceImage = { image, url: '/sample.png', name: 'sample.png' }
  return mount(SourcePanel, { props: { source, paletteId: '221', width: 32, height: 16, quality: { mode: 'standard', sharpness: 45, contrast: 15 }, progress: 0, loading: false, busy: false, error: '' } })
}

describe('排版设置的用户操作', () => {
  it('可以选择四套色卡，加载或生成期间禁止切换', async () => {
    const wrapper = setup()
    const select = wrapper.get('select[aria-label="豆色色卡"]')
    expect(select.findAll('option').map(option => option.attributes('value'))).toEqual(['72', '88', '144', '221'])
    await select.setValue('88')
    expect(wrapper.emitted('palette')?.at(-1)).toEqual(['88'])
    await wrapper.setProps({ busy: true })
    expect(select.attributes('disabled')).toBeDefined()
    await wrapper.setProps({ busy: false, loading: true })
    expect(select.attributes('disabled')).toBeDefined()
    wrapper.unmount()
  })

  it('修改横向豆数时保留原图比例', async () => {
    const wrapper = setup()
    await wrapper.get('input[aria-label="横向豆数"]').setValue('64')
    expect(wrapper.emitted('dimensions')?.at(-1)).toEqual([{ width: 64, height: 32 }])
    wrapper.unmount()
  })

  it('解锁后允许独立修改宽高', async () => {
    const wrapper = setup()
    await wrapper.get('button[aria-pressed]').trigger('click')
    await wrapper.get('input[aria-label="纵向豆数"]').setValue('24')
    expect(wrapper.emitted('dimensions')?.at(-1)).toEqual([{ width: 32, height: 24 }])
    wrapper.unmount()
  })

  it('无效尺寸会显示错误并禁止生成', async () => {
    const wrapper = setup()
    await wrapper.get('input[aria-label="横向豆数"]').setValue('0')
    expect(wrapper.get('[role="alert"]').text()).toContain('正整数')
    expect(wrapper.findAll('button').find(button => button.text().includes('生成拼豆图纸'))?.attributes('disabled')).toBeDefined()
    expect(wrapper.emitted('dimensions')).toBeUndefined()
    wrapper.unmount()
  })

  it('输入512颗宽时不限制为128，保持比例且没有max属性', async () => {
    const wrapper = setup()
    const input = wrapper.get('input[aria-label="横向豆数"]')
    expect(input.attributes('max')).toBeUndefined()
    await input.setValue('512')
    expect(wrapper.emitted('dimensions')?.at(-1)).toEqual([{ width: 512, height: 256 }])
    wrapper.unmount()
  })

  it('可以清空后重新输入，未离开输入框也能应用尺寸', async () => {
    const wrapper = setup()
    const input = wrapper.get('input[aria-label="横向豆数"]')
    await input.setValue('')
    expect((input.element as HTMLInputElement).value).toBe('')
    await input.setValue('4')
    expect(wrapper.emitted('dimensions')?.at(-1)).toEqual([{ width: 4, height: 2 }])
    expect(wrapper.find('[role="alert"]').exists()).toBe(false)
    wrapper.unmount()
  })
})
