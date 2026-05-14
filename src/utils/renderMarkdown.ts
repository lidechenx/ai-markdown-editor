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
 * 校验链接是否允许写入 HTML（覆盖 markdown-it 默认实现）。
 * 默认仅放行 `data:image/(gif|png|jpeg|webp);`，浏览器截图常见 `jpg`、`bmp`、`avif` 等会被拒绝，
 * 导致引用式图片 `[id]: data:...` 整段解析失败，预览里只剩 `![alt][id]` 纯文本。
 */
function validateMdLink(url: string): boolean {
  const raw = url.trim()
  const s = raw.toLowerCase()
  if (s.startsWith('blob:')) return true
  if (s.startsWith('data:image/')) {
    if (/\bdata:image\/svg\+xml\b/i.test(raw)) return false
    return /^data:image\/[\w.+-]+;/i.test(raw)
  }
  if (s.startsWith('data:')) return false
  if (/^(vbscript|javascript|file):/i.test(s)) return false
  return true
}

/**
 * 创建配置好的 MarkdownIt 实例（代码高亮、外链安全属性）。
 */
function createRenderer(): MarkdownIt {
  const md = new MarkdownIt({
    html: false,
    linkify: true,
    typographer: true,
    /** 单个换行转为 <br>，与常见笔记软件行为一致，便于「原文换行 = 预览换行」 */
    breaks: true,
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

  md.validateLink = validateMdLink

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
