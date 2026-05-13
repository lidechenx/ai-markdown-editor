<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import MdEditor from './components/MdEditor.vue'
import MdPreview from './components/MdPreview.vue'
import SyntaxPanel from './components/SyntaxPanel.vue'
import {
  DEFAULT_AI_BASE_URL,
  DEFAULT_AI_MODEL,
  DEFAULT_MARKDOWN_DOCUMENT,
  DEFAULT_SPLIT_PERCENT,
  EDITOR_SAVE_DEBOUNCE_MS,
  LAYOUT_NARROW_MAX_PX,
  MARKDOWN_EXPORT_FILENAME,
  MARKDOWN_EXPORT_MIME,
  SPLIT_PERCENT_MAX,
  SPLIT_PERCENT_MIN,
} from './constants/defaults'
import {
  STORAGE_AI_API_KEY,
  STORAGE_AI_BASE_URL,
  STORAGE_AI_MODEL,
  STORAGE_AI_PANEL_VISIBLE,
  STORAGE_EDITOR_DOC,
  STORAGE_PREVIEW_FIRST,
  STORAGE_SPLIT_PERCENT,
  STORAGE_SYNTAX_VISIBLE,
} from './constants/storageKeys'
import { polishMarkdownSelection } from './utils/aiPolish'

/** 编辑器对外暴露的最小能力（与 MdEditor defineExpose 对齐） */
interface EditorApi {
  insertOrReplace: (text: string) => void
  getSelection: () => string
  replaceSelection: (text: string) => void
}

const doc = ref('')

const editorRef = ref<EditorApi | null>(null)

const aiBaseUrl = ref(DEFAULT_AI_BASE_URL)
const aiModel = ref(DEFAULT_AI_MODEL)
const aiApiKey = ref('')
const aiBusy = ref(false)
const aiHint = ref('')
const aiDraft = ref('')

/** 预览是否在左侧（与原文左右互换） */
const previewOnLeft = ref(false)

/** 是否显示语法速查区块 */
const syntaxVisible = ref(true)

/** 是否显示 AI 润色配置区 */
const aiPanelVisible = ref(true)

/** 首块（flex 第一列/行）所占比例 0–100 */
const splitPercent = ref(DEFAULT_SPLIT_PERCENT)

const splitRowRef = ref<HTMLElement | null>(null)
const mdImportRef = ref<HTMLInputElement | null>(null)

const isNarrow = ref(false)
let narrowMq: MediaQueryList | null = null

const splitRowStyle = computed(() => ({
  '--split-frac': String(splitPercent.value / 100),
}))

const workspaceClasses = computed(() => ({
  'workspace--compact': !syntaxVisible.value && aiPanelVisible.value,
  'workspace--compact-ai': syntaxVisible.value && !aiPanelVisible.value,
  'workspace--full': !syntaxVisible.value && !aiPanelVisible.value,
}))

let saveTimer: ReturnType<typeof setTimeout> | undefined

/**
 * 将分栏比例限制在可配置区间内。
 */
function clampSplitPercent(value: number): number {
  return Math.min(SPLIT_PERCENT_MAX, Math.max(SPLIT_PERCENT_MIN, value))
}

/**
 * 根据指针位置更新分栏比例（横屏按宽度，窄屏纵向按高度）。
 */
function updateSplitFromPointer(clientX: number, clientY: number) {
  const el = splitRowRef.value
  if (!el) return
  const rect = el.getBoundingClientRect()
  let pct: number
  if (isNarrow.value) {
    pct = ((clientY - rect.top) / Math.max(rect.height, 1)) * 100
  } else {
    pct = ((clientX - rect.left) / Math.max(rect.width, 1)) * 100
  }
  splitPercent.value = clampSplitPercent(pct)
}

/**
 * 开始拖动中间分隔条以调整原文/预览占比。
 */
function onSplitterPointerDown(e: PointerEvent) {
  e.preventDefault()
  const move = (ev: PointerEvent) => {
    updateSplitFromPointer(ev.clientX, ev.clientY)
  }
  const up = () => {
    document.removeEventListener('pointermove', move)
    document.removeEventListener('pointerup', up)
    document.removeEventListener('pointercancel', up)
    persistLayout()
  }
  document.addEventListener('pointermove', move)
  document.addEventListener('pointerup', up)
  document.addEventListener('pointercancel', up)
}

