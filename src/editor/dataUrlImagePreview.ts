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

/** 行首引用定义：`[id]: data:...`、`[id]: <data:...>` 或 blob 形式（整行） */
const REF_DEF_LINE =
  /^\[([^\]]+)\]:\s*(?:<((?:data|blob):[^>\n]+)>|((?:data|blob):.+))$/

/** 行内图片：`![](data:...)` 或 `![](blob:...)` */
const INLINE_DATA_IMAGE = /!\[([^\]]*)\]\(((?:data|blob):[^)]+)\)/g

/** 引用式图片：`![任意文字][引用id]`（id 对应文末 data/blob 定义） */
const REF_STYLE_IMAGE = /!\[([^\]]*)\]\[([^\]]+)\]/g

export type DataUrlImageRange = {
  from: number
  to: number
  src: string
  alt: string
  /** 是否为整行引用定义（仅影响 DOM/CSS，装饰器本身不可为 block，见 ViewPlugin 限制） */
  block: boolean
}

/**
 * 收集全文中的 `[id]: data:...` / `[id]: blob:...` 定义，供引用式图片 `![alt][id]` 解析。
 */
function collectImageRefDefinitions(doc: Text): Map<string, string> {
  const map = new Map<string, string>()
  for (let i = 1; i <= doc.lines; i++) {
    const raw = doc.line(i).text
    const t = raw.replace(/\s+$/, '')
    const m = REF_DEF_LINE.exec(t)
    if (m) {
      const url = (m[2] ?? m[3] ?? '').trim()
      map.set(m[1], url)
    }
  }
  return map
}

/**
 * 扫描文档中需要用图片预览替换的 Markdown 片段（行内 data/blob、引用式 `![alt][id]`）。
 * 文末 `[id]: <data:...>` 定义行不参与装饰：否则与上一行的 `![alt][id]` 会各显示一张相同缩略图。
 */
export function scanDataUrlImageRanges(doc: Text): DataUrlImageRange[] {
  const refDefs = collectImageRefDefinitions(doc)
  const out: DataUrlImageRange[] = []

  for (let i = 1; i <= doc.lines; i++) {
    const line = doc.line(i)
    const text = line.text
    const trimmed = text.replace(/\s+$/, '')

    /** 定义行仅用于 refDefs，不生成 replace 装饰（避免与 `![alt][id]` 重复预览） */
    if (REF_DEF_LINE.exec(trimmed)) {
      continue
    }

    let m: RegExpExecArray | null
    const inlineRe = new RegExp(INLINE_DATA_IMAGE.source, 'g')
    while ((m = inlineRe.exec(text)) !== null) {
      out.push({
        from: line.from + m.index,
        to: line.from + m.index + m[0].length,
        src: m[2],
        alt: m[1] ?? '',
        block: false,
      })
    }

    const refImgRe = new RegExp(REF_STYLE_IMAGE.source, 'g')
    while ((m = refImgRe.exec(text)) !== null) {
      const id = m[2]
      const url = refDefs.get(id)
      if (url && (url.startsWith('data:') || url.startsWith('blob:'))) {
        out.push({
          from: line.from + m.index,
          to: line.from + m.index + m[0].length,
          src: url,
          alt: m[1] ?? '',
          block: false,
        })
      }
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
    /** 必须使用行内容器：ViewPlugin 提供的 replace 装饰禁止使用 block: true */
    const wrap = document.createElement('span')
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
      /** ViewPlugin 装饰禁止 block: true，否则抛出 RangeError 并连带文档布局崩溃 */
      block: false,
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
