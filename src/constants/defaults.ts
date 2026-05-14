/** 新建文档时的默认示例正文（Markdown） */
export const DEFAULT_MARKDOWN_DOCUMENT = `# 欢迎使用 AI Markdown 新手编辑器

在中间区域编辑 **Markdown**，另一侧为**实时预览**（可用顶部按钮左右互换、拖动中间分隔条调整比例）。

## 复制粘贴

- **图片**：截图后 \`Ctrl + V\` 会插入**单行**行内图 \`![说明](<data:…>)\`（整段在一行，删除一次即可整块移除）；长文档仍建议后续接图床。
- **代码**：从 VS Code 等工具**复制代码**再粘贴即可；也可用下方「语法速查」插入带语言的空代码块。

- **导出**：顶部可 **导出 Markdown 文件**，或使用 **导出 PDF（打印）**。

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

/** 分栏：首块最小占比（%） */
export const SPLIT_PERCENT_MIN = 20

/** 分栏：首块最大占比（%） */
export const SPLIT_PERCENT_MAX = 80

/** 分栏：默认首块占比（%） */
export const DEFAULT_SPLIT_PERCENT = 50

/** 窄屏断点（与样式 @media 一致），用于纵向分栏与拖拽方向 */
export const LAYOUT_NARROW_MAX_PX = 720

/** Markdown 文件 MIME（导出用） */
export const MARKDOWN_EXPORT_MIME = 'text/markdown;charset=utf-8'

/** 导出默认文件名 */
export const MARKDOWN_EXPORT_FILENAME = 'document.md'
