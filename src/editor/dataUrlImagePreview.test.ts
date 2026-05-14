import { Text } from '@codemirror/state'
import { describe, expect, it } from 'vitest'
import { scanDataUrlImageRanges } from './dataUrlImagePreview'

function docFromLines(...lines: string[]) {
  return Text.of(lines)
}

describe('scanDataUrlImageRanges', () => {
  it('仅有引用定义行时不生成装饰（避免与 ![alt][id] 重复缩略图）', () => {
    const doc = docFromLines('正文', '', '[r1]: data:image/png;base64,AAAABBBB')
    expect(scanDataUrlImageRanges(doc)).toHaveLength(0)
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

  it('引用式 ![alt][id] 与行内图可识别（文末定义行不单独装饰）', () => {
    const doc = docFromLines(
      '![图][ref]',
      '',
      '[ref]: data:image/png;base64,XXXX',
      '![](data:image/png;base64,YYYY)',
    )
    const ranges = scanDataUrlImageRanges(doc)
    expect(ranges).toHaveLength(2)
    expect(ranges[0].alt).toBe('图')
    expect(ranges[1].alt).toBe('')
  })

  it('普通网络图片行不生成装饰区间', () => {
    const doc = docFromLines('![](https://example.com/a.png)')
    expect(scanDataUrlImageRanges(doc)).toHaveLength(0)
  })

  it('尖括号定义行只供解析引用式图，不单独生成装饰区间', () => {
    const doc = docFromLines('![图][ref]', '', '[ref]: <data:image/png;base64,XXXX>')
    const ranges = scanDataUrlImageRanges(doc)
    expect(ranges).toHaveLength(1)
    expect(ranges[0].alt).toBe('图')
    expect(ranges[0].src).toBe('data:image/png;base64,XXXX')
  })

  it('普通链接定义行不生成装饰区间', () => {
    const doc = docFromLines('[a]: https://example.com')
    expect(scanDataUrlImageRanges(doc)).toHaveLength(0)
  })
})
