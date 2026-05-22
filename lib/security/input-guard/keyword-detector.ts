// lib/security/input-guard/keyword-detector.ts

import { INJECTION_PATTERNS, InjectionCategory } from './patterns'

export interface ScanResult {
  hit: boolean
  category?: InjectionCategory
  pattern?: string
  riskLevel?: 'high' | 'medium' | 'low'
}

export { INJECTION_PATTERNS }

export function quickScan(message: string): ScanResult {
  for (const [category, patterns] of Object.entries(INJECTION_PATTERNS) as [InjectionCategory, readonly RegExp[]][]) {
    for (const pattern of patterns) {
      if (pattern.test(message)) {
        return {
          hit: true,
          category,
          pattern: pattern.source,
          riskLevel: 'high', // 关键词命中直接高风险
        }
      }
    }
  }
  return { hit: false }
}