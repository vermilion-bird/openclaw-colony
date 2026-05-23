// lib/security/pii-filter/detectors.ts

import { PIIDetector, PIIMatch } from '../types'
import { maskIdCard, maskPhone, maskBankCard, maskEmail } from './maskers'

export const DEFAULT_DETECTORS: PIIDetector[] = [
  {
    name: 'china_id_card',
    pattern: /\b[1-9]\d{5}(19|20)\d{2}(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])\d{3}[\dXx]\b/,
    maskTemplate: maskIdCard,
    priority: 1,
  },
  {
    name: 'china_phone',
    pattern: /\b1[3-9]\d{9}\b/,
    maskTemplate: maskPhone,
    priority: 2,
  },
  {
    name: 'bank_card',
    pattern: /\b\d{16,19}\b/,
    maskTemplate: maskBankCard,
    priority: 3,
  },
  {
    name: 'email',
    pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/,
    maskTemplate: maskEmail,
    priority: 4,
  },
]

export function detectPII(text: string, detectors: PIIDetector[]): PIIMatch[] {
  const matches: PIIMatch[] = []
  const processedRanges: [number, number][] = []

  // 按优先级排序
  const sorted = [...detectors].sort((a, b) => a.priority - b.priority)

  for (const detector of sorted) {
    const regex = new RegExp(detector.pattern.source, 'g')
    let matchResult
    while ((matchResult = regex.exec(text)) !== null) {
      const start = matchResult.index
      const end = start + matchResult[0].length

      // 检查是否与已检测区域重叠
      const overlaps = processedRanges.some(([s, e]) =>
        (start >= s && start < e) || (end > s && end <= e) || (start <= s && end >= e)
      )

      if (!overlaps) {
        matches.push({
          detector: detector.name,
          original: matchResult[0],
          masked: detector.maskTemplate(matchResult[0]),
          start,
          end,
        })
        processedRanges.push([start, end])
      }
    }
  }

  return matches
}

export function maskPII(text: string, detectors: PIIDetector[]): string {
  const matches = detectPII(text, detectors)
  let result = text

  // 按位置倒序替换，避免位置偏移
  for (const match of matches.sort((a, b) => b.start - a.start)) {
    result = result.slice(0, match.start) + match.masked + result.slice(match.end)
  }

  return result
}