import MarkdownIt from 'markdown-it'
import hljs from 'highlight.js'

const DEFAULT_LINK_TARGET = '_blank'
const DEFAULT_LINK_REL = 'noopener noreferrer'

/**
 * 将 HTML 特殊字符转义，用于无法高亮时的代码块回退展示。
 */
function escapeHtml(raw: string): string {
  return raw
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

/**
 * 创建配置好的 MarkdownIt 实例（代码高亮、外链安全属性）。
 */
function createRenderer(): MarkdownIt {
  const md = new MarkdownIt({
    html: false,
    linkify: true,
    typographer: true,
    highlight(code: string, lang: string) {
      if (lang && hljs.getLanguage(lang)) {
        try {
          return hljs.highlight(code, { language: lang, ignoreIllegals: true }).value
        } catch {
          /* 使用下方转义回退 */
        }
      }
      return escapeHtml(code)
    },
  })

  const defaultRender: NonNullable<typeof md.renderer.rules.link_open> =
    md.renderer.rules.link_open ??
    ((tokens, idx, options, _env, self) => self.renderToken(tokens, idx, options))

  md.renderer.rules.link_open = (tokens, idx, options, env, self) => {
    const token = tokens[idx]
    const hrefIndex = token.attrIndex('href')
    if (hrefIndex >= 0) {
      const href = token.attrs?.[hrefIndex][1]
      if (href && /^https?:\/\//i.test(href)) {
        token.attrSet('target', DEFAULT_LINK_TARGET)
        token.attrSet('rel', DEFAULT_LINK_REL)
      }
    }
    return defaultRender(tokens, idx, options, env, self)
  }

  return md
}

const shared = createRenderer()

/**
 * 将 Markdown 源码渲染为可放入 innerHTML 的 HTML 字符串。
 */
export function renderMarkdownToHtml(source: string): string {
  return shared.render(source)
}
