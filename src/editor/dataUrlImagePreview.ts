import { RangeSetBuilder, Text } from '@codemirror/state'
import {
  Decoration,
  type DecorationSet,
  EditorView,
  ViewPlugin,
  type ViewUpdate,
  WidgetType,
} from '@codemirror/view'

/** 超过此长度则跳过扫描，避免大文档卡顿 */
const MAX_DOC_LENGTH_FOR_EMBED_MEDIA_SCAN = 600_000

/** 芯片内说明文字最大长度 */
const CHIP_ALT_DISPLAY_MAX_LEN = 22

/** title 中展示的地址前缀最大长度 */
const CHIP_TITLE_SRC_PREFIX_MAX_LEN = 72

/** 行内 data/blob 图在芯片上的默认说明 */
const CHIP_FALLBACK_ALT_LABEL = '图片'

/** 引用定义行在芯片上显示的尾部说明 */
const CHIP_REF_DEFINITION_SUFFIX = '内嵌（定义）'

/** 行内嵌入图芯片前缀文案 */
const CHIP_INLINE_PREFIX = '行内'

/** 引用用法芯片前缀文案 */
const CHIP_REF_USAGE_PREFIX = '引用'

/** 无障碍名称：嵌入媒体占位 */
const CHIP_ACCESSIBLE_NAME = '嵌入媒体（预览区显示图像）'

/** 行内图片：`![](data:...)`、`![](<data:...>)` 或 `![](blob:...)` */
const INLINE_DATA_IMAGE =
  /!\[([^\]]*)\]\(\s*(?:<((?:data|blob):[^>]+)>|((?:data|blob):[^)]+))\s*\)/g

/** 引用式图片：`![任意 alt][引用 id]` */
const REF_STYLE_DATA_IMAGE = /!\[([^\]]*)\]\[([^\]]+)\]/g

/** 矢量图标 path（currentColor 填色，非栅格图） */
const EMBED_MEDIA_ICON_PATH_D =
  'M19 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2zm0 16H5V5h14v14zM8.5 8.5A1.5 1.5 0 1 1 7 10a1.5 1.5 0 0 1 1.5-1.5zM19 17l-3.5-3.5-2.5 2.5L9 12l-4 5v1h14z'

/**
 * 需用「嵌入媒体芯片」替换的源码区间（原文区不加载 data/blob 栅格图，仅预览区渲染）。
 */
export type ImagePreviewRange =
  | {
      kind: 'inlineDataUrl'
      from: number
      to: number
      src: string
      alt: string
    }
  | {
      kind: 'refStyleUsage'
      from: number
      to: number
      src: string
      alt: string
      refId: string
    }
  | {
      kind: 'refStyleDefinition'
      from: number
      to: number
      refId: string
    }

/**
 * 行首为 `[id]: <data:...>` 的整行（引用定义）。
 */
function isImageRefDefinitionLine(trimmed: string): boolean {
  return /^\[[^\]]+\]:\s*(?:<(?:data|blob):|(?:data|blob):)/.test(trimmed)
}

/**
 * 解析引用式图片定义行，得到引用 id 与图片地址。
 */
function parseImageRefDefinitionLine(trimmed: string): { ref: string; src: string } | null {
  if (!isImageRefDefinitionLine(trimmed)) return null
  const t = trimmed.replace(/\s+$/, '')
  let m = /^\[([^\]]+)\]:\s*<((?:data|blob):[^>]+)>\s*$/.exec(t)
  if (m) return { ref: m[1], src: m[2] }
  m = /^\[([^\]]+)\]:\s*((?:data|blob):[^\s]+)\s*$/.exec(t)
  if (m) return { ref: m[1], src: m[2] }
  return null
}

/**
 * 构建 data/blob 引用 id → 地址映射。
 */
