import { describe, expect, it } from 'vitest'
import { renderMarkdownToHtml } from './renderMarkdown'

describe('renderMarkdownToHtml', () => {
  it('将一级标题渲染为 h1', () => {
    const html = renderMarkdownToHtml('# 你好')
    expect(html).toContain('<h1')
    expect(html).toContain('你好')
  })

  it('将粗体渲染为 strong', () => {
    const html = renderMarkdownToHtml('**加粗**')
    expect(html).toContain('<strong')
    expect(html).toContain('加粗')
  })

  it('外链增加 target 与 rel', () => {
    const html = renderMarkdownToHtml('[示例](https://example.com)')
    expect(html).toContain('target="_blank"')
    expect(html).toContain('rel="noopener noreferrer"')
  })

  it('支持引用式图片', () => {
    const md = '![示例][img1]\n\n[img1]: https://example.com/p.png'
    const html = renderMarkdownToHtml(md)
    expect(html).toContain('<img')
    expect(html).toContain('example.com')
  })

  it('默认不执行内联 HTML', () => {
    const html = renderMarkdownToHtml('<script>alert(1)</script>')
    expect(html).not.toContain('<script>')
  })
})
