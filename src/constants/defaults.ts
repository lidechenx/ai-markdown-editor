/** 新建文档时的默认示例正文（Markdown） */
export const DEFAULT_MARKDOWN_DOCUMENT = `# 欢迎使用 AI Markdown 新手编辑器

在左侧输入 **Markdown**，右侧会**实时预览**。

## 复制粘贴

- **图片**：截图后在本页编辑器里 \`Ctrl + V\`，会自动插入图片语法（适合 MVP，长文档建议后续接图床）。
- **代码**：从 VS Code 等工具**复制代码**再粘贴即可；也可用下方「语法速查」插入带语言的空代码块。

## 导出

点击顶部 **导出 PDF**，使用浏览器的打印对话框选择「另存为 PDF」。

---

祝写作愉快！`

/** 默认 OpenAI 兼容接口根路径（可自行改为代理或其它厂商） */
export const DEFAULT_AI_BASE_URL = 'https://api.openai.com/v1'

/** 默认模型名（可在侧栏修改） */
export const DEFAULT_AI_MODEL = 'gpt-4o-mini'

/** 自动保存防抖毫秒 */
export const EDITOR_SAVE_DEBOUNCE_MS = 400

/** AI 润色请求温度 */
export const AI_POLISH_TEMPERATURE = 0.4

/** 错误响应体截取长度（避免界面过长） */
export const AI_ERROR_BODY_PREVIEW_CHARS = 400
