// lib/security/output-guard/keyword-filter.ts

import { KeywordMatchResult } from '../types'
import { SensitiveWordConfig, DEFAULT_SENSITIVE_WORDS, loadSensitiveWords } from './sensitive-words'

export class StreamingKeywordFilter {
  private content: string = ''
  private wordConfig: SensitiveWordConfig

  constructor(config?: SensitiveWordConfig) {
    this.wordConfig = config ?? DEFAULT_SENSITIVE_WORDS
  }

  checkIncremental(chunk: string): KeywordMatchResult | null {
    this.content += chunk

    for (const category of this.wordConfig.categories) {
      for (const word of category.words) {
        if (this.content.includes(word)) {
          return {
            matched: true,
            category: category.name,
            word,
            riskLevel: category.riskLevel,
            action: category.action,
          }
        }
      }
    }

    return null
  }

  reset(): void {
    this.content = ''
  }

  getContent(): string {
    return this.content
  }
}

export { DEFAULT_SENSITIVE_WORDS, loadSensitiveWords } from './sensitive-words'