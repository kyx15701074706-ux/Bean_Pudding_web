<script setup lang="ts">
import { computed, nextTick, onMounted, onScopeDispose, reactive, shallowRef, watch } from 'vue'
import { Grid2X2, ShieldCheck, ArrowUpRight, CircleCheck, Info } from '@lucide/vue'
import SourcePanel from './components/SourcePanel.vue'
import PatternPreview from './components/PatternPreview.vue'
import UsagePanel from './components/UsagePanel.vue'
import { useSourceImage } from './composables/useSourceImage'
import { imageToPattern } from './lib/image'
import { getUsage } from './lib/pattern'
import { exportCsv, exportPng } from './lib/export'
import { DEFAULT_DETAIL } from './lib/enhance'
import { pageCount } from './lib/tiles'
import { getPalette } from './lib/palette'
import type { PaletteId, Pattern } from './lib/types'

const { source, loading, error, upload, loadDemo } = useSourceImage()
const dimensions = reactive({ width: 32, height: 32 })
const quality = reactive({ ...DEFAULT_DETAIL })
const paletteId = shallowRef<PaletteId>('221')
const selectedPalette = computed(() => getPalette(paletteId.value))
const progress = shallowRef(0)
const exportProgress = shallowRef(0)
const completedKey = shallowRef('')
let generationController: AbortController | null = null
let exportController: AbortController | null = null
const pattern = shallowRef<Pattern | null>(null)
const busy = shallowRef(false)
const processingError = shallowRef('')
const exportError = shallowRef('')
const exporting = shallowRef(false)
const notification = shallowRef('')
let revision = 0

const usage = computed(() => pattern.value ? getUsage(pattern.value) : [])
const total = computed(() => usage.value.reduce((sum, row) => sum + row.count, 0))
const displayedPalette = computed(() => getPalette(pattern.value?.paletteId ?? paletteId.value))
const settingsKey = computed(() => JSON.stringify([source.value?.url, dimensions.width, dimensions.height, quality.mode, quality.sharpness, quality.contrast, paletteId.value]))
const dirty = computed(() => !!pattern.value && completedKey.value !== settingsKey.value)
const exportPages = computed(() => pattern.value ? pageCount(pattern.value.width, pattern.value.height) : 1)
const canExport = computed(() => !!pattern.value && !busy.value && !loading.value && !dirty.value)

async function generate() {
  if (!source.value) return
  generationController?.abort()
  const controller = new AbortController()
  generationController = controller
  const current = ++revision
  const image = source.value.image
  const { width, height } = dimensions
  const detail = { ...quality }
  const selectedId = paletteId.value
  const key = settingsKey.value
  progress.value = 0
  busy.value = true
  processingError.value = ''
  exportError.value = ''
  notification.value = ''
  await nextTick()
  await new Promise(resolve => setTimeout(resolve, 0))
  if (current !== revision) return
  try {
    const result = await imageToPattern(image, width, height, detail, {
      paletteId: selectedId,
      signal: controller.signal,
      onProgress: value => { if (current === revision) progress.value = value },
    })
    if (current !== revision) return
    pattern.value = result
    completedKey.value = key
    notification.value = '图纸已生成，可以开始备料了。'
  } catch (cause) {
    if (current !== revision) return
    if (cause instanceof Error && cause.name === 'AbortError') notification.value = '已取消配色。'
    else processingError.value = cause instanceof Error ? cause.message : '图纸生成失败，请重新上传图片。'
  } finally {
    if (current === revision) busy.value = false
  }
}

watch(source, value => {
  generationController?.abort()
  exportController?.abort()
  revision++
  pattern.value = null
  if (!value) return
  const ratio = value.image.naturalWidth / value.image.naturalHeight
  const target = Math.max(value.image.naturalWidth, value.image.naturalHeight) > 128 ? 256 : 32
  quality.mode = target > 32 ? 'detail' : 'standard'
  dimensions.width = ratio >= 1 ? target : Math.max(1, Math.round(target * ratio))
  dimensions.height = ratio <= 1 ? target : Math.max(1, Math.round(target / ratio))
  void generate()
})

watch(paletteId, () => {
  generationController?.abort()
  exportController?.abort()
  processingError.value = ''
  exportError.value = ''
  notification.value = '色卡已更换，请重新生成图纸。'
})

