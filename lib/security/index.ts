import { SecurityContext, SecurityResult, SecurityConfig } from './types'
import { check as inputCheck } from './input-guard'
import { StreamingPIIFilter, DEFAULT_DETECTORS } from './pii-filter'
import { OutputGuard } from './output-guard'
import { WhitelistManager } from './config/whitelist'
import { SecurityLogger } from './logger'

export {
  SecurityContext, SecurityResult, SecurityConfig,
  SecurityEvent, PIIMatch, PIIDetector,
} from './types'

export { check } from './input-guard'
export { StreamingPIIFilter, DEFAULT_DETECTORS, detectPII, maskPII } from './pii-filter'
export { OutputGuard } from './output-guard'
export { WhitelistManager } from './config/whitelist'
export { SecurityLogger } from './logger'

const defaultConfig: SecurityConfig = {
  enabled: true,
  whitelist: { channels: [], users: [], dmPolicy: 'configurable' },
  inputGuard: { enabled: true, keywordDetection: true, intentClassification: { enabled: true, model: 'deepseek-chat', threshold: 0.7 } },
  piiFilter: { enabled: true, defaultDetectors: ['china_id_card', 'china_phone', 'bank_card', 'email'], customRulesPath: '' },
  outputGuard: { enabled: true, keywordFilter: true, contentClassification: { enabled: true, model: 'deepseek-chat', threshold: 0.7, checkInterval: 500 }, sensitiveWordsPath: '' },
  logging: { enabled: true, level: 'info', retentionDays: 30 },
  notification: { enabled: false, channels: [], highRiskOnly: true },
}

export function isWhitelisted(
  channelId: string, userId: string, config?: Partial<SecurityConfig>
): boolean {
  const effectiveConfig = { ...defaultConfig, ...config }
  if (!effectiveConfig.enabled) return true
  if (effectiveConfig.whitelist.channels.includes(channelId)) return true
  if (effectiveConfig.whitelist.users.includes(userId)) return true
  if (channelId.startsWith('ou_') && effectiveConfig.whitelist.dmPolicy === 'all_bypass') return true
  return false
}

export async function processWithSecurity(ctx: SecurityContext): Promise<SecurityResult> {
  // 1. Whitelist check
  if (isWhitelisted(ctx.channelId, ctx.userId)) {
    return { passed: true, action: 'allow', riskLevel: 'low' }
  }

  // 2. Input layer check
  const inputResult = await inputCheck(ctx.message)
  if (!inputResult.passed) return inputResult

  // 3. PII detection (static)
  const piiFilter = new StreamingPIIFilter(DEFAULT_DETECTORS)
  const maskedMessage = piiFilter.processChunk(ctx.message)
  const piiResult = piiFilter.finalize()

  // 4. Return result
  return {
    passed: true,
    action: piiResult.piiFound.length > 0 ? 'mask_and_allow' : 'allow',
    maskedContent: piiResult.content,
    riskLevel: 'low',
    detector: piiResult.piiFound.length > 0 ? 'pii_filter' : undefined,
  }
}

export function createSecurityProcessor(config?: Partial<SecurityConfig>) {
  const effectiveConfig = { ...defaultConfig, ...config }

  return {
    config: effectiveConfig,
    checkInput: inputCheck,
    createPIIFilter: () => new StreamingPIIFilter(DEFAULT_DETECTORS),
    createOutputGuard: () => new OutputGuard(),
    isWhitelisted: (channelId: string, userId: string) =>
      isWhitelisted(channelId, userId, effectiveConfig),
  }
}