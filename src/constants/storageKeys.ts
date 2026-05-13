/**
 * 本地存储键名前缀，避免与其它站点冲突。
 */
export const STORAGE_PREFIX = 'md-editor-mvp:'

/** 编辑器正文缓存 */
export const STORAGE_EDITOR_DOC = `${STORAGE_PREFIX}document`

/** AI 接口地址（不含尾斜杠） */
export const STORAGE_AI_BASE_URL = `${STORAGE_PREFIX}ai-base-url`

/** AI 模型名 */
export const STORAGE_AI_MODEL = `${STORAGE_PREFIX}ai-model`

/** AI API Key（仅本机浏览器，请注意安全） */
export const STORAGE_AI_API_KEY = `${STORAGE_PREFIX}ai-api-key`

/** 预览区是否位于左侧（与原文左右互换） */
export const STORAGE_PREVIEW_FIRST = `${STORAGE_PREFIX}preview-first`

/** 中间分隔：首块（原文或预览）所占比例，单位 0–100 */
export const STORAGE_SPLIT_PERCENT = `${STORAGE_PREFIX}split-percent`

/** 是否显示语法速查区域 */
export const STORAGE_SYNTAX_VISIBLE = `${STORAGE_PREFIX}syntax-visible`

/** 是否显示 AI 润色配置区 */
export const STORAGE_AI_PANEL_VISIBLE = `${STORAGE_PREFIX}ai-panel-visible`
