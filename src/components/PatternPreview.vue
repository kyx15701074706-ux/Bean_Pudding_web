<script setup lang="ts">
import { computed, onMounted, onScopeDispose, shallowRef, useTemplateRef, watch } from 'vue'
import { Grid2X2, Image, Minus, Plus, Maximize, ScanLine } from '@lucide/vue'
import { AXIS_SIZE, CELL_SIZE, drawOverview, drawPattern, overviewSize } from '../lib/render'
import { PAGE_SIZE, pageCount, regionAt } from '../lib/tiles'
import { cn } from '../lib/cn'
import type { Pattern, SourceImage } from '../lib/types'

const props = defineProps<{ pattern: Pattern | null; source: SourceImage | null; busy: boolean; dirty: boolean }>()
const mode = shallowRef<'pattern' | 'source'>('pattern')
const numbers = shallowRef(true)
const grid = shallowRef(true)
const zoom = shallowRef(100)
const overview = shallowRef(false)
const pageRow = shallowRef(1)
const pageColumn = shallowRef(1)
const viewportWidth = shallowRef(600)
const viewportHeight = shallowRef(580)
const viewport = useTemplateRef<HTMLElement>('viewport')
const canvas = useTemplateRef<HTMLCanvasElement>('canvas')
let observer: ResizeObserver | undefined

const large = computed(() => !!props.pattern && pageCount(props.pattern.width, props.pattern.height) > 1)
const pageRows = computed(() => Math.ceil((props.pattern?.height ?? 32) / PAGE_SIZE))
const pageColumns = computed(() => Math.ceil((props.pattern?.width ?? 32) / PAGE_SIZE))
const region = computed(() => regionAt(props.pattern?.width ?? 32, props.pattern?.height ?? 32, pageColumn.value - 1, pageRow.value - 1))
const canvasSize = computed(() => overview.value && props.pattern ? overviewSize(props.pattern) : {
  width: region.value.width * CELL_SIZE + AXIS_SIZE * 2,
  height: region.value.height * CELL_SIZE + AXIS_SIZE * 2,
})
const scale = computed(() => Math.min((viewportWidth.value - 40) / canvasSize.value.width, (viewportHeight.value - 40) / canvasSize.value.height, overview.value ? Infinity : 1) * zoom.value / 100)
const canvasStyle = computed(() => ({ width: `${canvasSize.value.width * scale.value}px`, height: `${canvasSize.value.height * scale.value}px` }))

function changePage(axis: 'row' | 'column', raw: string) {
  const value = Number(raw)
  if (!Number.isSafeInteger(value)) return
  if (axis === 'row') pageRow.value = Math.max(1, Math.min(pageRows.value, value))
  else pageColumn.value = Math.max(1, Math.min(pageColumns.value, value))
}

function redraw() {
  if (!canvas.value || !props.pattern) return
  if (overview.value) drawOverview(canvas.value, props.pattern)
  else drawPattern(canvas.value, props.pattern, { numbers: numbers.value, grid: grid.value, region: region.value })
}
watch([() => props.pattern, numbers, grid, canvas, overview, region], redraw, { flush: 'post' })
watch(() => props.pattern, () => {
  zoom.value = 100
  mode.value = 'pattern'
  pageRow.value = 1
  pageColumn.value = 1
  overview.value = large.value
})
onMounted(() => {
  if (viewport.value) {
    observer = new ResizeObserver(([entry]) => {
      viewportWidth.value = entry.contentRect.width
      viewportHeight.value = entry.contentRect.height
    })
    observer.observe(viewport.value)
  }
  redraw()
})
onScopeDispose(() => observer?.disconnect())
</script>

