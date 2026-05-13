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
