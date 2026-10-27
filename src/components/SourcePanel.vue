<script setup lang="ts">
import { shallowRef, useTemplateRef, watch } from 'vue'
import { Upload, ImagePlus, LockKeyhole, UnlockKeyhole, ArrowRight, Sparkles } from '@lucide/vue'
import { fitDimensions, validateDimension } from '../lib/pattern'
import { palettes } from '../lib/palette'
import type { DetailOptions, PaletteId, SourceImage } from '../lib/types'
import { cn } from '../lib/cn'

const props = defineProps<{
  source: SourceImage | null
  width: number
  height: number
  loading: boolean
  busy: boolean
  error: string
  quality: DetailOptions
  progress: number
  paletteId: PaletteId
}>()
const emit = defineEmits<{
  upload: [file: File]
  demo: []
  dimensions: [value: { width: number; height: number }]
  generate: []
  quality: [value: DetailOptions]
  cancel: []
  palette: [value: PaletteId]
}>()
const fileInput = useTemplateRef<HTMLInputElement>('fileInput')
const locked = shallowRef(true)
const dragging = shallowRef(false)
const dimensionError = shallowRef('')
const draftWidth = shallowRef(String(props.width))
const draftHeight = shallowRef(String(props.height))
watch([() => props.width, () => props.height, () => props.source], () => {
  draftWidth.value = String(props.width)
  draftHeight.value = String(props.height)
  dimensionError.value = ''
})

function editDimension(axis: 'width' | 'height', raw: string) {
  if (axis === 'width') draftWidth.value = raw
  else draftHeight.value = raw
  changeDimension(axis, Number(raw))
}

function toggleRatio() {
  locked.value = !locked.value
  if (locked.value) changeDimension('width', props.width)
}

function chooseFile(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (file) emit('upload', file)
  input.value = ''
}

function dropFile(event: DragEvent) {
  dragging.value = false
  const file = event.dataTransfer?.files[0]
  if (file) emit('upload', file)
}

function changeDimension(axis: 'width' | 'height', value: number) {
  dimensionError.value = ''
  try {
    validateDimension(value)
    const ratio = props.source ? props.source.image.naturalWidth / props.source.image.naturalHeight : props.width / props.height
    const next = locked.value ? fitDimensions(value, ratio, axis) : { width: props.width, height: props.height, [axis]: value }
    draftWidth.value = String(next.width)
    draftHeight.value = String(next.height)
    emit('dimensions', next)
  } catch (cause) {
    dimensionError.value = cause instanceof Error ? cause.message : '尺寸无效'
  }
}
</script>

