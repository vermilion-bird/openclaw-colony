// lib/security/input-guard/index.ts

import { quickScan } from './keyword-detector'
import { classifyIntent } from './intent-classifier'
import { SecurityResult } from '../types'

export async function check(message: string): Promise<SecurityResult> {
  // 1. 关键词快速扫描（<50ms）
  const scanResult = quickScan(message)
  if (scanResult.hit) {
    return {
      passed: false,
      action: 'reject',
      reason: `检测到潜在的指令注入攻击（${scanResult.category}）`,
      riskLevel: 'high',
      detector: 'keyword_scan',
      matchedPattern: scanResult.pattern,
    }
  }

  // 2. 意图分类模型（约150ms）
  const intentResult = await classifyIntent(message)

  if (intentResult.intent === 'manipulative' && intentResult.confidence > 0.7) {
    return {
      passed: false,
      action: 'reject',
      reason: intentResult.reason,
      riskLevel: 'high',
      detector: 'intent_classifier',
      confidence: intentResult.confidence,
    }
  }

  // ambiguous 意图：记录但允许继续（降级处理）
  // normal 意图：正常通过
  return {
    passed: true,
    action: 'allow',
    riskLevel: intentResult.intent === 'ambiguous' ? 'medium' : 'low',
    detector: 'intent_classifier',
    confidence: intentResult.confidence,
  }
}

export { quickScan, classifyIntent, INJECTION_PATTERNS } from './keyword-detector'
export { INTENT_PROMPT } from './intent-classifier'