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
 * 在光标处插入引用式图片（正文仅短行），Data URL 追加在文档末尾。
 */
async function insertMarkdownImages(
  view: EditorView,
  files: File[],
  insertPos: number,
): Promise<void> {
  if (!files.length) return

  let cursor = insertPos

  for (const file of files) {
    const dataUrl = await readFileAsDataUrl(file)
    const rawAlt = (file.name || 'image').replace(/]/g, '')
    const alt = rawAlt.length > IMAGE_ALT_MAX_LEN ? `${rawAlt.slice(0, IMAGE_ALT_MAX_LEN)}…` : rawAlt
    const ref = makeImageRefId()
    const inline = `\n![${alt}][${ref}]\n`

    view.dispatch({
      changes: { from: cursor, insert: inline },
      selection: { anchor: cursor + inline.length },
      scrollIntoView: true,
    })

    const appendAt = view.state.doc.length
    view.dispatch({
      changes: { from: appendAt, insert: `\n[${ref}]: ${dataUrl}\n` },
    })

    cursor += inline.length
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

      const fromFiles = cb.files?.length ? [...cb.files].filter((f) => f.type.startsWith('image/')) : []
      if (fromFiles.length) {
        event.preventDefault()
        const pos = view.state.selection.main.head
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
        if (imageFiles.length) {
          event.preventDefault()
          const pos = view.state.selection.main.head
          void insertMarkdownImages(view, imageFiles, pos)
          return true
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
      const imgs = [...dt.files].filter((f) => f.type.startsWith('image/'))
      if (!imgs.length) return false
      event.preventDefault()
      const pos =
        view.posAtCoords({ x: event.clientX, y: event.clientY }, false) ?? view.state.selection.main.head
      void insertMarkdownImages(view, imgs, pos)
      return true
    },
  })
}
