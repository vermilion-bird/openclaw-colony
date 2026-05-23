// lib/security/pii-filter/custom-rules.ts

import fs from 'fs'
import { PIIDetector } from '../types'
import { validateRuleConfig, CustomRulesConfig } from '../config/rules-schema'
import { createCustomMasker } from './maskers'

export function loadCustomRules(configPath: string): PIIDetector[] {
  try {
    if (!fs.existsSync(configPath)) {
      return []
    }

    const content = fs.readFileSync(configPath, 'utf-8')
    const config = JSON.parse(content) as CustomRulesConfig

    const validation = validateRuleConfig(config)
    if (!validation.valid) {
      console.warn(`Invalid custom rules config: ${validation.error}`)
      return []
    }

    return config.rules
      .filter(r => r.enabled)
      .map((r, index) => ({
        name: `custom_${r.name}`,
        pattern: new RegExp(r.pattern, 'g'),
        maskTemplate: createCustomMasker(r.maskTemplate),
        priority: 100 + index, // 自定义规则优先级在默认规则之后
      }))
  } catch (err) {
    console.warn(`Failed to load custom PII rules: ${err}`)
    return []
  }
}

export { validateRuleConfig } from '../config/rules-schema'