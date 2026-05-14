import { describe, expect, it } from 'vitest'
import { dedupeImageFilesForPaste } from './imagePasteDrop'

describe('dedupeImageFilesForPaste', () => {
  it('同 name/size/lastModified/type 只保留一个 File', () => {
    const buf = new Uint8Array([1, 2, 3])
    const a = new File([buf], 'shot.png', { type: 'image/png' })
    const b = new File([buf], 'shot.png', { type: 'image/png' })
    Object.defineProperty(a, 'lastModified', { value: 4242 })
    Object.defineProperty(b, 'lastModified', { value: 4242 })
    const out = dedupeImageFilesForPaste([a, b])
    expect(out).toHaveLength(1)
  })

  it('不同 size 不去重', () => {
    const a = new File([new Uint8Array([1])], 'a.png', { type: 'image/png' })
    const b = new File([new Uint8Array([1, 2])], 'a.png', { type: 'image/png' })
    Object.defineProperty(a, 'lastModified', { value: 1 })
    Object.defineProperty(b, 'lastModified', { value: 1 })
    expect(dedupeImageFilesForPaste([a, b])).toHaveLength(2)
  })
})
