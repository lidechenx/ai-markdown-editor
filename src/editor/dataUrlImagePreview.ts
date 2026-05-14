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

/** 行内图片：`![](data:...)` 或 `![](blob:...)` */
const INLINE_DATA_IMAGE = /!\[([^\]]*)\]\(((?:data|blob):[^)]+)\)/g

export type DataUrlImageRange = {
  from: number
  to: number
  src: string
  alt: string
  /** 保留字段，当前扫描结果均为行内缩略图 */
  block: boolean
}

/**
 * 行首为 `[id]: <data:...>` 的整行（引用定义），通常极长；跳过扫描以减轻正则压力。
 */
function isImageRefDefinitionLine(trimmed: string): boolean {
  return /^\[[^\]]+\]:\s*(?:<(?:data|blob):|(?:data|blob):)/.test(trimmed)
}

/**
 * 扫描文档中需用缩略图替换的片段：仅 **行内** `![](data:|blob:...)`。
 * 引用式 `![alt][id]` + 文末 `[id]: <data:...>` 不在此装饰：避免原文出现「缩略图 + 长定义」的双重视觉，图片以左侧预览为准。
 */
export function scanDataUrlImageRanges(doc: Text): DataUrlImageRange[] {
  const out: DataUrlImageRange[] = []

  for (let i = 1; i <= doc.lines; i++) {
    const line = doc.line(i)
    const text = line.text
    const trimmed = text.replace(/\s+$/, '')

    if (isImageRefDefinitionLine(trimmed)) {
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
 * CodeMirror 扩展：在原文区将 **行内** `![](data:|blob:...)` 渲染为缩略图；引用式粘贴不在此装饰，请看左侧预览。
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
