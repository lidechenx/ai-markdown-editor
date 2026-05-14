import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vitest/config'

// https://vite.dev/config/
// 生产构建使用仓库子路径，便于部署在 https://<user>.github.io/ai-markdown-editor/
export default defineConfig(({ command }) => ({
  base: command === 'serve' ? '/' : '/ai-markdown-editor/',
  plugins: [vue()],
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
}))
