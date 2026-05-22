// lib/security/output-guard/index.ts

import { SecurityResult } from '../types'
import { StreamingKeywordFilter, DEFAULT_SENSITIVE_WORDS } from './keyword-filter'
import { classifyContent } from './content-classifier'

export class OutputGuard {
  private keywordFilter: StreamingKeywordFilter
  private contentBuffer: string = ''
  private checkInterval: number = 500
  private lastCheckPosition: number = 0

  constructor(sensitiveWordsPath?: string) {
    this.keywordFilter = new StreamingKeywordFilter(DEFAULT_SENSITIVE_WORDS)
  }

  async checkPartial(chunk: string): Promise<SecurityResult> {
    // 1. Keyword quick scan
    const keywordResult = this.keywordFilter.checkIncremental(chunk)
    if (keywordResult?.matched && keywordResult.action === 'reject') {
      return {
        passed: false,
        action: 'interrupt_stream',
        reason: `检测到敏感内容（${keywordResult.category}: ${keywordResult.word}）`,
        riskLevel: keywordResult.riskLevel!,
        detector: 'keyword_filter',
        matchedPattern: keywordResult.word,
      }
    }

    // 2. Accumulate content, trigger classification periodically
    this.contentBuffer += chunk
    if (this.contentBuffer.length - this.lastCheckPosition >= this.checkInterval) {
      this.lastCheckPosition = this.contentBuffer.length

      const classificationResult = await classifyContent(this.contentBuffer)
      if (classificationResult.compliance === 'non_compliant' && classificationResult.confidence > 0.7) {
        return {
          passed: false,
          action: 'interrupt_stream',
          reason: classificationResult.reason,
          riskLevel: 'high',
          detector: 'content_classifier',
          confidence: classificationResult.confidence,
        }
      }
    }

    return { passed: true, action: 'allow', riskLevel: 'low' }
  }

  async checkFinal(): Promise<SecurityResult> {
    const classificationResult = await classifyContent(this.contentBuffer)
    if (classificationResult.compliance === 'non_compliant') {
      return {
        passed: false,
        action: 'reject',
        reason: classificationResult.reason,
        riskLevel: 'high',
        detector: 'content_classifier',
        confidence: classificationResult.confidence,
      }
    }
    return { passed: true, action: 'allow', riskLevel: 'low' }
  }

  reset(): void {
    this.keywordFilter.reset()
    this.contentBuffer = ''
    this.lastCheckPosition = 0
  }
}

export { StreamingKeywordFilter, DEFAULT_SENSITIVE_WORDS } from './keyword-filter'
export { classifyContent, CONTENT_CLASSIFICATION_PROMPT } from './content-classifier'