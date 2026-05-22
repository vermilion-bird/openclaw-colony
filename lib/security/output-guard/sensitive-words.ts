// lib/security/output-guard/sensitive-words.ts

export interface SensitiveWordCategory {
  name: string
  words: string[]
  riskLevel: 'high' | 'medium' | 'low'
  action: 'reject' | 'warn'
}

export interface SensitiveWordConfig {
  categories: SensitiveWordCategory[]
}

export const DEFAULT_SENSITIVE_WORDS: SensitiveWordConfig = {
  categories: [
    {
      name: 'fraud_indicators',
      words: ['转账', '汇款', '投资回报', '理财产品', '高收益', '保本保息'],
      riskLevel: 'medium',
      action: 'reject',
    },
  ],
}

export function loadSensitiveWords(configPath: string): SensitiveWordConfig {
  return DEFAULT_SENSITIVE_WORDS
}