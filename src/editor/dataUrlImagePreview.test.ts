import { Text } from '@codemirror/state'
import { describe, expect, it } from 'vitest'
import { scanDataUrlImageRanges } from './dataUrlImagePreview'

function docFromLines(...lines: string[]) {
  return Text.of(lines)
}

describe('scanDataUrlImageRanges', () => {
  it('识别整行引用式 data URL', () => {
    const doc = docFromLines('正文', '', '[r1]: data:image/png;base64,AAAABBBB')
    const ranges = scanDataUrlImageRanges(doc)
    expect(ranges).toHaveLength(1)
    expect(ranges[0].block).toBe(true)
    expect(ranges[0].alt).toBe('r1')
    expect(ranges[0].src).toContain('data:image/png')
  })

  it('识别行内 ![](data:image...)', () => {
    const doc = docFromLines('请看 ![](data:image/jpeg;base64,/9j/4AAQ) 结束')
    const ranges = scanDataUrlImageRanges(doc)
    expect(ranges).toHaveLength(1)
    expect(ranges[0].block).toBe(false)
    expect(ranges[0].alt).toBe('')
    expect(ranges[0].src.startsWith('data:image/jpeg')).toBe(true)
  })

  it('识别 blob: 行内图片', () => {
    const doc = docFromLines('![](blob:http://localhost/x-y-z)')
    const ranges = scanDataUrlImageRanges(doc)
    expect(ranges).toHaveLength(1)
    expect(ranges[0].src.startsWith('blob:')).toBe(true)
  })

  it('同一行可存在多个行内图片', () => {
    const doc = docFromLines(
      '![](data:image/png;base64,QQ) 与 ![](data:image/png;base64,RR)',
    )
    const ranges = scanDataUrlImageRanges(doc)
    expect(ranges).toHaveLength(2)
    expect(ranges[0].from).toBeLessThan(ranges[1].from)
  })

  it('引用行与正文行互不干扰', () => {
    const doc = docFromLines(
      '![图][ref]',
      '',
      '[ref]: data:image/png;base64,XXXX',
      '![](data:image/png;base64,YYYY)',
    )
    const ranges = scanDataUrlImageRanges(doc)
    expect(ranges).toHaveLength(2)
    expect(ranges[0].block).toBe(true)
    expect(ranges[1].block).toBe(false)
  })

  it('普通网络图片行不生成装饰区间', () => {
    const doc = docFromLines('![](https://example.com/a.png)')
    expect(scanDataUrlImageRanges(doc)).toHaveLength(0)
  })

  it('普通链接定义行不生成装饰区间', () => {
    const doc = docFromLines('[a]: https://example.com')
    expect(scanDataUrlImageRanges(doc)).toHaveLength(0)
  })
})