function buildDataBlobRefSourceMap(doc: Text): Map<string, string> {
  const map = new Map<string, string>()
  for (let i = 1; i <= doc.lines; i++) {
    const trimmed = doc.line(i).text.replace(/\s+$/, '')
    if (!isImageRefDefinitionLine(trimmed)) continue
    const parsed = parseImageRefDefinitionLine(trimmed)
    if (!parsed) continue
    if (!/^(?:data|blob):/.test(parsed.src)) continue
    map.set(parsed.ref, parsed.src)
  }
  return map
}

/**
 * 截断说明文字供芯片展示。
 */
function formatChipAlt(alt: string): string {
  const t = alt.trim() || CHIP_FALLBACK_ALT_LABEL
  return t.length > CHIP_ALT_DISPLAY_MAX_LEN ? `${t.slice(0, CHIP_ALT_DISPLAY_MAX_LEN)}…` : t
}

/**
 * 截断 data/blob 地址供 title 提示。
 */
function formatSrcTitleHint(src: string): string {
  const s = src.trim()
  if (s.length <= CHIP_TITLE_SRC_PREFIX_MAX_LEN) return s
  return `${s.slice(0, CHIP_TITLE_SRC_PREFIX_MAX_LEN)}…`
}

/**
 * 扫描需替换为嵌入芯片的区间（按 from 升序）。
 */
export function scanDataUrlImageRanges(doc: Text): ImagePreviewRange[] {
  const refSrc = buildDataBlobRefSourceMap(doc)
  const out: ImagePreviewRange[] = []

  for (let i = 1; i <= doc.lines; i++) {
    const line = doc.line(i)
    const text = line.text
    const trimmed = text.replace(/\s+$/, '')

    if (isImageRefDefinitionLine(trimmed)) {
      const parsed = parseImageRefDefinitionLine(trimmed)
      if (parsed) {
        out.push({
          kind: 'refStyleDefinition',
          from: line.from,
          to: line.to,
          refId: parsed.ref,
        })
      }
      continue
    }

    let m: RegExpExecArray | null
    const inlineRe = new RegExp(INLINE_DATA_IMAGE.source, 'g')
    while ((m = inlineRe.exec(text)) !== null) {
      const src = m[2] || m[3]
      if (!src) continue
      out.push({
        kind: 'inlineDataUrl',
        from: line.from + m.index,
        to: line.from + m.index + m[0].length,
        src,
        alt: m[1] ?? '',
      })
    }

    const refStyleRe = new RegExp(REF_STYLE_DATA_IMAGE.source, 'g')
    while ((m = refStyleRe.exec(text)) !== null) {
      const refId = m[2]
      const src = refSrc.get(refId)
      if (!src) continue
      out.push({
        kind: 'refStyleUsage',
        from: line.from + m.index,
        to: line.from + m.index + m[0].length,
        src,
        alt: m[1] ?? '',
        refId,
      })
    }
  }

  return out.sort((a, b) => a.from - b.from)
}

type ChipVariant = ImagePreviewRange['kind']

/**
 * 原文区统一芯片：仅 SVG 图标 + 文字，不创建 img，避免重复栅格图与 base64 双重加载。
 */
class EmbeddedMarkdownMediaChipWidget extends WidgetType {
  readonly variant: ChipVariant
  readonly refId: string | null
  readonly alt: string
  readonly src: string | null

  constructor(variant: ChipVariant, refId: string | null, alt: string, src: string | null) {
    super()
    this.variant = variant
    this.refId = refId
    this.alt = alt
    this.src = src
  }

  eq(other: EmbeddedMarkdownMediaChipWidget): boolean {
    return (
      other instanceof EmbeddedMarkdownMediaChipWidget &&
      other.variant === this.variant &&
      other.refId === this.refId &&
      other.alt === this.alt &&
      other.src === this.src
    )
  }