async function savePng(format: 'png' | 'tiles' = 'png') {
  if (!canExport.value || !pattern.value || !source.value) return
  exporting.value = true
  exportProgress.value = 0
  const controller = new AbortController()
  exportController = controller
  exportError.value = ''
  try {
    await exportPng(pattern.value, source.value.name, { format, signal: controller.signal, onProgress: value => { exportProgress.value = value } })
    notification.value = '图纸已导出。'
  } catch (cause) {
    if (cause instanceof Error && cause.name === 'AbortError') notification.value = '已取消导出。'
    else exportError.value = cause instanceof Error ? cause.message : '图纸导出失败'
  } finally {
    exporting.value = false
  }
}

function saveCsv() {
  if (!canExport.value || !pattern.value || !source.value) return
  exportError.value = ''
  try {
    exportCsv(pattern.value, source.value.name)
    notification.value = 'CSV用量清单已导出。'
  } catch {
    exportError.value = 'CSV导出失败，请重试。'
  }
}

onMounted(loadDemo)
onScopeDispose(() => { generationController?.abort(); exportController?.abort() })
</script>

<template>
  <div class="app-shell">
    <header class="app-header"><div class="header-inner"><a href="/" class="brand" aria-label="豆格首页"><span class="brand-mark"><Grid2X2 :size="25" stroke-width="2" /></span><span class="brand-name">豆格<span class="brand-divider"></span><span class="brand-description">拼豆排版工作台</span></span></a><div class="header-meta"><span class="version-label">{{ selectedPalette.label }}</span><span class="local-indicator"><i></i>本地创作，安心使用</span></div></div></header>
    <main class="main-content">
      <div class="intro"><div><div class="eyebrow"><span></span>让每一颗豆子，都有自己的位置</div><h1>把喜欢的图片，变成拼豆图纸。</h1><p>上传、配色、排版，一次完成。从屏幕里的灵感，到手心里的作品。</p></div><div class="intro-note"><ShieldCheck :size="17" /><span>无需登录<br><strong>打开就能开始</strong></span></div></div>
      <div class="overview-strip" aria-label="图纸摘要"><div><span>图纸尺寸</span><strong>{{ pattern ? `${pattern.width} × ${pattern.height}` : '—' }}<small>格</small></strong></div><div><span>豆子总数</span><strong>{{ total.toLocaleString() }}<small>颗</small></strong></div><div><span>使用豆色</span><strong>{{ usage.length }}<small>/ {{ displayedPalette.colors.length }}色</small></strong></div><p><CircleCheck :size="16" />{{ dirty ? '设置已调整，请重新生成图纸' : busy ? '正在自动匹配豆色' : '每一格，都已找到合适的豆色' }}</p></div>
      <div class="workspace">
        <SourcePanel :palette-id="paletteId" :source="source" :width="dimensions.width" :height="dimensions.height" :quality="quality" :progress="progress" :loading="loading" :busy="busy" :error="error || processingError" @upload="upload" @demo="loadDemo" @dimensions="Object.assign(dimensions, $event)" @quality="Object.assign(quality, $event)" @palette="paletteId = $event" @generate="generate" @cancel="generationController?.abort()" />
        <PatternPreview :pattern="pattern" :source="source" :busy="busy" :dirty="dirty" />
        <UsagePanel :usage="usage" :total="total" :can-export="canExport" :exporting="exporting" :progress="exportProgress" :pages="exportPages" :error="exportError" @png="savePng()" @tiles="savePng('tiles')" @csv="saveCsv" @cancel="exportController?.abort()" />
      </div>
      <div class="workspace-note"><span><Info :size="13" />豆色基于图片取样，实际颜色请以实物为准。</span><span>一格一豆，慢慢拼出喜欢的生活 <ArrowUpRight :size="13" /></span></div>
      <p class="sr-only" role="status" aria-live="polite">{{ notification }}</p>
    </main>
    <footer class="app-footer"><span class="footer-brand">豆格</span><span>留一点时间，给动手的快乐。</span><span class="ml-auto">MADE FOR YOUR LITTLE MASTERPIECES</span></footer>
  </div>
</template>

