<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import MdEditor from './components/MdEditor.vue'
import MdPreview from './components/MdPreview.vue'
import SyntaxPanel from './components/SyntaxPanel.vue'
import {
  DEFAULT_AI_BASE_URL,
  DEFAULT_AI_MODEL,
  DEFAULT_MARKDOWN_DOCUMENT,
  EDITOR_SAVE_DEBOUNCE_MS,
} from './constants/defaults'
import {
  STORAGE_AI_API_KEY,
  STORAGE_AI_BASE_URL,
  STORAGE_AI_MODEL,
  STORAGE_EDITOR_DOC,
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

let saveTimer: ReturnType<typeof setTimeout> | undefined

/**
 * 从浏览器本地存储恢复文档与 AI 配置。
 */
function loadFromStorage() {
  const saved = localStorage.getItem(STORAGE_EDITOR_DOC)
  doc.value = saved && saved.trim() ? saved : DEFAULT_MARKDOWN_DOCUMENT

  aiBaseUrl.value = localStorage.getItem(STORAGE_AI_BASE_URL) ?? DEFAULT_AI_BASE_URL
  aiModel.value = localStorage.getItem(STORAGE_AI_MODEL) ?? DEFAULT_AI_MODEL
  aiApiKey.value = localStorage.getItem(STORAGE_AI_API_KEY) ?? ''
}

/**
 * 将当前正文写入本地存储（防抖由调用方控制）。
 */
function persistDocument() {
  localStorage.setItem(STORAGE_EDITOR_DOC, doc.value)
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

onMounted(() => {
  loadFromStorage()
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
          <p class="brand-sub">实时预览 · 粘贴图片与代码 · 轻量 AI 润色</p>
        </div>
      </div>
      <div class="top-actions">
        <button type="button" class="btn primary" @click="exportPdf">导出 PDF（打印）</button>
      </div>
    </header>

    <div class="main-grid">
      <section class="pane editor-pane no-print" aria-label="Markdown 源码">
        <div class="pane-head">
          <span class="pane-label">原文</span>
        </div>
        <MdEditor ref="editorRef" v-model="doc" class="pane-body" />
      </section>

      <section class="pane preview-pane print-area" aria-label="渲染预览">
        <div class="pane-head no-print">
          <span class="pane-label">预览</span>
        </div>
        <MdPreview class="pane-body" :source="doc" />
      </section>

      <aside class="side no-print" aria-label="语法与 AI">
        <SyntaxPanel @pick="onSyntaxPick" />

        <div class="ai-card">
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
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  background: var(--app-bg);
  color: var(--app-fg);
}

.top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 0.65rem 1rem;
  border-bottom: 1px solid var(--app-border);
  background: var(--app-surface);
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
  width: 2.25rem;
  height: 2.25rem;
  border-radius: 0.5rem;
  background: linear-gradient(135deg, var(--app-accent), var(--app-accent-2));
  color: #fff;
  font-weight: 700;
  font-size: 0.85rem;
  flex-shrink: 0;
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
  gap: 0.5rem;
  flex-shrink: 0;
}

.btn {
  border: 1px solid var(--app-border);
  background: var(--app-surface-2);
  color: inherit;
  border-radius: 0.375rem;
  padding: 0.4rem 0.75rem;
  font-size: 0.875rem;
  cursor: pointer;
}

.btn:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.btn.primary {
  background: var(--app-accent);
  border-color: transparent;
  color: #fff;
}

.btn.ghost {
  background: transparent;
}

.main-grid {
  flex: 1;
  display: grid;
  grid-template-columns: minmax(0, 1.1fr) minmax(0, 1fr) minmax(14rem, 18rem);
  grid-template-rows: minmax(0, 1fr);
  min-height: 0;
}

.pane {
  display: flex;
  flex-direction: column;
  min-height: 0;
  border-right: 1px solid var(--app-border);
}

.preview-pane {
  border-right: 1px solid var(--app-border);
}

.pane-head {
  padding: 0.35rem 0.6rem;
  border-bottom: 1px solid var(--app-border);
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  opacity: 0.75;
}

.pane-label {
  font-weight: 600;
}

.pane-body {
  flex: 1;
  min-height: 0;
}

.side {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  padding: 0.75rem;
  overflow: auto;
  background: var(--app-surface);
}

.ai-card {
  border: 1px solid var(--app-border);
  border-radius: 0.5rem;
  padding: 0.65rem 0.75rem;
  background: var(--app-surface-2);
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
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
  padding: 0.35rem 0.45rem;
  border-radius: 0.35rem;
  border: 1px solid var(--app-border);
  background: var(--app-input-bg);
  color: inherit;
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

@media (max-width: 1100px) {
  .main-grid {
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    grid-template-rows: auto auto;
  }

  .side {
    grid-column: 1 / -1;
    flex-direction: row;
    align-items: flex-start;
    flex-wrap: wrap;
  }

  .side > :deep(.syntax-panel) {
    flex: 1 1 16rem;
  }

  .ai-card {
    flex: 1 1 18rem;
  }
}

@media (max-width: 720px) {
  .main-grid {
    grid-template-columns: 1fr;
  }

  .preview-pane {
    border-right: none;
    border-top: 1px solid var(--app-border);
    min-height: 40vh;
  }

  .editor-pane {
    min-height: 42vh;
  }

  .side {
    flex-direction: column;
  }
}
</style>
