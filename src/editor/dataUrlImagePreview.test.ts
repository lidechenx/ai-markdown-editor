import { Text } from '@codemirror/state'
import { describe, expect, it } from 'vitest'
import { scanDataUrlImageRanges } from './dataUrlImagePreview'

function docFromLines(...lines: string[]) {
  return Text.of(lines)
}

describe('scanDataUrlImageRanges', () => {
  it('引用定义整行仅产生折叠区间（不携带 src，避免再画缩略图）', () => {
    const doc = docFromLines('正文', '', '[r1]: data:image/png;base64,AAAABBBB')
    const ranges = scanDataUrlImageRanges(doc)
    expect(ranges).toHaveLength(1)
    expect(ranges[0].kind).toBe('refStyleDefinition')
    if (ranges[0].kind === 'refStyleDefinition') {
      expect(ranges[0].refId).toBe('r1')
    }
  })

  it('识别行内 ![](data:image...)', () => {
    const doc = docFromLines('请看 ![](data:image/jpeg;base64,/9j/4AAQ) 结束')
    const ranges = scanDataUrlImageRanges(doc)
    expect(ranges).toHaveLength(1)
    expect(ranges[0].kind).toBe('inlineDataUrl')
    if (ranges[0].kind === 'inlineDataUrl') {
      expect(ranges[0].alt).toBe('')
      expect(ranges[0].src.startsWith('data:image/jpeg')).toBe(true)
    }
  })

  it('识别行内 ![](<data:image...>) 尖括号包裹地址', () => {
    const doc = docFromLines('![](<data:image/png;base64,QQ>)')
    const ranges = scanDataUrlImageRanges(doc)
    expect(ranges).toHaveLength(1)
    expect(ranges[0].kind).toBe('inlineDataUrl')
    if (ranges[0].kind === 'inlineDataUrl') {
      expect(ranges[0].src).toBe('data:image/png;base64,QQ')
    }
  })

  it('识别 blob: 行内图片', () => {
    const doc = docFromLines('![](blob:http://localhost/x-y-z)')
    const ranges = scanDataUrlImageRanges(doc)
    expect(ranges).toHaveLength(1)
    expect(ranges[0].kind).toBe('inlineDataUrl')
    if (ranges[0].kind === 'inlineDataUrl') {
      expect(ranges[0].src.startsWith('blob:')).toBe(true)
    }
  })

  it('同一行可存在多个行内图片', () => {
    const doc = docFromLines(
      '![](data:image/png;base64,QQ) 与 ![](data:image/png;base64,RR)',
    )
    const ranges = scanDataUrlImageRanges(doc)
    expect(ranges).toHaveLength(2)
    expect(ranges[0].from).toBeLessThan(ranges[1].from)
  })

  it('引用式用法、定义行与行内 data 图区间并存', () => {
    const doc = docFromLines(
      '![图][ref]',
      '',
      '[ref]: data:image/png;base64,XXXX',
      '![](data:image/png;base64,YYYY)',
    )
    const ranges = scanDataUrlImageRanges(doc)
    expect(ranges).toHaveLength(3)
    const refUsage = ranges.find((r) => r.kind === 'refStyleUsage')
    const refDef = ranges.find((r) => r.kind === 'refStyleDefinition')
    const inline = ranges.find((r) => r.kind === 'inlineDataUrl')
    expect(refUsage).toBeDefined()
    if (refUsage?.kind === 'refStyleUsage') {
      expect(refUsage.alt).toBe('图')
      expect(refUsage.refId).toBe('ref')
      expect(refUsage.src).toContain('XXXX')
    }
    expect(refDef).toBeDefined()
    if (refDef?.kind === 'refStyleDefinition') {
      expect(refDef.refId).toBe('ref')
    }
    expect(inline).toBeDefined()
    if (inline?.kind === 'inlineDataUrl') {
      expect(inline.alt).toBe('')
      expect(inline.src).toContain('YYYY')
    }
  })

  it('普通网络图片行不生成装饰区间', () => {
    const doc = docFromLines('![](https://example.com/a.png)')
    expect(scanDataUrlImageRanges(doc)).toHaveLength(0)
  })

  it('尖括号引用定义与引用式用法', () => {
    const doc = docFromLines('![图][ref]', '', '[ref]: <data:image/png;base64,XXXX>')
    const ranges = scanDataUrlImageRanges(doc)
    expect(ranges).toHaveLength(2)
    const refUsage = ranges.find((r) => r.kind === 'refStyleUsage')
    const refDef = ranges.find((r) => r.kind === 'refStyleDefinition')
    expect(refUsage).toBeDefined()
    if (refUsage?.kind === 'refStyleUsage') {
      expect(refUsage.src).toBe('data:image/png;base64,XXXX')
    }
    expect(refDef).toBeDefined()
    if (refDef?.kind === 'refStyleDefinition') {
      expect(refDef.refId).toBe('ref')
    }
  })

  it('普通链接定义行不生成装饰区间', () => {
    const doc = docFromLines('[a]: https://example.com')
    expect(scanDataUrlImageRanges(doc)).toHaveLength(0)
  })
})
