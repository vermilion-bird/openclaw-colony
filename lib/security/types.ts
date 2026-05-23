// lib/security/types.ts

export interface SecurityContext {
  channelId: string
  userId: string
  userName?: string
  message: string
  timestamp: Date
}

export interface SecurityResult {
  passed: boolean
  action: 'allow' | 'reject' | 'mask_and_allow' | 'interrupt_stream'
  maskedContent?: string
  reason?: string
  riskLevel: 'high' | 'medium' | 'low'
  detector?: string
  matchedPattern?: string
  confidence?: number
}

export interface KeywordMatchResult {
  matched: boolean
  category?: string
  word?: string
  riskLevel?: 'high' | 'medium' | 'low'
  action?: 'reject' | 'warn'
}

export interface PIIMatch {
  detector: string
  original: string
  masked: string
  start: number
  end: number
}

export interface PIIDetector {
  name: string
  pattern: RegExp
  maskTemplate: (match: string) => string
  priority: number
}

export interface IntentResult {
  intent: 'normal' | 'manipulative' | 'ambiguous'
  confidence: number
  reason: string
}

export interface ContentClassificationResult {
  compliance: 'compliant' | 'non_compliant' | 'ambiguous'
  confidence: number
  category?: string
  reason: string
}

export interface SecurityEvent {
  id: string
  timestamp: Date
  channelId: string
  userId: string
  userName?: string
  layer: 'input' | 'pii' | 'output'
  result: 'rejected' | 'masked' | 'warned' | 'ambiguous'
  riskLevel: 'high' | 'medium' | 'low'
  detector: string
  reason: string
  originalContent?: string
  maskedContent?: string
  matchedPattern?: string
  confidence?: number
  actionTaken: string
  notified: boolean
}

export interface SecurityConfig {
  enabled: boolean
  whitelist: {
    channels: string[]
    users: string[]
    dmPolicy: 'all_bypass' | 'all_check' | 'configurable'
  }
  inputGuard: {
    enabled: boolean
    keywordDetection: boolean
    intentClassification: {
      enabled: boolean
      model: string
      threshold: number
    }
  }
  piiFilter: {
    enabled: boolean
    defaultDetectors: string[]
    customRulesPath: string
  }
  outputGuard: {
    enabled: boolean
    keywordFilter: boolean
    contentClassification: {
      enabled: boolean
      model: string
      threshold: number
      checkInterval: number
    }
    sensitiveWordsPath: string
  }
  logging: {
    enabled: boolean
    level: 'info' | 'warn' | 'error'
    retentionDays: number
  }
  notification: {
    enabled: boolean
    channels: ('feishu' | 'email')[]
    feishuWebhook?: string
    emailRecipients?: string[]
    highRiskOnly: boolean
  }
}