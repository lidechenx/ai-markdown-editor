import { RangeSetBuilder, Text } from '@codemirror/state'
import {
  Decoration,
  type DecorationSet,
  EditorView,
  ViewPlugin,
  type ViewUpdate,
  WidgetType,
} from '@codemirror/view'

/** 超过此长度的文档不再扫描装饰，避免卡顿 */
const MAX_DOC_LENGTH_FOR_IMAGE_PREVIEW = 600_000

/** 行首引用定义：`[id]: data:...` 或 `[id]: blob:...` */
const REF_IMAGE_LINE = /^\[([^\]]+)\]:\s*((?:data|blob):.+)$/

/** 行内图片：`![](data:...)` 或 `![](blob:...)` */
const INLINE_DATA_IMAGE = /!\[([^\]]*)\]\(((?:data|blob):[^)]+)\)/g

export type DataUrlImageRange = {
  from: number
  to: number
  src: string
  alt: string
  block: boolean
}

/**
 * 扫描文档中需要用图片预览替换的 Markdown 片段（行内 data/blob URL、整行引用定义）。
 */
export function scanDataUrlImageRanges(doc: Text): DataUrlImageRange[] {
  const out: DataUrlImageRange[] = []

  for (let i = 1; i <= doc.lines; i++) {
    const line = doc.line(i)
    const t = line.text
    const ref = REF_IMAGE_LINE.exec(t)
    if (ref) {
      out.push({
        from: line.from,
        to: line.to,
        src: ref[2].trim(),
        alt: ref[1],
        block: true,
      })
      continue
    }

    const re = new RegExp(INLINE_DATA_IMAGE.source, 'g')
    let m: RegExpExecArray | null
    while ((m = re.exec(t)) !== null) {
      out.push({
        from: line.from + m.index,
        to: line.from + m.index + m[0].length,
        src: m[2],
        alt: m[1] ?? '',
        block: false,
      })
    }
  }

  return out.sort((a, b) => a.from - b.from)
}

class DataUrlImageWidget extends WidgetType {
  readonly src: string
  readonly alt: string
  readonly block: boolean

  constructor(src: string, alt: string, block: boolean) {
    super()
    this.src = src
    this.alt = alt
    this.block = block
  }

  eq(other: DataUrlImageWidget): boolean {
    return other.src === this.src && other.alt === this.alt && other.block === this.block
  }

  toDOM(): HTMLElement {
    const wrap = document.createElement(this.block ? 'div' : 'span')
    wrap.className = this.block ? 'cm-md-block-img' : 'cm-md-inline-img'
    wrap.setAttribute('data-md-img-preview', 'true')

    const img = document.createElement('img')
    img.src = this.src
    img.alt = this.alt
    img.loading = 'lazy'
    img.draggable = false
    wrap.appendChild(img)

    if (this.block) {
      const cap = document.createElement('span')
      cap.className = 'cm-md-block-img-label'
      cap.textContent = `[${this.alt}]`
      wrap.appendChild(cap)
    }

    return wrap
  }

  ignoreEvent(): boolean {
    return false
  }
}

/**
 * 根据扫描结果构建 CodeMirror 装饰集合。
 */
function buildDecorationSet(view: EditorView): DecorationSet {
  const doc = view.state.doc
  if (doc.length > MAX_DOC_LENGTH_FOR_IMAGE_PREVIEW) {
    return Decoration.none
  }

  const ranges = scanDataUrlImageRanges(doc)
  if (ranges.length === 0) {
    return Decoration.none
  }

  const builder = new RangeSetBuilder<Decoration>()
  for (const r of ranges) {
    const deco = Decoration.replace({
      widget: new DataUrlImageWidget(r.src, r.alt, r.block),
      block: r.block,
    })
    builder.add(r.from, r.to, deco)
  }
  return builder.finish()
}

/**
 * CodeMirror 扩展：在原文区将 data/blob 图片 Markdown 渲染为缩略图，底层文本不变。
 */
export function dataUrlImagePreviewExtension() {
  return ViewPlugin.fromClass(
    class {
      decorations: DecorationSet

      constructor(view: EditorView) {
        this.decorations = buildDecorationSet(view)
      }

      update(u: ViewUpdate) {
        if (u.docChanged) {
          this.decorations = buildDecorationSet(u.view)
        }
      }
    },
    { decorations: (v) => v.decorations },
  )
}