/**
 * 从浏览器本地存储恢复文档、布局与 AI 配置。
 */
function loadFromStorage() {
  const saved = localStorage.getItem(STORAGE_EDITOR_DOC)
  doc.value = saved && saved.trim() ? saved : DEFAULT_MARKDOWN_DOCUMENT

  aiBaseUrl.value = localStorage.getItem(STORAGE_AI_BASE_URL) ?? DEFAULT_AI_BASE_URL
  aiModel.value = localStorage.getItem(STORAGE_AI_MODEL) ?? DEFAULT_AI_MODEL
  aiApiKey.value = localStorage.getItem(STORAGE_AI_API_KEY) ?? ''

  previewOnLeft.value = localStorage.getItem(STORAGE_PREVIEW_FIRST) === '1'
  syntaxVisible.value = localStorage.getItem(STORAGE_SYNTAX_VISIBLE) !== '0'
  aiPanelVisible.value = localStorage.getItem(STORAGE_AI_PANEL_VISIBLE) !== '0'

  const rawSplit = localStorage.getItem(STORAGE_SPLIT_PERCENT)
  if (rawSplit) {
    const n = Number.parseFloat(rawSplit)
    if (!Number.isNaN(n)) {
      splitPercent.value = clampSplitPercent(n)
    }
  }
}

/**
 * 将当前正文写入本地存储（防抖由调用方控制）。
 */
function persistDocument() {
  localStorage.setItem(STORAGE_EDITOR_DOC, doc.value)
}

/**
 * 将布局偏好写入本地存储。
 */
function persistLayout() {
  localStorage.setItem(STORAGE_PREVIEW_FIRST, previewOnLeft.value ? '1' : '0')
  localStorage.setItem(STORAGE_SYNTAX_VISIBLE, syntaxVisible.value ? '1' : '0')
  localStorage.setItem(STORAGE_AI_PANEL_VISIBLE, aiPanelVisible.value ? '1' : '0')
  localStorage.setItem(STORAGE_SPLIT_PERCENT, String(splitPercent.value))
}

/**
 * 将 AI 相关配置写入本地存储。
 */
function persistAiSettings() {
  localStorage.setItem(STORAGE_AI_BASE_URL, aiBaseUrl.value.trim() || DEFAULT_AI_BASE_URL)
  localStorage.setItem(STORAGE_AI_MODEL, aiModel.value.trim() || DEFAULT_AI_MODEL)
  localStorage.setItem(STORAGE_AI_API_KEY, aiApiKey.value)
}

/**
 * 打开浏览器打印对话框，用户可选择「另存为 PDF」。
 */
function exportPdf() {
  window.print()
}

/**
 * 将当前正文下载为 .md 文件。
 */
function exportMarkdownFile() {
  const blob = new Blob([doc.value], { type: MARKDOWN_EXPORT_MIME })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = MARKDOWN_EXPORT_FILENAME
  a.rel = 'noopener'
  a.click()
  URL.revokeObjectURL(url)
}

/**
 * 触发隐藏的文件选择器以导入 Markdown。
 */
function openImportMarkdown() {
  mdImportRef.value?.click()
}

/**
 * 读取用户选择的 Markdown 文本并写入编辑器。
 */
function onImportMarkdown(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  const reader = new FileReader()
  reader.onload = () => {
    doc.value = typeof reader.result === 'string' ? reader.result : ''
    input.value = ''
  }
  reader.onerror = () => {
    input.value = ''
  }
  reader.readAsText(file, 'UTF-8')
}

/**
 * 切换预览区与原文的左右位置。
 */
function togglePreviewSide() {
  previewOnLeft.value = !previewOnLeft.value
  persistLayout()
}

/**
 * 显示或隐藏语法速查区域。
 */
function toggleSyntaxPanel() {
  syntaxVisible.value = !syntaxVisible.value
  persistLayout()
}

/**
 * 显示或隐藏 AI 润色区域。
 */
