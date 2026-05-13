<script setup lang="ts">
import { markdown } from '@codemirror/lang-markdown'
import { onMounted, ref } from 'vue'
import CodeMirror from 'vue-codemirror6'
import type { CodeMirrorExposed } from 'vue-codemirror6'
import { imagePasteDropExtension } from '../editor/imagePasteDrop'

const model = defineModel<string>({ required: true })

const cmRef = ref<CodeMirrorExposed | null>(null)

const extensions = [imagePasteDropExtension()]

/** Markdown 语言支持（单例，避免在模板中重复调用工厂） */
const markdownLang = markdown()

/**
 * 在当前选区插入文本（若有选区则替换选区内容）。
 */
function insertOrReplace(text: string) {
  cmRef.value?.replaceSelection(text)
  cmRef.value?.view?.focus()
}

/**
 * 返回当前主选区的文本，供 AI 等功能使用。
 */
function getSelection(): string {
  return cmRef.value?.getSelection() ?? ''
}

/**
 * 用给定文本替换当前选区。
 */
function replaceSelection(text: string) {
  cmRef.value?.replaceSelection(text)
  cmRef.value?.view?.focus()
}

defineExpose({
  insertOrReplace,
  getSelection,
  replaceSelection,
})

const prefersDark = ref(false)

onMounted(() => {
  const mq = window.matchMedia('(prefers-color-scheme: dark)')
  prefersDark.value = mq.matches
  mq.addEventListener('change', (e) => {
    prefersDark.value = e.matches
  })
})
</script>

<template>
  <div class="md-editor-wrap">
    <CodeMirror
      ref="cmRef"
      v-model="model"
      class="md-editor-cm"
      :lang="markdownLang"
      :extensions="extensions"
      :basic="true"
      :wrap="true"
      :tab="true"
      :dark="prefersDark"
      placeholder="在此编写 Markdown，或粘贴截图 / 代码…"
    />
  </div>
</template>

<style scoped>
.md-editor-wrap {
  min-height: 0;
  flex: 1;
  display: flex;
  flex-direction: column;
}

.md-editor-wrap :deep(.cm-editor) {
  height: 100%;
  min-height: 320px;
  font-size: 14px;
}

.md-editor-cm {
  flex: 1;
  min-height: 0;
}
</style>
