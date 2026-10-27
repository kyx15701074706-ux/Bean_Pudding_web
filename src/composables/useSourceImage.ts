import { onScopeDispose, shallowRef } from 'vue'
import { loadImage } from '../lib/image'
import type { SourceImage } from '../lib/types'

export function useSourceImage() {
  const source = shallowRef<SourceImage | null>(null)
  const loading = shallowRef(false)
  const error = shallowRef('')
  let revision = 0
  let activeUrl: string | null = null

  async function load(url: string, name: string, objectUrl = false) {
    const current = ++revision
    loading.value = true
    error.value = ''
    try {
      const next = await loadImage(url, name)
      if (current !== revision) {
        if (objectUrl) URL.revokeObjectURL(url)
        return
      }
      if (activeUrl) URL.revokeObjectURL(activeUrl)
      activeUrl = objectUrl ? url : null
      source.value = next
    } catch (cause) {
      if (objectUrl) URL.revokeObjectURL(url)
      if (current === revision) error.value = cause instanceof Error ? cause.message : '图片读取失败'
    } finally {
      if (current === revision) loading.value = false
    }
  }

  function upload(file: File) {
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
      error.value = '请选择PNG、JPG或WebP图片。'
      return
    }
    if (file.size > 25 * 1024 * 1024) {
      error.value = '图片大小需在25MB以内，请压缩后重试。'
      return
    }
    return load(URL.createObjectURL(file), file.name, true)
  }

  function loadDemo() {
    return load('/demo-orange.png', '橘子小样.png')
  }

  onScopeDispose(() => {
    revision++
    if (activeUrl) URL.revokeObjectURL(activeUrl)
  })

  return { source, loading, error, upload, loadDemo }
}