function toggleAiPanel() {
  aiPanelVisible.value = !aiPanelVisible.value
  persistLayout()
}

/**
 * 语法面板选中模板后插入到编辑器光标处。
 */
function onSyntaxPick(template: string) {
  editorRef.value?.insertOrReplace(template)
}

/**
 * 请求 AI 润色当前选中的 Markdown 片段。
 */
async function runAiPolish() {
  aiHint.value = ''
  aiDraft.value = ''
  aiBusy.value = true
  const selection = editorRef.value?.getSelection() ?? ''
  const result = await polishMarkdownSelection({
    baseUrl: aiBaseUrl.value,
    apiKey: aiApiKey.value,
    model: aiModel.value,
    selection,
  })
  aiBusy.value = false
  if (result.ok) {
    aiDraft.value = result.content
    aiHint.value = '已生成润色结果，确认后可替换选区内容。'
  } else {
    aiHint.value = result.message
  }
}

/**
 * 用 AI 生成结果替换编辑器当前选区。
 */
function applyAiDraftToSelection() {
  if (!aiDraft.value.trim()) {
    aiHint.value = '暂无可应用的润色结果。'
    return
  }
  editorRef.value?.replaceSelection(aiDraft.value)
  aiHint.value = '已替换选区。'
}

function onNarrowMqChange() {
  if (narrowMq) isNarrow.value = narrowMq.matches
}

onMounted(() => {
  loadFromStorage()
  narrowMq = window.matchMedia(`(max-width: ${LAYOUT_NARROW_MAX_PX}px)`)
  isNarrow.value = narrowMq.matches
  narrowMq.addEventListener('change', onNarrowMqChange)
})

onUnmounted(() => {
  narrowMq?.removeEventListener('change', onNarrowMqChange)
})

watch(
  doc,
  () => {
    clearTimeout(saveTimer)
    saveTimer = setTimeout(() => {
      persistDocument()
    }, EDITOR_SAVE_DEBOUNCE_MS)
  },
  { flush: 'post' },
)

watch([aiBaseUrl, aiModel, aiApiKey], persistAiSettings, { deep: true })
</script>

