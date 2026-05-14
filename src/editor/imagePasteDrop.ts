import { EditorView } from '@codemirror/view'

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
 * 将插入位置限制在合法区间。异步读完图片后文档可能已变短，沿用旧光标会触发 Invalid change range。
 */
function clampDocPos(view: EditorView, pos: number): number {
  const len = view.state.doc.length
  if (pos < 0) return 0
  if (pos > len) return len
  return pos
}

/**
 * 在光标处插入**单行**行内图片：`![alt](<data:...>)`。
 * 地址放在尖括号内，避免 data URL 中含 `)` 时破坏 `](...)` 配对；整段在一行，一次删除即可移除整块，预览不会残留半截引用。
 *
 * @returns 插入后光标应落在新片段末尾之后，便于连续插入多图。
 */
function insertInlineDataUrlImageAt(view: EditorView, insertPos: number, dataUrl: string, rawAltBase: string): number {
  const trimmedUrl = dataUrl.trim()
  if (!trimmedUrl) return clampDocPos(view, insertPos)

  const at = clampDocPos(view, insertPos)
  const rawAlt = (rawAltBase || 'image').replace(/]/g, '')
  const alt = rawAlt.length > IMAGE_ALT_MAX_LEN ? `${rawAlt.slice(0, IMAGE_ALT_MAX_LEN)}…` : rawAlt
  const snippet = `\n![${alt}](<${trimmedUrl}>)\n`

  view.dispatch({
    changes: { from: at, insert: snippet },
    selection: { anchor: at + snippet.length },
    scrollIntoView: true,
  })

  return at + snippet.length
}

/**
 * 同一次粘贴中，剪贴板可能多次提供同一截图（等价 File），去重后再插入，避免重复插入多段相同图片。
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
 * 将多个图片文件依次插入为单行行内 data URL 图。
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
    cursor = insertInlineDataUrlImageAt(view, cursor, dataUrl, file.name || 'image')
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
            insertInlineDataUrlImageAt(view, pos, src, altFromHtml || 'image')
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
