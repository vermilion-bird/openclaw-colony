import { SecurityConfig } from '../types'

export const DEFAULT_SECURITY_CONFIG: SecurityConfig = {
  enabled: true,
  whitelist: {
    channels: [],
    users: [],
    dmPolicy: 'configurable',
  },
  inputGuard: {
    enabled: true,
    keywordDetection: true,
    intentClassification: {
      enabled: true,
      model: 'deepseek-chat',
      threshold: 0.7,
    },
  },
  piiFilter: {
    enabled: true,
    defaultDetectors: ['china_id_card', 'china_phone', 'bank_card', 'email'],
    customRulesPath: '',
  },
  outputGuard: {
    enabled: true,
    keywordFilter: true,
    contentClassification: {
      enabled: true,
      model: 'deepseek-chat',
      threshold: 0.7,
      checkInterval: 500,
    },
    sensitiveWordsPath: '',
  },
  logging: {
    enabled: true,
    level: 'info',
    retentionDays: 30,
  },
  notification: {
    enabled: true,
    channels: ['feishu'],
    highRiskOnly: true,
  },
}

export function getSecurityConfigPath(dataDir: string): string {
  return `${dataDir}/conf/security-config.json`
}