<template>
  <div class="shell">
    <header class="top no-print">
      <div class="brand">
        <span class="brand-mark" aria-hidden="true">Md</span>
        <div class="brand-text">
          <h1 class="brand-title">AI Markdown 新手编辑器</h1>
          <p class="brand-sub">实时预览 · 可调布局 · 导入/导出 .md</p>
        </div>
      </div>
      <nav class="top-actions" aria-label="工具栏">
        <div class="tbar-group">
          <button type="button" class="btn" @click="togglePreviewSide">
            {{ previewOnLeft ? '预览改到右侧' : '预览改到左侧' }}
          </button>
          <button type="button" class="btn" @click="toggleSyntaxPanel">
            {{ syntaxVisible ? '隐藏语法速查' : '显示语法速查' }}
          </button>
          <button type="button" class="btn" @click="toggleAiPanel">
            {{ aiPanelVisible ? '隐藏 AI 润色' : '显示 AI 润色' }}
          </button>
        </div>
        <span class="tbar-sep" aria-hidden="true" />
        <div class="tbar-group">
          <button type="button" class="btn" @click="openImportMarkdown">打开 Markdown…</button>
          <button type="button" class="btn" @click="exportMarkdownFile">导出 Markdown</button>
          <button type="button" class="btn primary" @click="exportPdf">导出 PDF（打印）</button>
        </div>
        <input
          ref="mdImportRef"
          class="sr-only"
          type="file"
          accept=".md,.markdown,.txt,text/markdown,text/plain"
          @change="onImportMarkdown"
        />
      </nav>
    </header>

    <div class="workspace" :class="workspaceClasses">
      <div class="center">
        <div
          ref="splitRowRef"
          class="split-row"
          :class="{ narrow: isNarrow }"
          :style="splitRowStyle"
        >
          <template v-if="!previewOnLeft">
            <section class="pane pane-first editor-pane no-print" aria-label="Markdown 源码">
              <div class="pane-head">
                <span class="pane-label">原文</span>
              </div>
              <div class="pane-scroll">
                <MdEditor ref="editorRef" v-model="doc" class="pane-editor" />
              </div>
            </section>
            <div
              class="splitter"
              role="separator"
              :aria-orientation="isNarrow ? 'horizontal' : 'vertical'"
              aria-label="拖动调整原文与预览区域大小"
              tabindex="0"
              @pointerdown="onSplitterPointerDown"
            />
            <section class="pane pane-rest preview-pane print-area" aria-label="渲染预览">
              <div class="pane-head no-print">
                <span class="pane-label">预览</span>
              </div>
              <div class="pane-scroll">
                <MdPreview :source="doc" />
              </div>
            </section>
          </template>
          <template v-else>
            <section class="pane pane-first preview-pane print-area" aria-label="渲染预览">
              <div class="pane-head no-print">
                <span class="pane-label">预览</span>
              </div>
              <div class="pane-scroll">
                <MdPreview :source="doc" />
              </div>
            </section>
            <div
              class="splitter"
              role="separator"
              :aria-orientation="isNarrow ? 'horizontal' : 'vertical'"
              aria-label="拖动调整原文与预览区域大小"
              tabindex="0"
              @pointerdown="onSplitterPointerDown"
            />
            <section class="pane pane-rest editor-pane no-print" aria-label="Markdown 源码">
              <div class="pane-head">
                <span class="pane-label">原文</span>
              </div>
              <div class="pane-scroll">
                <MdEditor ref="editorRef" v-model="doc" class="pane-editor" />
              </div>
            </section>
          </template>
        </div>
      </div>

      <aside
        v-if="syntaxVisible || aiPanelVisible"
        class="rail no-print"
        :class="{ 'rail--compact': syntaxVisible !== aiPanelVisible }"
        aria-label="语法与 AI"
      >
        <div v-show="syntaxVisible" class="syntax-block">
          <SyntaxPanel @pick="onSyntaxPick" />
        </div>

        <div v-show="aiPanelVisible" class="ai-card">
          <h2 class="ai-title">AI 润色（可选）</h2>
          <p class="ai-lead">
            使用 OpenAI 兼容接口。Key 仅存于本机浏览器，请勿在公共电脑填写。
          </p>
          <label class="field">
            <span class="field-label">接口 Base URL</span>
            <input v-model="aiBaseUrl" class="field-input" type="url" autocomplete="off" />
          </label>
          <label class="field">
            <span class="field-label">模型</span>
            <input v-model="aiModel" class="field-input" type="text" autocomplete="off" />
          </label>
          <label class="field">
            <span class="field-label">API Key</span>
            <input
              v-model="aiApiKey"
              class="field-input"
              type="password"
              autocomplete="off"
              placeholder="sk-…"
            />
          </label>
          <div class="ai-actions">
            <button type="button" class="btn" :disabled="aiBusy" @click="runAiPolish">
              {{ aiBusy ? '请求中…' : '润色选中文本' }}
            </button>
            <button type="button" class="btn ghost" :disabled="aiBusy || !aiDraft" @click="applyAiDraftToSelection">
              用结果替换选区
            </button>
          </div>
          <p v-if="aiHint" class="ai-hint" role="status">{{ aiHint }}</p>
          <textarea
            v-show="aiDraft"
            v-model="aiDraft"
            class="ai-output"
            rows="6"
            aria-label="AI 输出，可在应用前手动修改"
          />
        </div>
      </aside>
    </div>
  </div>
</template>

<style scoped>
.shell {
  height: 100vh;
  display: flex;
  flex-direction: column;
  background: var(--app-bg);
  color: var(--app-fg);
  overflow: hidden;
}

.top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 0.55rem 1.1rem;
  border-bottom: 1px solid var(--app-border);
  background: var(--app-surface);
  box-shadow: var(--app-shadow);
  flex-shrink: 0;
}

.brand {
  display: flex;
  align-items: center;
  gap: 0.65rem;
  min-width: 0;
}

.brand-mark {
  display: grid;
  place-items: center;
  width: 2.4rem;
  height: 2.4rem;
  border-radius: var(--app-radius-sm);
  background: linear-gradient(135deg, var(--app-accent), var(--app-accent-2));
  color: #fff;
  font-weight: 700;
  font-size: 0.85rem;
  flex-shrink: 0;
  box-shadow: var(--app-shadow-md);
}

