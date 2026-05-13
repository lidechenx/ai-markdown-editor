import { EditorView } from '@codemirror/view'

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
 * 在指定位置插入多张图片对应的 Markdown 语法。
 */
async function insertMarkdownImages(
  view: EditorView,
  files: File[],
  insertPos: number,
): Promise<void> {
  if (!files.length) return
  const chunks: string[] = []
  for (const file of files) {
    const dataUrl = await readFileAsDataUrl(file)
    const alt = (file.name || 'image').replace(/]/g, '')
    chunks.push(`\n![${alt}](${dataUrl})\n`)
  }
  const md = chunks.join('')
  view.dispatch({
    changes: { from: insertPos, insert: md },
    selection: { anchor: insertPos + md.length },
    scrollIntoView: true,
  })
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
