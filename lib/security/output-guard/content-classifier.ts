// lib/security/output-guard/content-classifier.ts

import { ContentClassificationResult } from '../types'

export const CONTENT_CLASSIFICATION_PROMPT = `
你是一个内容合规审核员，判断以下AI输出内容是否合规。

不合规内容的特征：
- 包含违法违规信息
- 包含敏感政治内容
- 包含虚假信息或谣言
- 引导用户进行危险或不当行为
- 包含歧视性或攻击性内容

请分析以下内容，返回JSON格式：
{
  "compliance": "compliant" | "non_compliant" | "ambiguous",
  "confidence": 0.0-1.0,
  "category": "合规类别（如有问题）",
  "reason": "简短说明"
}

AI输出内容：
{{content}}
`

export async function classifyContent(content: string): Promise<ContentClassificationResult> {
  const sensitivePhrases = ['违法', '犯罪', '敏感政治内容', '歧视']

  const hasSensitive = sensitivePhrases.some(p => content.includes(p))

  if (hasSensitive) {
    return {
      compliance: 'non_compliant',
      confidence: 0.7,
      category: 'sensitive_content',
      reason: '内容包含敏感信息',
    }
  }

  return {
    compliance: 'compliant',
    confidence: 0.9,
    reason: '内容合规',
  }
}

export interface ContentClassifierOptions {
  model?: string
  apiKey?: string
  baseUrl?: string
  timeout?: number
}

export function createContentClassifier(options: ContentClassifierOptions) {
  return classifyContent
}