.brand-text {
  min-width: 0;
}

.brand-title {
  margin: 0;
  font-size: 1.05rem;
  line-height: 1.25;
  font-weight: 600;
}

.brand-sub {
  margin: 0.1rem 0 0;
  font-size: 0.75rem;
  opacity: 0.75;
}

.top-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem 0.65rem;
  justify-content: flex-end;
  flex-shrink: 0;
  max-width: 56rem;
}

.tbar-group {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.4rem;
}

.tbar-sep {
  width: 1px;
  height: 1.35rem;
  background: var(--app-border);
  flex-shrink: 0;
  border-radius: 1px;
  opacity: 0.85;
}

.btn {
  border: 1px solid var(--app-border);
  background: var(--app-surface-2);
  color: inherit;
  border-radius: var(--app-radius-sm);
  padding: 0.42rem 0.85rem;
  font-size: 0.8125rem;
  font-weight: 500;
  cursor: pointer;
  white-space: nowrap;
  box-shadow: var(--app-shadow);
  transition:
    background 0.15s ease,
    border-color 0.15s ease,
    box-shadow 0.15s ease,
    transform 0.1s ease;
}

.btn:hover:not(:disabled) {
  background: var(--app-surface-hover);
  border-color: color-mix(in srgb, var(--app-accent) 35%, var(--app-border));
  box-shadow: var(--app-shadow-md);
}

.btn:active:not(:disabled) {
  transform: scale(0.98);
}

.btn:disabled {
  opacity: 0.55;
  cursor: not-allowed;
  box-shadow: none;
}

