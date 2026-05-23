// tests/security/pii-filter.test.ts
import { describe, test, expect } from 'vitest'
import { detectPII, maskPII, DEFAULT_DETECTORS } from '@/lib/security/pii-filter/detectors'
import { maskIdCard, maskPhone, maskBankCard, maskEmail, maskPassport, createCustomMasker } from '@/lib/security/pii-filter/maskers'
import { loadCustomRules, validateRuleConfig } from '@/lib/security/pii-filter/custom-rules'

describe('PII Filter - Detection', () => {
  test('detects China ID card', () => {
    const text = '身份证号：370102199001011234'
    const matches = detectPII(text, DEFAULT_DETECTORS)
    expect(matches).toHaveLength(1)
    expect(matches[0].detector).toBe('china_id_card')
    expect(matches[0].masked).toBe('370***********1234')
  })

  test('detects China phone number', () => {
    const text = '联系电话：13812345678'
    const matches = detectPII(text, DEFAULT_DETECTORS)
    expect(matches).toHaveLength(1)
    expect(matches[0].detector).toBe('china_phone')
    expect(matches[0].masked).toBe('138****5678')
  })

  test('detects bank card number', () => {
    const text = '银行卡：6222021234567890'
    const matches = detectPII(text, DEFAULT_DETECTORS)
    expect(matches).toHaveLength(1)
    expect(matches[0].detector).toBe('bank_card')
    expect(matches[0].masked).toBe('6222****7890')
  })

  test('detects email address', () => {
    const text = '邮箱：test@example.com'
    const matches = detectPII(text, DEFAULT_DETECTORS)
    expect(matches).toHaveLength(1)
    expect(matches[0].detector).toBe('email')
    expect(matches[0].masked).toContain('***')
    expect(matches[0].masked).toContain('example.com')
  })

  test('detects multiple PII types in single text', () => {
    const text = '手机13812345678，邮箱test@example.com，身份证370102199001011234'
    const matches = detectPII(text, DEFAULT_DETECTORS)
    expect(matches.length).toBeGreaterThanOrEqual(3)
  })

  test('does not detect non-PII content', () => {
    const text = '这是一个普通的句子，没有任何敏感信息'
    const matches = detectPII(text, DEFAULT_DETECTORS)
    expect(matches).toHaveLength(0)
  })

  test('handles priority to avoid overlapping matches', () => {
    // 身份证和银行卡可能重叠，身份证优先级更高
    const text = '370102199001011234'
    const matches = detectPII(text, DEFAULT_DETECTORS)
    expect(matches).toHaveLength(1)
    expect(matches[0].detector).toBe('china_id_card')
  })
})

describe('PII Filter - Masking', () => {
  test('maskPII replaces all detected PII in text', () => {
    const text = '手机13812345678，邮箱test@example.com'
    const masked = maskPII(text, DEFAULT_DETECTORS)
    expect(masked).not.toContain('13812345678')
    expect(masked).not.toContain('test@example.com')
    expect(masked).toContain('138****5678')
    expect(masked).toContain('t***@example.com')
  })

  test('maskPII preserves non-PII text', () => {
    const text = '普通文本手机13812345678更多文本'
    const masked = maskPII(text, DEFAULT_DETECTORS)
    expect(masked).toContain('普通文本')
    expect(masked).toContain('更多文本')
  })
})

describe('PII Filter - Masker Functions', () => {
  test('maskIdCard masks correctly', () => {
    expect(maskIdCard('370102199001011234')).toBe('370***********1234')
  })

  test('maskPhone masks correctly', () => {
    expect(maskPhone('13812345678')).toBe('138****5678')
  })

  test('maskBankCard masks correctly', () => {
    expect(maskBankCard('6222021234567890')).toBe('6222****7890')
  })

  test('maskEmail masks correctly', () => {
    expect(maskEmail('test@example.com')).toBe('t***@example.com')
  })

  test('maskPassport masks correctly', () => {
    expect(maskPassport('AB1234567')).toBe('A****567')
  })

  test('createCustomMasker creates custom masker', () => {
    const customMasker = createCustomMasker('PREFIX:{{prefix}} SUFFIX:{{suffix}}')
    expect(customMasker('123456789')).toContain('PREFIX:')
    expect(customMasker('123456789')).toContain('SUFFIX:')
  })
})

describe('PII Filter - Custom Rules', () => {
  test('createCustomMasker works with template', () => {
    const masker = createCustomMasker('EMP****')
    expect(masker('EMP123456')).toBe('EMP****')
  })

  test('validateRuleConfig accepts valid config', () => {
    const config = {
      rules: [
        { name: 'employee_id', pattern: '\\bEMP\\d{6}\\b', maskTemplate: 'EMP****', enabled: true }
      ]
    }
    const result = validateRuleConfig(config)
    expect(result.valid).toBe(true)
  })

  test('validateRuleConfig rejects missing required fields', () => {
    const config = {
      rules: [
        { name: 'bad_rule', pattern: '\\bEMP\\d{6}\\b' } // missing maskTemplate
      ]
    }
    const result = validateRuleConfig(config)
    expect(result.valid).toBe(false)
  })

  test('loadCustomRules returns empty array for missing file', () => {
    const rules = loadCustomRules('/nonexistent/path/rules.json')
    expect(rules).toEqual([])
  })
})