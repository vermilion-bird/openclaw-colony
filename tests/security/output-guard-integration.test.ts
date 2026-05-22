// tests/security/output-guard-integration.test.ts

import { describe, test, expect } from 'vitest'
import { OutputGuard } from '@/lib/security/output-guard'

describe('Output Guard - Integration', () => {
  test('allows normal output', async () => {
    const guard = new OutputGuard()
    const result = await guard.checkPartial('这是正常的输出内容')
    expect(result.passed).toBe(true)
    expect(result.action).toBe('allow')
  })

  test('interrupts on sensitive keyword', async () => {
    const guard = new OutputGuard()
    guard.checkPartial('推荐你购买')
    const result = await guard.checkPartial('理财产品')
    expect(result.passed).toBe(false)
    expect(result.action).toBe('interrupt_stream')
  })

  test('reset clears state', async () => {
    const guard = new OutputGuard()
    guard.checkPartial('转账')
    guard.reset()

    const result = await guard.checkPartial('新内容')
    expect(result.passed).toBe(true)
  })
})