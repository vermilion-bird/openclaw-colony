// tests/security/logger.test.ts

import { describe, test, expect, beforeEach, afterEach } from 'vitest'
import fs from 'fs'
import path from 'path'
import { SecurityLogger, generateId } from '@/lib/security/logger'
import { SecurityContext, SecurityResult } from '@/lib/security/types'

const TEST_LOG_DIR = '/tmp/security-logs-test'

describe('Security Logger', () => {
  beforeEach(() => {
    if (!fs.existsSync(TEST_LOG_DIR)) fs.mkdirSync(TEST_LOG_DIR, { recursive: true })
  })

  afterEach(() => {
    if (fs.existsSync(TEST_LOG_DIR)) {
      const files = fs.readdirSync(TEST_LOG_DIR)
      for (const f of files) fs.unlinkSync(path.join(TEST_LOG_DIR, f))
    }
  })

  test('record creates log file with correct structure', async () => {
    const logger = new SecurityLogger(TEST_LOG_DIR, 30)

    const ctx: SecurityContext = {
      channelId: 'test_channel', userId: 'test_user',
      userName: '测试用户', message: '测试消息', timestamp: new Date(),
    }

    const result: SecurityResult = {
      passed: false, action: 'reject', reason: '测试拒绝',
      riskLevel: 'high', detector: 'test_detector',
    }

    await logger.record(ctx, result, 'input')

    const date = new Date().toISOString().slice(0, 10)
    const logFile = path.join(TEST_LOG_DIR, `security-${date}.jsonl`)

    expect(fs.existsSync(logFile)).toBe(true)

    const content = fs.readFileSync(logFile, 'utf-8')
    const event = JSON.parse(content.split('\n')[0])

    expect(event.channelId).toBe('test_channel')
    expect(event.userId).toBe('test_user')
    expect(event.layer).toBe('input')
    expect(event.riskLevel).toBe('high')
  })

  test('sanitizeContent masks PII', () => {
    const logger = new SecurityLogger(TEST_LOG_DIR, 30)
    const sanitized = logger.sanitizeContent('手机13812345678')
    expect(sanitized).toContain('***')
    expect(sanitized).not.toContain('13812345678')
  })

  test('generateId creates unique IDs', () => {
    const id1 = generateId()
    const id2 = generateId()
    expect(id1).not.toBe(id2)
    expect(id1.length).toBeGreaterThan(0)
  })
})