# AI Markdown 新手编辑器

[![Vue 3](https://img.shields.io/badge/Vue-3-42b883?logo=vuedotjs)](https://vuejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178c6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-5-646cff?logo=vite&logoColor=white)](https://vitejs.dev/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)

面向**不熟悉 Markdown 的初学者**的网页端编辑器：边写边看效果、少记语法、可粘贴图片与代码、可借助 AI 润色，并支持把内容交给打印或文件继续使用。

若本项目对你有帮助，欢迎在 GitHub 点 **Star**，便于接收更新动态。

**仓库**：https://github.com/lidechenx/ai-markdown-editor  

**在线体验**：克隆仓库后本地运行（见下文）。若你已部署到静态托管，可将演示链接写进本段并提交 PR。

---

## 项目目的

- **降低 Markdown 使用门槛**：用「实时预览 + 语法速查 + 模板一键插入」减少查文档的时间。
- **写作体验更友好**：粘贴截图插入**单行**内嵌图 `![说明](<data:…>)`，避免「正文引用 + 文末定义」两段难以维护；原文区用**芯片**折叠长 data URL，**预览区**由 markdown-it 正常渲染图片。
- **可选 AI 辅助**：选中一段文字即可调用 OpenAI **兼容**接口做轻量润色（需自行配置 Key，且仅存本机浏览器）。
- **数据留在本地**：默认无账号、无服务端；正文与偏好存在浏览器，适合草稿、笔记、作业稿。

本项目是 **MVP（最小可用产品）**，复杂能力（图床、协同、Word 导出、RAG 等）有意延后，优先把核心读写体验做稳。

---

## 功能一览

| 功能 | 说明 |
|------|------|
| **实时预览** | 左侧或右侧分栏展示渲染结果（可左右互换、拖动中间条调节比例）。 |
| **独立滚动** | 原文区与预览区各自滚动，互不抢滚动条。 |
| **粘贴 / 拖拽图片** | 插入**单行** `![说明](<data:image/…>)`，一次删除整行即可移除图片；仍兼容手写引用式 `![说明][id]` + `[id]: …`。 |
| **原文区嵌入展示** | 对 data/blob 相关语法使用 CodeMirror 装饰为**芯片**（图标 + 短文案），**不**在编辑器内加载 Base64 栅格图；底层存储仍是标准 Markdown。 |
| **粘贴代码** | 直接粘贴即可；语法面板可插入带语言的代码块模板。 |
| **语法速查** | 侧栏常用模板，点击插入；支持**隐藏**。 |
| **AI 润色（可选）** | 配置 Base URL、模型、API Key；选中片段润色，可再替换选区；侧栏支持**隐藏**。 |
| **导入 Markdown** | 顶部「打开 Markdown…」选择 `.md` / `.txt` 等载入。 |
| **导出 Markdown** | 下载当前正文为 `document.md`。 |
| **导出 PDF** | 通过浏览器打印对话框「另存为 PDF」；打印时自动隐藏工具栏与编辑区。 |
| **布局记忆** | 预览左右、分栏比例、语法/AI 显隐等写入 `localStorage`（键前缀 `md-editor-mvp:`）。 |

---

## 技术栈

- **Vue 3**（`<script setup>`）+ **TypeScript**
- **Vite 5**
- **CodeMirror 6**（`vue-codemirror6`）+ Markdown 语言包
- **markdown-it** + **highlight.js** 渲染与高亮
- **github-markdown-css** 预览排版
- **Vitest 2** 单元测试

---

## 快速开始

```bash
git clone https://github.com/lidechenx/ai-markdown-editor.git
cd ai-markdown-editor
npm install
npm run dev
```

浏览器打开终端里提示的本地地址（一般为 `http://localhost:5173`）。

### 构建生产包

```bash
npm run build
```

产物在 `dist/`，可部署到任意静态站点托管。

### 运行测试

```bash
npm run test
```

当前包含 Markdown 渲染、图片粘贴与原文嵌入扫描等相关单元测试。

---

## 文档

- **[图片粘贴与原文展示（解决记录）](./docs/image-paste-and-editor-display.md)**：引用式 vs 行内粘贴、装饰策略与测试入口。
- **[参与贡献](./CONTRIBUTING.md)**：本地开发与提交流程。

---

## 使用说明（简要）

1. **分栏**：顶部可切换「预览在左/在右」，拖动中间分隔条调整宽度；窄屏下为上下分栏。  
2. **语法 / AI**：顶部可分别「隐藏/显示语法速查」与「隐藏/显示 AI 润色」；两者都关时中间编辑区占满宽度。  
3. **图片**：截图后在编辑器内 `Ctrl+V`，得到单行内嵌图；**请勿在公共电脑**粘贴含隐私的截图。  
4. **AI**：需自备 OpenAI 兼容服务；API Key 仅保存在本机 `localStorage`。  
5. **PDF**：「导出 PDF（打印）」→ 在打印对话框选择「另存为 PDF」。

---

## 数据与隐私

- 正文、布局偏好、AI 配置（含 Key）默认保存在浏览器 **localStorage**，**清除站点数据会丢失**，请自行做好备份或定期「导出 Markdown」。  
- 本项目**不**收集遥测；AI 请求从你浏览器直连你配置的接口。

---

## 已知限制与后续方向

- **无图床**：大图片会让 Markdown 体积膨胀；后续可接对象存储与短链。  
- **无 Word 原生导出**：当前以 Markdown + 打印 PDF 为主。  
- **无协同与账号**：多设备同步需自行导出或后续扩展。  
- **超大文档**：超过约 60 万字符时，为性能会关闭原文区嵌入装饰扫描。

欢迎提 Issue / PR。

---

## 如何让更多人发现本项目（合规建议）

Star 数量来自真实用户的认可，无法也不应通过刷量操纵。你可以从下面这些**合规、可持续**的做法入手：

1. **为仓库添加 Topics**（仓库主页 → About → ⚙）：例如 `markdown-editor`、`vue`、`codemirror`、`markdown-it`、`wysiwyg`、`note-taking`、`中文` 等，便于他人搜索。  
2. **补一张演示截图或 GIF**（可放在 `docs/` 并在 README 顶部引用），一眼说明产品价值。  
3. **写短文或动态**：介绍你的使用场景（笔记、作业、技术文档）并附上仓库链接。  
4. **参与 Awesome 类列表**：若列表接受自荐且符合收录标准，可提交 PR 把本仓库加进去。  
5. **保持 Issue / PR 响应**：小问题及时修，会带动口碑与二次传播。

请勿参与互刷 Star、虚假流量等违反 [GitHub 社区准则](https://docs.github.com/en/site-policy/github-terms/github-community-code-of-conduct) 的行为，以免仓库面临风险。

---

## 许可

本项目以 **MIT License** 发布，见仓库根目录 [LICENSE](./LICENSE)。
