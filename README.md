# AI Markdown 新手编辑器（MVP）

基于 **Vue 3 + TypeScript + Vite 5** 的网页端 Markdown 编辑器：实时预览、剪贴板/拖拽插入图片、语法速查、打印导出 PDF、可选 OpenAI 兼容接口润色选中文本。

## 开发与构建

```bash
npm install
npm run dev
npm run build
```

## 测试

```bash
npm run test
```

使用 **Vitest 2** 与 **Vite 5**，避免部分环境下 Vite 8 / rolldown 原生绑定缺失问题。

## 说明

- 正文与 AI 配置缓存在浏览器 `localStorage`（键前缀 `md-editor-mvp:`）。
- 导出 PDF：使用顶部「导出 PDF（打印）」在浏览器打印对话框中选择「另存为 PDF」。