.btn.primary {
  background: linear-gradient(180deg, color-mix(in srgb, var(--app-accent) 92%, #fff), var(--app-accent));
  border-color: color-mix(in srgb, var(--app-accent) 70%, #1e3a8a);
  color: #fff;
}

.btn.primary:hover:not(:disabled) {
  filter: brightness(1.06);
  border-color: color-mix(in srgb, var(--app-accent) 55%, #1e40af);
}

@media (prefers-color-scheme: dark) {
  .btn.primary {
    border-color: color-mix(in srgb, var(--app-accent) 50%, #0f172a);
  }
}

.btn.ghost {
  background: transparent;
  box-shadow: none;
}

.btn.ghost:hover:not(:disabled) {
  background: var(--app-surface-hover);
}

.btn:focus-visible {
  outline: none;
  box-shadow:
    var(--app-shadow),
    0 0 0 3px color-mix(in srgb, var(--app-accent) 30%, transparent);
}

.workspace {
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(12.5rem, 20rem);
  grid-template-rows: minmax(0, 1fr);
}

.workspace--compact {
  grid-template-columns: minmax(0, 1fr) minmax(11rem, 16rem);
}

.workspace--compact-ai {
  grid-template-columns: minmax(0, 1fr) minmax(11rem, 17rem);
}

.workspace--full {
  grid-template-columns: minmax(0, 1fr);
}

.workspace--full .center {
  border-right: none;
}

.center {
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
  border-right: 1px solid var(--app-border);
  background: linear-gradient(180deg, var(--app-surface) 0%, color-mix(in srgb, var(--app-surface) 96%, var(--app-bg)) 100%);
}

.split-row {
  flex: 1;
  display: flex;
  flex-direction: row;
  min-height: 0;
  min-width: 0;
}

.split-row.narrow {
  flex-direction: column;
}

.split-row > .pane-first {
  flex: 0 0 calc((100% - 10px) * var(--split-frac));
  min-width: 0;
  min-height: 0;
}

.split-row.narrow > .pane-first {
  flex: 0 0 calc((100% - 10px) * var(--split-frac));
}

.split-row > .pane-rest {
  flex: 1 1 0;
  min-width: 0;
  min-height: 0;
}

.splitter {
  flex: 0 0 10px;
  cursor: col-resize;
  touch-action: none;
  flex-shrink: 0;
  position: relative;
  background: transparent;
}

.splitter::after {
  content: '';
  position: absolute;
  top: 18%;
  bottom: 18%;
  left: 50%;
  width: 3px;
  margin-left: -1.5px;
  border-radius: 3px;
  background: color-mix(in srgb, var(--app-border) 85%, var(--app-muted));
  transition: background 0.15s ease, width 0.15s ease;
}

.splitter:hover::after,
.splitter:focus-visible::after {
  background: var(--app-accent);
  width: 4px;
  margin-left: -2px;
}

.splitter:focus-visible {
  outline: none;
}

.split-row.narrow .splitter {
  cursor: row-resize;
}

.split-row.narrow .splitter::after {
  top: 50%;
  bottom: auto;
  left: 18%;
  right: 18%;
  width: auto;
  height: 3px;
  margin-top: -1.5px;
  margin-left: 0;
}

.split-row.narrow .splitter:hover::after,
.split-row.narrow .splitter:focus-visible::after {
  width: auto;
  height: 4px;
  margin-top: -2px;
}

.pane {
  display: flex;
  flex-direction: column;
  min-height: 0;
  min-width: 0;
  background: var(--app-surface);
}

.preview-pane {
  background: var(--app-surface);
}

.pane-head {
  flex-shrink: 0;
  padding: 0.45rem 0.75rem;
  border-bottom: 1px solid var(--app-border);
  font-size: 0.72rem;
  font-weight: 600;
  letter-spacing: 0.03em;
  text-transform: uppercase;
  color: var(--app-muted);
  background: color-mix(in srgb, var(--app-surface-2) 88%, transparent);
}

.pane-label {
  font-weight: 600;
  color: var(--app-fg);
}

.pane-scroll {
  flex: 1;
  min-height: 0;
  min-width: 0;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.pane-editor {
  flex: 1;
  min-height: 0;
}

.rail {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  padding: 0.85rem 0.9rem;
  overflow: auto;
  min-height: 0;
  background: var(--app-surface);
  box-shadow: inset 1px 0 0 var(--app-border);
}

.rail--compact {
  min-width: 0;
}

.syntax-block {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  flex-shrink: 0;
}

.ai-card {
  border: 1px solid var(--app-border);
  border-radius: var(--app-radius-sm);
  padding: 0.75rem 0.85rem;
  background: var(--app-surface-2);
  box-shadow: var(--app-shadow);
  display: flex;
  flex-direction: column;
  gap: 0.55rem;
  flex-shrink: 0;
}

.ai-title {
  margin: 0;
  font-size: 0.95rem;
  font-weight: 600;
}

.ai-lead {
  margin: 0;
  font-size: 0.75rem;
  line-height: 1.45;
  opacity: 0.8;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
  font-size: 0.75rem;
}

.field-label {
  opacity: 0.85;
}

.field-input {
  font: inherit;
  padding: 0.4rem 0.5rem;
  border-radius: var(--app-radius-sm);
  border: 1px solid var(--app-border);
  background: var(--app-input-bg);
  color: inherit;
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
}

.field-input:focus {
  outline: none;
  border-color: color-mix(in srgb, var(--app-accent) 55%, var(--app-border));
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--app-accent) 22%, transparent);
}

.ai-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
}

.ai-hint {
  margin: 0;
  font-size: 0.75rem;
  line-height: 1.4;
  color: var(--app-muted);
}

.ai-output {
  width: 100%;
  box-sizing: border-box;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 0.75rem;
  line-height: 1.4;
  border-radius: 0.35rem;
  border: 1px solid var(--app-border);
  padding: 0.4rem;
  resize: vertical;
  background: var(--app-input-bg);
  color: inherit;
}

@media (max-width: 900px) {
  .workspace {
    grid-template-columns: minmax(0, 1fr);
    grid-template-rows: minmax(0, 1fr) auto;
  }

  .center {
    border-right: none;
    border-bottom: 1px solid var(--app-border);
  }

  .rail {
    flex-direction: row;
    flex-wrap: wrap;
    align-items: flex-start;
    max-height: 40vh;
  }

  .syntax-block {
    flex: 1 1 14rem;
    max-height: 36vh;
    overflow: auto;
  }

  .ai-card {
    flex: 1 1 16rem;
  }
}
</style>
