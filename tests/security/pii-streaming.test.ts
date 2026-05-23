import { describe, test, expect } from 'vitest'
import { StreamingPIIFilter } from '@/lib/security/pii-filter'
import { DEFAULT_DETECTORS } from '@/lib/security/pii-filter/detectors'

describe('PII Filter - Streaming', () => {
  test('processes chunks incrementally', () => {
    const filter = new StreamingPIIFilter(DEFAULT_DETECTORS)

    const chunk1 = filter.processChunk('我的手机是138')
    expect(chunk1).toBe('我的手机是138')

    const chunk2 = filter.processChunk('12345678')
    expect(chunk2).toContain('****')

    const final = filter.finalize()
    expect(final.piiFound).toHaveLength(1)
    expect(final.content).toContain('****')
  })

  test('handles PII spanning multiple chunks', () => {
    const filter = new StreamingPIIFilter(DEFAULT_DETECTORS)

    filter.processChunk('身份证：370102')
    filter.processChunk('199001011234')

    const final = filter.finalize()
    expect(final.piiFound.length).toBeGreaterThanOrEqual(1)
  })

  test('resets correctly for new stream', () => {
    const filter = new StreamingPIIFilter(DEFAULT_DETECTORS)

    filter.processChunk('手机13812345678')
    filter.finalize()

    filter.reset()

    const chunk = filter.processChunk('新消息')
    expect(chunk).toBe('新消息')
  })
})