import { EditorView } from '@codemirror/view'

/** 引用标签前缀，仅含字母数字与连字符，避免与正文脚注冲突 */
const IMAGE_REF_ID_PREFIX = 'md-img'

/** 图片说明文字最大长度（避免过长文件名撑爆一行） */
const IMAGE_ALT_MAX_LEN = 48

/**
 * 将图片文件读取为 Data URL。
 */
function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      resolve(typeof reader.result === 'string' ? reader.result : '')
    }
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}

/**
 * 生成唯一的引用式图片 ID（用于 `![alt][id]` / `[id]: url`）。
 */
function makeImageRefId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return `${IMAGE_REF_ID_PREFIX}-${crypto.randomUUID().replace(/-/g, '').slice(0, 12)}`
  }
  return `${IMAGE_REF_ID_PREFIX}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`
}

/**
 * 将插入位置限制在合法区间。异步读完图片后文档可能已变短，沿用旧光标会触发 Invalid change range。
 */
function clampDocPos(view: EditorView, pos: number): number {
  const len = view.state.doc.length
  if (pos < 0) return 0
  if (pos > len) return len
  return pos
}

/**
 * 在指定位置插入引用式图片（短行正文 + 文末引用定义）。
 * 定义使用尖括号包裹目标地址，避免 URL 中含 `)` 等字符时 markdown-it 解析引用失败。
 * 使用单次全文替换生成新文档，保证仅一次 dispatch / 一次 v-model 同步，避免 vue-codemirror
 * 在两次 emit 之间用「仅有 ![alt][id]、无定义行」的中间态覆盖编辑器，导致预览无法解析引用图。
 *
 * @returns 插入正文后的光标位置（紧跟 `![alt][ref]` 块之后），便于连续插入多图。
 */
function insertRefImageAt(view: EditorView, insertPos: number, dataUrl: string, rawAltBase: string): number {
  const trimmedUrl = dataUrl.trim()
  if (!trimmedUrl) return clampDocPos(view, insertPos)

  const at = clampDocPos(view, insertPos)
  const rawAlt = (rawAltBase || 'image').replace(/]/g, '')
  const alt = rawAlt.length > IMAGE_ALT_MAX_LEN ? `${rawAlt.slice(0, IMAGE_ALT_MAX_LEN)}…` : rawAlt
  const ref = makeImageRefId()
  const body = `\n![${alt}][${ref}]\n`
  const def = `\n[${ref}]: <${trimmedUrl}>\n`
  const bodyLen = body.length

  const len = view.state.doc.length
  const before = view.state.sliceDoc(0, at)
  const after = view.state.sliceDoc(at)
  const newDoc = before + body + after + def

  view.dispatch({
    changes: { from: 0, to: len, insert: newDoc },
    selection: { anchor: at + bodyLen },
    scrollIntoView: true,
  })

  return at + bodyLen
}

/**
 * 同一次粘贴中，剪贴板可能多次提供同一截图（等价 File），去重后再插入，避免正文/文末重复多段相同引用。
 */
export function dedupeImageFilesForPaste(files: File[]): File[] {
  const out: File[] = []
  const seen = new Set<string>()
  for (const f of files) {
    const key = `${f.name}\0${f.size}\0${f.lastModified}\0${f.type}`
    if (seen.has(key)) continue
    seen.add(key)
    out.push(f)
  }
  return out
}

/**
 * 将多个图片文件依次插入为引用式 Markdown。
 */
async function insertMarkdownImages(
  view: EditorView,
  files: File[],
  insertPos: number,
): Promise<void> {
  const unique = dedupeImageFilesForPaste(files)
  if (!unique.length) return

  let cursor = clampDocPos(view, insertPos)
  for (const file of unique) {
    const dataUrl = await readFileAsDataUrl(file)
    cursor = clampDocPos(view, cursor)
    cursor = insertRefImageAt(view, cursor, dataUrl, file.name || 'image')
  }
}

/**
 * CodeMirror 扩展：支持从剪贴板粘贴截图/图片，以及拖拽图片到编辑器。
 * 纯文本与代码的粘贴仍走默认逻辑。
 */
export function imagePasteDropExtension() {
  return EditorView.domEventHandlers({
    paste(event, view) {
      const cb = event.clipboardData
      if (!cb) return false

      const fromFiles = dedupeImageFilesForPaste(
        cb.files?.length ? [...cb.files].filter((f) => f.type.startsWith('image/')) : [],
      )
      if (fromFiles.length) {
        event.preventDefault()
        event.stopImmediatePropagation()
        const pos = clampDocPos(view, view.state.selection.main.head)
        void insertMarkdownImages(view, fromFiles, pos)
        return true
      }

      if (cb.items) {
        const imageFiles: File[] = []
        for (const item of cb.items) {
          if (item.kind === 'file' && item.type.startsWith('image/')) {
            const f = item.getAsFile()
            if (f) imageFiles.push(f)
          }
        }
        const uniqueItems = dedupeImageFilesForPaste(imageFiles)
        if (uniqueItems.length) {
          event.preventDefault()
          event.stopImmediatePropagation()
          const pos = clampDocPos(view, view.state.selection.main.head)
          void insertMarkdownImages(view, uniqueItems, pos)
          return true
        }
      }

      /** 部分环境仅提供 HTML（如从网页复制图片），从中提取 data:image 再插入 */
      const html = cb.getData('text/html')
      if (html) {
        const tag = /<img\b[^>]*>/i.exec(html)
        if (tag) {
          const srcMatch =
            /\bsrc\s*=\s*["']([^"']+)["']/i.exec(tag[0]) ?? /\bsrc\s*=\s*([^\s>]+)/i.exec(tag[0])
          const src = srcMatch?.[1]?.trim()
          if (
            src &&
            src.toLowerCase().startsWith('data:image/') &&
            !src.toLowerCase().includes('image/svg+xml')
          ) {
            const altMatch = /\balt\s*=\s*["']([^"']*)["']/i.exec(tag[0])
            const altFromHtml = altMatch?.[1]?.replace(/]/g, '')?.trim()
            event.preventDefault()
            event.stopImmediatePropagation()
            const pos = clampDocPos(view, view.state.selection.main.head)
            insertRefImageAt(view, pos, src, altFromHtml || 'image')
            return true
          }
        }
      }

      return false
    },

    dragover(event) {
      if (event.dataTransfer?.types?.includes('Files')) {
        event.preventDefault()
      }
    },

    drop(event, view) {
      const dt = event.dataTransfer
      if (!dt?.files?.length) return false
      const imgs = dedupeImageFilesForPaste([...dt.files].filter((f) => f.type.startsWith('image/')))
      if (!imgs.length) return false
      event.preventDefault()
      event.stopImmediatePropagation()
      const rawPos =
        view.posAtCoords({ x: event.clientX, y: event.clientY }, false) ?? view.state.selection.main.head
      const pos = clampDocPos(view, rawPos)
      void insertMarkdownImages(view, imgs, pos)
      return true
    },
  })
}
