<script setup lang="ts">
import { computed } from 'vue'
import { renderMarkdownToHtml } from '../utils/renderMarkdown'
import 'github-markdown-css/github-markdown.css'
import 'highlight.js/styles/github.css'

const props = defineProps<{
  source: string
}>()

const html = computed(() => renderMarkdownToHtml(props.source))
</script>

<template>
  <div class="preview-scroll">
    <article id="md-live-preview" class="markdown-body md-preview-inner" v-html="html" />
  </div>
</template>

<style scoped>
.preview-scroll {
  flex: 1;
  min-height: 0;
  height: 100%;
  overflow: auto;
  box-sizing: border-box;
}

.md-preview-inner {
  padding: 1rem 1.25rem 2.5rem;
  max-width: 52rem;
  margin: 0 auto;
  min-height: 100%;
  box-sizing: border-box;
  border-radius: 0 0 var(--app-radius-sm) var(--app-radius-sm);
}

@media (prefers-color-scheme: dark) {
  .md-preview-inner :deep(.hljs) {
    background: #0d1117;
    color: #e6edf3;
  }
}
</style>