<template>
  <section class="preview-panel panel" aria-label="图纸预览" :aria-busy="busy">
    <div class="preview-header"><div class="section-heading mb-0"><span class="step-number">03</span><h2>图纸预览</h2></div><span v-if="pattern" class="size-label">{{ pattern.width }} × {{ pattern.height }} 格</span></div>
    <div class="preview-toolbar">
      <div class="view-switch" role="group" aria-label="预览内容"><button type="button" :class="cn('view-button', mode === 'pattern' && 'is-active')" :aria-pressed="mode === 'pattern'" @click="mode = 'pattern'"><Grid2X2 :size="14" />拼豆图纸</button><button type="button" :class="cn('view-button', mode === 'source' && 'is-active')" :aria-pressed="mode === 'source'" @click="mode = 'source'"><Image :size="14" />原图</button></div>
      <div v-if="mode === 'pattern'" class="display-options"><label><input v-model="numbers" type="checkbox" :disabled="overview">编号</label><label><input v-model="grid" type="checkbox" :disabled="overview">网格</label></div>
    </div>
    <div v-if="large && mode === 'pattern'" class="region-toolbar">
      <label class="region-mode"><input v-model="overview" type="checkbox">全图总览</label>
      <template v-if="!overview"><label>分区行 <input :value="pageRow" type="number" min="1" :max="pageRows" aria-label="分区行" @input="changePage('row', ($event.target as HTMLInputElement).value)"> / {{ pageRows }}</label><label>分区列 <input :value="pageColumn" type="number" min="1" :max="pageColumns" aria-label="分区列" @input="changePage('column', ($event.target as HTMLInputElement).value)"> / {{ pageColumns }}</label></template>
      <span v-else>总览查看整体，取消勾选查看分区编号</span>
    </div>
    <div ref="viewport" class="preview-viewport">
      <div v-if="busy" class="processing-status" role="status">正在为每一格匹配豆色…</div>
      <div v-if="mode === 'pattern' && pattern" class="canvas-layout"><canvas ref="canvas" :style="canvasStyle" class="chart-canvas" role="img" :aria-label="overview ? `${pattern.width}列、${pattern.height}行拼豆图纸总览` : `拼豆图纸：列${region.x + 1}至${region.x + region.width}、行${region.y + 1}至${region.y + region.height}，含编号与全局坐标`"></canvas></div>
      <div v-else-if="source && mode === 'source'" class="original-layout"><img :src="source.url" alt="原始图片，可切换拼豆图纸对照查看" class="original-image"></div>
      <div v-else class="empty-preview"><ScanLine :size="40" stroke-width="1" /><p>你的下一幅拼豆作品，从这里开始</p><span>上传图片，即可自动生成图纸</span></div>
    </div>
    <div class="preview-footer"><span class="preview-tip">{{ dirty ? '设置已修改，请重新生成图纸' : overview ? '总览为缩略效果，查看编号请切换分区' : '坐标对应整张图纸，五格一条加粗线' }}</span><div class="zoom-controls"><button type="button" class="icon-button" aria-label="缩小图纸" :disabled="zoom <= 50 || mode !== 'pattern'" @click="zoom -= 25"><Minus :size="15" /></button><output aria-label="缩放比例" class="zoom-label">{{ zoom }}%</output><button type="button" class="icon-button" aria-label="放大图纸" :disabled="zoom >= 400 || mode !== 'pattern'" @click="zoom += 25"><Plus :size="15" /></button><span class="zoom-divider"></span><button type="button" class="icon-button" aria-label="适应画布" title="适应画布" @click="zoom = 100"><Maximize :size="15" /></button></div></div>
  </section>
</template>

<style scoped>
.preview-panel { min-width: 0; overflow: hidden; }
.preview-header { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 23px 22px 19px; }
.size-label { color: var(--stone-500); background: var(--stone-100); border-radius: 5px; padding: 5px 8px; font-size: 11px; font-variant-numeric: tabular-nums; white-space: nowrap; }
.preview-toolbar { display: flex; justify-content: space-between; align-items: center; gap: 8px; padding: 0 20px 16px; border-bottom: 1px solid var(--line); }
.view-switch { display: flex; padding: 3px; border-radius: 7px; background: var(--stone-100); }
.view-button { display: flex; align-items: center; gap: 5px; padding: 6px 10px; border: 0; border-radius: 5px; color: var(--stone-500); background: none; font-size: 12px; cursor: pointer; }
.view-button.is-active { background: white; color: var(--stone-800); box-shadow: var(--shadow-sm); }
.display-options { display: flex; gap: 12px; font-size: 11px; color: var(--stone-600); }
.display-options label { display: flex; align-items: center; gap: 5px; cursor: pointer; }
.region-toolbar { display: flex; flex-wrap: wrap; align-items: center; gap: 12px; padding: 10px 20px; border-bottom: 1px solid var(--line); font-size: 11px; color: var(--stone-600); }
.region-toolbar label { display: flex; align-items: center; gap: 5px; }
.region-toolbar input[type='number'] { width: 50px; border: 1px solid var(--stone-200); border-radius: 4px; padding: 4px; background: white; }
.preview-viewport { height: 554px; overflow: auto; background: var(--stone-100); position: relative; }
.canvas-layout { width: max-content; min-width: 100%; min-height: 100%; padding: 20px; display: flex; align-items: flex-start; justify-content: center; }
.chart-canvas { display: block; box-shadow: var(--shadow-sm); background: white; max-width: none; }
.original-layout { height: 100%; display: grid; place-items: center; padding: 32px; }
.original-image { max-width: 100%; max-height: 100%; object-fit: contain; image-rendering: pixelated; }
.processing-status { position: sticky; top: 8px; z-index: 10; margin: 8px auto -38px; padding: 10px 16px; width: fit-content; border: 1px solid var(--orange-200); background: var(--orange-50); color: var(--orange-700); border-radius: 8px; font-size: 12px; }
.empty-preview { height: 100%; padding: 20px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 12px; color: var(--stone-400); }
.empty-preview p { color: var(--stone-600); font-size: 14px; text-align: center; }
.empty-preview span { font-size: 12px; }
.preview-footer { display: flex; justify-content: space-between; align-items: center; padding: 10px 16px; gap: 8px; border-top: 1px solid var(--line); }
.preview-tip { font-size: 11px; color: var(--stone-500); }
.zoom-controls { display: flex; align-items: center; gap: 2px; }
.zoom-label { width: 40px; text-align: center; color: var(--stone-600); font-size: 11px; font-variant-numeric: tabular-nums; }
.zoom-divider { width: 1px; height: 16px; margin: 0 6px; background: var(--line); }
@media (max-width: 600px) { .preview-viewport { height: 440px; } .preview-toolbar { padding-inline: 12px; } .preview-tip { max-width: 130px; line-height: 1.6; } }
</style>
