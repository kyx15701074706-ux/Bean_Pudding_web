<script setup lang="ts">
import { computed, shallowRef } from 'vue'
import { ListFilter, Download, FileSpreadsheet, Package, Search } from '@lucide/vue'
import type { ColorUsage } from '../lib/types'

const props = defineProps<{ usage: readonly ColorUsage[]; canExport: boolean; exporting: boolean; error: string; total: number; pages: number; progress: number }>()
const emit = defineEmits<{ png: []; tiles: []; csv: []; cancel: [] }>()
const search = shallowRef('')
const sort = shallowRef('count')
const visibleUsage = computed(() => {
  const rows = props.usage.filter(({ color }) => color.code.toLowerCase().includes(search.value.toLowerCase().trim()))
  return sort.value === 'code' ? rows.sort((a, b) => a.color.code.localeCompare(b.color.code, 'en', { numeric: true })) : rows
})
</script>

<template>
  <aside class="usage-panel panel" aria-label="豆色用量和导出">
    <div class="usage-heading"><div class="flex items-center gap-2"><Package :size="17" class="muted" /><h2>备料清单</h2></div><span class="color-count">{{ usage.length }}色</span></div>
    <div class="usage-tools"><label class="search-field"><Search :size="14" /><input v-model="search" type="search" placeholder="查找豆色编号" aria-label="查找豆色编号"></label><label class="sort-control"><ListFilter :size="14" /><select v-model="sort" aria-label="豆色排序"><option value="count">按用量</option><option value="code">按编号</option></select></label></div>
    <div class="usage-table-wrap">
      <table class="usage-table"><thead><tr><th scope="col">豆色 / 编号</th><th scope="col">用量</th></tr></thead><tbody><tr v-for="row in visibleUsage" :key="row.color.code"><td><div class="color-cell"><span class="bead-swatch" :style="{ backgroundColor: row.color.hex }"></span><span><strong>{{ row.color.code }}</strong><small>{{ row.color.hex }}</small></span></div></td><td class="quantity">{{ row.count.toLocaleString() }}<span>颗</span></td></tr></tbody></table>
      <p v-if="!visibleUsage.length" class="usage-empty">{{ usage.length ? '没有找到这个豆色编号' : '生成图纸后，这里会列出用量' }}</p>
    </div>
    <div class="usage-total"><span>合计</span><strong data-testid="bead-total">{{ total.toLocaleString() }}<small>颗</small></strong></div>
    <div class="export-section">
      <button type="button" class="button-primary w-full" :disabled="!canExport || exporting" @click="emit('png')"><Download :size="16" />{{ exporting ? `正在导出 ${progress}%` : '导出整张图纸' }}<span class="button-format">PNG</span></button>
      <button v-if="pages > 1" type="button" class="button-secondary w-full mt-2" :disabled="!canExport || exporting" @click="emit('tiles')"><Download :size="16" />分区导出<span class="button-format">ZIP</span></button>
      <button type="button" class="button-secondary w-full mt-2" :disabled="!canExport || exporting" @click="emit('csv')"><FileSpreadsheet :size="16" />导出用量清单<span class="button-format">CSV</span></button>
      <button v-if="exporting" type="button" class="button-secondary w-full mt-2" @click="emit('cancel')">取消导出</button>
      <p v-if="error" class="field-error" role="alert">{{ error }}</p>
      <p class="export-note">默认保存一整张编号PNG。<br>{{ pages > 1 ? `需分页打印时，可选分区导出（${pages}张）。` : '含豆色编号、行列坐标和用量图例。' }}<br>用量清单始终统计整张图纸。</p>
    </div>
  </aside>
</template>

<style scoped>
.usage-panel { display: flex; flex-direction: column; align-self: start; overflow: hidden; }
.usage-heading { display: flex; align-items: center; justify-content: space-between; padding: 23px 20px 18px; }
.color-count { font-size: 11px; color: var(--accent); border: 1px solid var(--orange-200); background: var(--orange-50); border-radius: 5px; padding: 3px 7px; }
.usage-tools { display: flex; align-items: center; gap: 7px; padding: 0 18px 14px; }
.search-field { display: flex; align-items: center; flex: 1; min-width: 0; gap: 5px; border: 1px solid var(--stone-200); border-radius: 6px; padding: 7px; color: var(--stone-400); }
.search-field input { border: none; outline: none; width: 100%; min-width: 0; font-size: 11px; background: none; color: var(--stone-700); }
.search-field:focus-within { outline: 2px solid var(--accent); outline-offset: 2px; }
.sort-control { display: flex; align-items: center; gap: 3px; color: var(--stone-500); }
.sort-control select { width: 62px; border: none; background: white; font-size: 11px; padding: 4px 0; color: var(--stone-600); }
.usage-table-wrap { height: 370px; overflow: auto; padding: 0 20px; }
.usage-table { width: 100%; border-collapse: collapse; font-size: 12px; }
.usage-table th { position: sticky; top: 0; background: white; color: var(--stone-500); font-weight: 400; text-align: left; font-size: 10px; padding: 8px 0; border-bottom: 1px solid var(--line); }
.usage-table th:last-child { text-align: right; }
.usage-table td { padding: 11px 0; border-bottom: 1px solid var(--line); }
.color-cell { display: flex; align-items: center; gap: 10px; }
.bead-swatch { width: 27px; height: 27px; border-radius: 7px; border: 1px solid rgb(0 0 0 / 10%); flex-shrink: 0; }
.color-cell strong { display: block; font-size: 12px; font-weight: 600; }
.color-cell small { display: block; color: var(--stone-500); font-size: 9px; margin-top: 2px; font-variant-numeric: tabular-nums; }
.quantity { text-align: right; font-weight: 600; font-variant-numeric: tabular-nums; }
.quantity span { font-size: 10px; color: var(--stone-500); margin-left: 4px; font-weight: 400; }
.usage-empty { padding: 50px 0; text-align: center; font-size: 12px; color: var(--stone-500); }
.usage-total { display: flex; align-items: center; justify-content: space-between; padding: 16px 20px; border-top: 1px solid var(--line); font-size: 12px; }
.usage-total strong { font-size: 20px; font-variant-numeric: tabular-nums; }
.usage-total small { margin-left: 5px; font-size: 11px; font-weight: 400; color: var(--stone-500); }
.export-section { padding: 17px 18px 18px; background: var(--stone-50); border-top: 1px solid var(--line); }
.button-format { margin-left: auto; font-size: 10px; opacity: .8; }
.export-note { font-size: 10px; line-height: 1.8; color: var(--stone-500); margin-top: 11px; text-align: center; }
</style>
