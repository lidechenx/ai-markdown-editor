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

  it('行内尖括号包裹的 data URL 能渲染为 img', () => {
    const md = '![](<data:image/png;base64,QQ>)'
    const html = renderMarkdownToHtml(md)
    expect(html).toContain('<img')
    expect(html).toContain('data:image/png')
  })

  it('支持引用式图片', () => {
    const md = '![示例][img1]\n\n[img1]: https://example.com/p.png'
    const html = renderMarkdownToHtml(md)
    expect(html).toContain('<img')
    expect(html).toContain('example.com')
  })

  it('引用式 data URL 图片（image/jpg）能渲染为 img', () => {
    const md = '![截图][r]\n\n[r]: data:image/jpg;base64,/9j/4AA='
    const html = renderMarkdownToHtml(md)
    expect(html).toContain('<img')
    expect(html).toContain('data:image/jpg')
  })

  it('引用式 data URL 图片（image/png）能渲染为 img', () => {
    const md = '![图][r]\n\n[r]: data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAE='
    const html = renderMarkdownToHtml(md)
    expect(html).toContain('<img')
    expect(html).toContain('data:image/png')
  })

  it('引用式定义使用尖括号且 URL 中含 ) 时仍能渲染为 img', () => {
    const md = '![x][r]\n\n[r]: <data:image/png;base64,AAA)BBB>'
    const html = renderMarkdownToHtml(md)
    expect(html).toContain('<img')
    expect(html).toContain('AAA)BBB')
  })

  it('段落内单个换行渲染为 br', () => {
    const html = renderMarkdownToHtml('第一行\n第二行')
    expect(html).toContain('<br')
    expect(html).toContain('第一行')
    expect(html).toContain('第二行')
  })

  it('默认不执行内联 HTML', () => {
    const html = renderMarkdownToHtml('<script>alert(1)</script>')
    expect(html).not.toContain('<script>')
  })
})