<template>
  <aside class="source-panel panel" aria-label="图片与排版设置">
    <section class="panel-section">
      <div class="section-heading"><span class="step-number">01</span><h2>上传图片</h2></div>
      <input ref="fileInput" class="sr-only" type="file" accept="image/png,image/jpeg,image/webp" aria-label="选择图片文件" tabindex="-1" @change="chooseFile">
      <button type="button" :class="cn('upload-zone', dragging && 'border-orange-600 bg-orange-50')" :disabled="loading" @click="fileInput?.click()" @dragover.prevent="dragging = true" @dragleave="dragging = false" @drop.prevent="dropFile">
        <span class="upload-icon"><Upload :size="22" /></span>
        <strong>{{ loading ? '正在读取图片…' : '点击上传，或拖拽图片到这里' }}</strong>
        <span class="muted text-xs">PNG / JPG / WebP · 最大25MB</span>
      </button>
      <p v-if="error" class="field-error" role="alert">{{ error }}</p>
      <div v-if="source" class="source-summary">
        <img :src="source.url" alt="上传的原图缩略图" class="source-thumb">
        <div class="min-w-0 flex-1"><p class="truncate text-xs font-semibold">{{ source.name }}</p><p class="muted mt-1 text-xs tabular-nums">{{ source.image.naturalWidth }} × {{ source.image.naturalHeight }} px</p></div>
        <button type="button" class="icon-button" aria-label="更换图片" title="更换图片" @click="fileInput?.click()"><ImagePlus :size="17" /></button>
      </div>
      <button type="button" class="demo-link" :disabled="loading" @click="emit('demo')"><Sparkles :size="14" /> 试用橘子小样 <ArrowRight :size="13" /></button>
    </section>

    <section class="panel-section">
      <div class="section-heading"><span class="step-number">02</span><h2>排版设置</h2></div>
      <div class="flex items-center justify-between mb-3"><span class="field-label">图纸尺寸</span><button type="button" class="ratio-button" :aria-pressed="locked" @click="toggleRatio"><component :is="locked ? LockKeyhole : UnlockKeyhole" :size="13" />{{ locked ? '保持比例' : '自由尺寸' }}</button></div>
      <div class="dimension-fields">
        <label class="dimension-label">横向豆数<input :value="draftWidth" type="number" min="1" step="1" aria-label="横向豆数" @input="editDimension('width', ($event.target as HTMLInputElement).value)"><span>颗</span></label>
        <span class="muted pt-5">×</span>
        <label class="dimension-label">纵向豆数<input :value="draftHeight" type="number" min="1" step="1" aria-label="纵向豆数" @input="editDimension('height', ($event.target as HTMLInputElement).value)"><span>颗</span></label>
      </div>
      <div class="presets"><button v-for="size in [64, 128, 256, 512]" :key="size" type="button" :class="cn('preset', width === size && 'border-orange-600 bg-orange-50 text-orange-700')" @click="changeDimension('width', size)">{{ size }}宽</button></div>
      <p v-if="dimensionError" class="field-error" role="alert">{{ dimensionError }}</p>
      <p class="muted mt-3 text-xs leading-5">横纵豆数不设固定上限。人像建议从256颗宽起步，尺寸越大，保留的细节越多。</p>
      <label class="quality-field">配色模式<select :value="quality.mode" aria-label="配色模式" @change="emit('quality', { ...quality, mode: ($event.target as HTMLSelectElement).value as DetailOptions['mode'] })"><option value="standard">标准 · 像素画 / 简单图案</option><option value="detail">细节优先 · 人像 / 复杂背景</option></select></label>
      <div v-if="quality.mode === 'detail'" class="detail-controls">
        <label>锐度增强 <output>{{ quality.sharpness }}%</output><input type="range" min="0" max="100" :value="quality.sharpness" aria-label="锐度增强" @input="emit('quality', { ...quality, sharpness: Number(($event.target as HTMLInputElement).value) })"></label>
        <label>对比增强 <output>{{ quality.contrast }}%</output><input type="range" min="0" max="100" :value="quality.contrast" aria-label="对比增强" @input="emit('quality', { ...quality, contrast: Number(($event.target as HTMLInputElement).value) })"></label>
        <p class="muted text-xs leading-5">轻度增强边缘与明暗；低豆数下无法保留的细节，需要增加图纸尺寸。</p>
      </div>
      <label class="quality-field">豆色色卡<select :value="paletteId" aria-label="豆色色卡" aria-describedby="palette-help" :disabled="busy || loading" @change="emit('palette', ($event.target as HTMLSelectElement).value as PaletteId)"><option v-for="item in palettes" :key="item.id" :value="item.id">{{ item.label }}</option></select></label>
      <p id="palette-help" class="muted text-xs leading-5 mt-2">按手头的豆色套装选择，切换后请重新生成图纸。</p>
      <p class="muted text-xs leading-5 mt-3">透明区域留空，不计入用量；半透明边缘按覆盖程度处理。</p>
      <button type="button" class="button-primary w-full mt-5" :disabled="!source || busy || loading || !!dimensionError" @click="emit('generate')"><Sparkles :size="16" />{{ busy ? '正在匹配豆色…' : '生成拼豆图纸' }}<ArrowRight :size="16" class="ml-auto" /></button>
      <div v-if="busy" class="processing-progress"><label>配色进度 {{ progress }}%<progress :value="progress" max="100" aria-label="配色进度"></progress></label><button type="button" class="button-secondary w-full mt-2" @click="emit('cancel')">取消配色</button></div>
    </section>
    <div class="local-note"><LockKeyhole :size="14" /><p>图片仅在你的浏览器内处理。<br>放心上传，慢慢创作。</p></div>
  </aside>