  /**
   * 构建芯片 DOM（无 img）。
   */
  toDOM(): HTMLElement {
    const wrap = document.createElement('span')
    wrap.className =
      this.variant === 'refStyleDefinition'
        ? 'cm-md-embed-chip cm-md-embed-chip--definition'
        : 'cm-md-embed-chip'
    wrap.setAttribute('data-md-embed-media', 'true')
    wrap.setAttribute('role', 'img')
    wrap.setAttribute('aria-label', CHIP_ACCESSIBLE_NAME)

    const titleParts: string[] = [CHIP_ACCESSIBLE_NAME]
    if (this.src) titleParts.push(formatSrcTitleHint(this.src))
    wrap.setAttribute('title', titleParts.join('\n'))

    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
    svg.setAttribute('class', 'cm-md-embed-chip-icon')
    svg.setAttribute('viewBox', '0 0 24 24')
    svg.setAttribute('width', '15')
    svg.setAttribute('height', '15')
    svg.setAttribute('aria-hidden', 'true')
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path')
    path.setAttribute('d', EMBED_MEDIA_ICON_PATH_D)
    path.setAttribute('fill', 'currentColor')
    svg.appendChild(path)
    wrap.appendChild(svg)

    const label = document.createElement('span')
    label.className = 'cm-md-embed-chip-label'
    label.textContent = this.buildLabel()
    wrap.appendChild(label)

    return wrap
  }

  /**
   * 根据类型生成芯片主文案。
   */
  private buildLabel(): string {
    if (this.variant === 'refStyleDefinition' && this.refId) {
      return `[${this.refId}]: ${CHIP_REF_DEFINITION_SUFFIX}`
    }
    if (this.variant === 'refStyleUsage' && this.refId) {
      return `${CHIP_REF_USAGE_PREFIX} · ${formatChipAlt(this.alt)} · [${this.refId}]`
    }
    return `${CHIP_INLINE_PREFIX} · ${formatChipAlt(this.alt)}`
  }

  ignoreEvent(): boolean {
    return false
  }
}

/**
 * 由扫描区间构造芯片 Widget。
 */
function chipWidgetForRange(r: ImagePreviewRange): WidgetType {
  switch (r.kind) {
    case 'refStyleDefinition':
      return new EmbeddedMarkdownMediaChipWidget('refStyleDefinition', r.refId, '', null)
    case 'inlineDataUrl':
      return new EmbeddedMarkdownMediaChipWidget('inlineDataUrl', null, r.alt, r.src)
    case 'refStyleUsage':
      return new EmbeddedMarkdownMediaChipWidget('refStyleUsage', r.refId, r.alt, r.src)
  }
}

/**
 * 构建装饰集合。
 */
function buildDecorationSet(view: EditorView): DecorationSet {
  const doc = view.state.doc
  if (doc.length > MAX_DOC_LENGTH_FOR_EMBED_MEDIA_SCAN) {
    return Decoration.none
  }

  const ranges = scanDataUrlImageRanges(doc)
  if (ranges.length === 0) {
    return Decoration.none
  }

  const builder = new RangeSetBuilder<Decoration>()
  for (const r of ranges) {
    const deco = Decoration.replace({
      widget: chipWidgetForRange(r),
      block: false,
    })
    builder.add(r.from, r.to, deco)
  }
  return builder.finish()
}

/**
 * CodeMirror 扩展：将 data/blob 相关 Markdown 折叠为「嵌入媒体芯片」；栅格图仅在预览面板由 markdown-it 渲染。
 */
export function dataUrlImagePreviewExtension() {
  return ViewPlugin.fromClass(
    class {
      decorations: DecorationSet

      constructor(view: EditorView) {
        this.decorations = buildDecorationSet(view)
      }

      /**
       * 文档变更时重建装饰。
       */
      update(u: ViewUpdate) {
        if (u.docChanged) {
          this.decorations = buildDecorationSet(u.view)
        }
      }
    },
    { decorations: (v) => v.decorations },
  )
}
