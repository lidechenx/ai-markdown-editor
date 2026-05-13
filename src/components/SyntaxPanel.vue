<script setup lang="ts">
import { SYNTAX_SNIPPETS } from '../data/syntaxSnippets'

const emit = defineEmits<{
  /** 用户选择插入一段模板 */
  pick: [template: string]
}>()

/**
 * 将模板冒泡给父组件，由编辑器插入到光标处。
 */
function onPick(template: string) {
  emit('pick', template)
}
</script>

<template>
  <div class="syntax-panel">
    <h2 class="syntax-title">语法速查</h2>
    <p class="syntax-lead">点击下方条目，会在光标处插入模板；图片也可直接 Ctrl+V。</p>
    <ul class="syntax-list">
      <li v-for="item in SYNTAX_SNIPPETS" :key="item.title" class="syntax-item">
        <button type="button" class="syntax-btn" @click="onPick(item.template)">
          <span class="syntax-btn-title">{{ item.title }}</span>
          <span v-if="item.hint" class="syntax-btn-hint">{{ item.hint }}</span>
        </button>
      </li>
    </ul>
  </div>
</template>

<style scoped>
.syntax-panel {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  min-height: 0;
}

.syntax-title {
  margin: 0;
  font-size: 1rem;
  font-weight: 600;
}

.syntax-lead {
  margin: 0;
  font-size: 0.8125rem;
  line-height: 1.45;
  opacity: 0.85;
}

.syntax-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  overflow: auto;
  flex: 1;
}

.syntax-btn {
  width: 100%;
  text-align: left;
  padding: 0.45rem 0.55rem;
  border-radius: 0.375rem;
  border: 1px solid var(--app-border);
  background: var(--app-surface-2);
  color: inherit;
  cursor: pointer;
  font: inherit;
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
  transition: background 0.15s ease, border-color 0.15s ease;
}

.syntax-btn:hover {
  background: var(--app-surface-hover);
  border-color: var(--app-accent);
}

.syntax-btn-title {
  font-weight: 500;
  font-size: 0.875rem;
}

.syntax-btn-hint {
  font-size: 0.75rem;
  opacity: 0.75;
  line-height: 1.35;
}
</style>
