// tests/security/output-guard.test.ts

import { describe, test, expect } from 'vitest'
import { StreamingKeywordFilter, DEFAULT_SENSITIVE_WORDS } from '@/lib/security/output-guard/keyword-filter'

describe('Output Guard - Keyword Filter', () => {
  test('detects sensitive word in content', () => {
    const filter = new StreamingKeywordFilter(DEFAULT_SENSITIVE_WORDS)
    const result = filter.checkIncremental('这是正常内容')
    expect(result).toBeNull()

    const result2 = filter.checkIncremental('包含转账')
    expect(result2?.matched).toBe(true)
    expect(result2?.category).toBe('fraud_indicators')
  })

  test('returns correct action for different categories', () => {
    const filter = new StreamingKeywordFilter(DEFAULT_SENSITIVE_WORDS)
    filter.reset()
    filter.checkIncremental('投资回报')
    const result = filter.checkIncremental('很高')
    expect(result?.action).toBe('warn')
  })

  test('reset clears buffer', () => {
    const filter = new StreamingKeywordFilter(DEFAULT_SENSITIVE_WORDS)
    filter.checkIncremental('转账汇款')
    filter.reset()
    const content = filter.checkIncremental('新内容')
    expect(content).toBeNull()
  })
})