<style scoped>
.app-header { border-bottom: 1px solid var(--line); background: white; }
.header-inner { max-width: 1600px; height: 76px; padding: 0 40px; margin: auto; display: flex; align-items: center; justify-content: space-between; gap: 20px; }
.brand { display: flex; align-items: center; gap: 11px; text-decoration: none; color: inherit; }
.brand-mark { display: grid; place-items: center; width: 38px; height: 38px; border-radius: 11px; background: var(--accent); color: white; }
.brand-name { display: flex; align-items: center; font-size: 23px; font-weight: 750; }
.brand-divider { height: 20px; width: 1px; margin: 0 16px; background: var(--stone-200); }
.brand-description { font-size: 12px; font-weight: 400; color: var(--stone-500); }
.header-meta { display: flex; align-items: center; gap: 22px; font-size: 11px; }
.version-label { border: 1px solid var(--stone-200); border-radius: 5px; padding: 5px 8px; color: var(--stone-600); }
.local-indicator { display: flex; align-items: center; gap: 7px; color: var(--stone-500); }
.local-indicator i { width: 6px; height: 6px; border-radius: 50%; background: var(--stone-500); }
.main-content { max-width: 1600px; margin: auto; padding: 36px 40px 24px; }
.intro { display: flex; justify-content: space-between; align-items: center; gap: 20px; margin-bottom: 26px; }
.eyebrow { display: flex; align-items: center; gap: 6px; color: var(--accent); font-size: 11px; margin-bottom: 12px; }
.eyebrow span { width: 5px; height: 5px; background: var(--accent); }
.intro h1 { margin: 0; font-size: clamp(22px, 2.3vw, 32px); font-weight: 650; line-height: 1.4; }
.intro p { font-size: 12px; color: var(--stone-500); margin-top: 11px; line-height: 1.8; }
.intro-note { display: flex; align-items: center; gap: 10px; font-size: 10px; color: var(--stone-400); line-height: 1.8; }
.intro-note strong { color: var(--stone-600); font-size: 11px; font-weight: 500; }
.overview-strip { display: flex; align-items: center; padding: 16px 22px; margin-bottom: 20px; border: 1px solid var(--line); background: white; border-radius: 10px; }
.overview-strip > div { padding-right: 38px; margin-right: 32px; border-right: 1px solid var(--line); }
.overview-strip > div > span { display: block; font-size: 10px; color: var(--stone-500); margin-bottom: 4px; }
.overview-strip strong { font-size: 20px; font-weight: 650; font-variant-numeric: tabular-nums; line-height: 1.3; }
.overview-strip small { color: var(--stone-500); font-size: 10px; font-weight: 400; margin-left: 7px; }
.overview-strip p { margin-left: auto; display: flex; align-items: center; gap: 6px; color: var(--stone-500); font-size: 11px; }
.workspace { display: grid; grid-template-columns: 270px minmax(0, 1fr) 270px; gap: 18px; align-items: start; }
.workspace-note { display: flex; justify-content: space-between; gap: 14px; margin-top: 18px; font-size: 10px; color: var(--stone-500); }
.workspace-note > span { display: flex; align-items: center; gap: 5px; }
.app-footer { display: flex; align-items: center; gap: 14px; padding: 22px 40px; border-top: 1px solid var(--line); max-width: 1520px; margin: 0 auto; font-size: 10px; color: var(--stone-400); }
.footer-brand { font-size: 15px; color: var(--stone-500); font-weight: 650; }
@media (max-width: 1199px) { .header-inner { padding-inline: 24px; } .main-content { padding-inline: 24px; } .workspace { grid-template-columns: 250px minmax(0, 1fr); } .workspace > :last-child { grid-column: 1 / -1; } .overview-strip > div { padding-right: 25px; margin-right: 25px; } }
@media (max-width: 700px) { .header-inner { height: 64px; padding: 0 16px; } .brand-description, .brand-divider, .local-indicator, .intro-note { display: none; } .main-content { padding: 25px 14px 20px; } .intro { margin-bottom: 20px; } .overview-strip { padding: 14px; justify-content: space-between; gap: 6px; } .overview-strip > div { margin: 0; padding: 0; border: none; } .overview-strip strong { font-size: 18px; } .overview-strip p { display: none; } .workspace { grid-template-columns: minmax(0, 1fr); } .workspace > :last-child { grid-column: auto; } .workspace-note > span:last-child { display: none; } .app-footer { padding: 20px 16px; } .app-footer > span:last-child { display: none; } }
</style>
