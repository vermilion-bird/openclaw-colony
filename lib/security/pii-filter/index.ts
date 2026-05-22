// lib/security/pii-filter/index.ts

import { PIIDetector, PIIMatch } from '../types'
import { DEFAULT_DETECTORS, detectPII, maskPII } from './detectors'
import { loadCustomRules } from './custom-rules'

export class StreamingPIIFilter {
  private buffer: string = ''
  private detectors: PIIDetector[]
  private processedLength: number = 0

  constructor(detectors?: PIIDetector[], customRulesPath?: string) {
    const customRules = customRulesPath ? loadCustomRules(customRulesPath) : []
    this.detectors = detectors ?? [...DEFAULT_DETECTORS, ...customRules]
  }

  processChunk(chunk: string): string {
    this.buffer += chunk
    const matches = detectPII(this.buffer, this.detectors)
    const newMatches = matches.filter(m => m.end > this.processedLength)

    if (newMatches.length === 0) return chunk

    const newContent = this.buffer.slice(this.processedLength)
    let maskedNew = newContent

    for (const match of newMatches.sort((a, b) => b.start - a.start)) {
      const relativeStart = match.start - this.processedLength
      const relativeEnd = match.end - this.processedLength
      if (relativeStart >= 0 && relativeEnd <= newContent.length) {
        maskedNew = maskedNew.slice(0, relativeStart) + match.masked + maskedNew.slice(relativeEnd)
      }
    }

    this.processedLength = this.buffer.length
    return maskedNew
  }

  finalize(): { content: string; piiFound: PIIMatch[] } {
    const matches = detectPII(this.buffer, this.detectors)
    const finalContent = maskPII(this.buffer, this.detectors)
    return { content: finalContent, piiFound: matches }
  }

  reset(): void {
    this.buffer = ''
    this.processedLength = 0
  }

  getDetectors(): PIIDetector[] {
    return this.detectors
  }
}

export { DEFAULT_DETECTORS, detectPII, maskPII } from './detectors'
export { loadCustomRules } from './custom-rules'
export { maskIdCard, maskPhone, maskBankCard, maskEmail, createCustomMasker } from './maskers'