</template>

<style scoped>
.source-panel { align-self: start; }
.panel-section { padding: 23px 21px; }
.panel-section + .panel-section { border-top: 1px solid var(--line); }
.upload-zone { display: flex; align-items: center; flex-direction: column; gap: 12px; width: 100%; padding: 24px 8px; border: 1px dashed var(--stone-300); border-radius: 10px; background: var(--stone-50); cursor: pointer; }
.upload-zone strong { font-size: 12px; font-weight: 500; }
.upload-icon { display: grid; place-items: center; color: var(--accent); border: 1px solid var(--orange-200); border-radius: 12px; width: 44px; height: 44px; background: var(--orange-50); }
.source-summary { display: flex; align-items: center; gap: 10px; margin-top: 16px; }
.source-thumb { width: 44px; height: 44px; object-fit: contain; background: var(--stone-100); border-radius: 6px; image-rendering: pixelated; }
.demo-link { display: flex; align-items: center; gap: 6px; padding: 0; margin-top: 16px; font-size: 12px; color: var(--accent); background: none; border: 0; cursor: pointer; }
.field-label { font-size: 12px; font-weight: 600; }
.ratio-button { display: flex; align-items: center; gap: 4px; font-size: 11px; padding: 0; background: none; border: 0; color: var(--stone-600); cursor: pointer; }
.ratio-button[aria-pressed='true'] { color: var(--accent); }
.dimension-fields { display: grid; grid-template-columns: 1fr auto 1fr; gap: 8px; align-items: center; }
.dimension-label { display: block; position: relative; font-size: 11px; color: var(--stone-500); }
.dimension-label input { display: block; margin-top: 7px; width: 100%; height: 40px; padding: 8px 25px 8px 11px; border: 1px solid var(--stone-200); border-radius: 7px; color: var(--stone-800); font-size: 15px; font-weight: 600; font-variant-numeric: tabular-nums; appearance: textfield; }
.dimension-label input::-webkit-inner-spin-button { appearance: none; }
.dimension-label > span { position: absolute; right: 10px; bottom: 12px; font-size: 11px; }
.presets { display: flex; gap: 7px; margin-top: 10px; }
.quality-field { display: block; margin-top: 18px; font-size: 12px; font-weight: 600; }
.quality-field select { display: block; margin-top: 8px; padding: 8px; width: 100%; font-size: 11px; border: 1px solid var(--stone-200); border-radius: 6px; background: white; }
.detail-controls { padding: 12px; margin-top: 10px; border-radius: 6px; background: var(--stone-50); }
.detail-controls label { display: block; margin-bottom: 12px; font-size: 11px; }
.detail-controls output { float: right; color: var(--stone-500); font-variant-numeric: tabular-nums; }
.detail-controls input { display: block; margin-top: 8px; width: 100%; accent-color: var(--accent); }
.processing-progress { margin-top: 12px; font-size: 12px; }
.processing-progress progress { display: block; width: 100%; margin-top: 8px; accent-color: var(--accent); }
.preset { flex: 1; font-size: 11px; padding: 7px 2px; border: 1px solid var(--stone-200); border-radius: 6px; background: white; cursor: pointer; }
.local-note { display: flex; gap: 9px; padding: 17px 21px; border-top: 1px solid var(--line); color: var(--stone-500); background: var(--stone-50); border-radius: 0 0 12px 12px; font-size: 11px; line-height: 1.8; }
.local-note svg { flex-shrink: 0; margin-top: 3px; }
</style>
