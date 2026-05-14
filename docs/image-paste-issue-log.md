# 粘贴图片：重复正文与预览为纯文本 — 问题与原因记录

## 1. 现象（用户描述）

- **预览区**：本应渲染为 `<img>`，却显示为与原文类似的 **Markdown 源码字符串**（引用式 `![alt][id]` 未被解析）。
- **原文区**：除正常插入内容外，在 **下方又出现一段相同或相近的代码**（重复感）。

## 2. 问题记录（待验证项）

| 编号 | 假设 | 说明 |
|------|------|------|
| H1 | 剪贴板重复条目 | 同一次 `paste` 中 `DataTransfer.files` 与 `items` 或 `items` 内多项对 **同一截图** 提供多个 `File`，循环 `insertRefImageAt` 会插入多组 `![…][…]` + `[…]: <data:…>`，表现为「多段相同结构」；若只部分写入则可能导致 **引用与定义不对齐**，预览退化为纯文本。 |
| H2 | 默认粘贴与自定义粘贴竞态 | 若未完全拦截事件，浏览器或扩展可能在图片逻辑之后再插入 **纯文本**（如路径、占位符），造成「多一段」；当前路径已 `preventDefault` + `return true`，仍可加 `stopImmediatePropagation` 降低与其它监听器的竞态。 |
| H3 | 引用定义未进入 `doc` / 被截断 | Vue/CodeMirror 同步或长度限制导致 `[id]: <data:…>` 未与 `![alt][id]` 同屏存在时，`markdown-it` 无法解析引用，预览为字面量（历史问题已通过单次全文 `dispatch` 缓解）。 |
| H4 | `markdown-it` / `linkify` | 极端情况下长行与 `linkify` 的交互可能影响解析（优先级低，需具体样本复现）。 |

## 3. 已确认原因（2026-02 排查）

- **H1 为高风险根因**：Windows / Edge / Chrome 在部分场景下对 **单次截图粘贴** 仍会在 `files` 或 `items` 中给出 **多个等价文件**（相同 `name`/`size`/`lastModified`/`type`）。`insertMarkdownImages` 按数组循环会 **多次调用 `insertRefImageAt`**，从而产生重复片段；重复结构也可能使引用关系混乱，进而出现 **预览不解析**。

## 4. 已采取修复（按步骤）

1. **对粘贴/拖拽收集到的图片 `File[]` 去重**（`dedupeImageFilesForPaste`：`name + size + lastModified + type`），再进入 `insertMarkdownImages`（见 `src/editor/imagePasteDrop.ts`）。
2. **`paste` / HTML 粘贴分支 / `drop` 在拦截后调用 `stopImmediatePropagation()`**，降低同事件上其它监听器二次写入的可能。
3. 单测：`src/editor/imagePasteDrop.test.ts` 覆盖去重逻辑。
4. 后续若仍复现：抓取 **一次粘贴后完整 Markdown**（脱敏 base64）并记录浏览器与版本，再评估 H3/H4。

## 5. 相关文件

- `src/editor/imagePasteDrop.ts` — 粘贴/拖拽插入逻辑
- `src/utils/renderMarkdown.ts` — `validateLink`、预览渲染
- `src/components/MdEditor.vue` — CodeMirror 与 `v-model` 绑定
