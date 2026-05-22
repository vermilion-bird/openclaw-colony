// lib/security/config/rules-schema.ts

import { z } from 'zod'

export const CustomPIIRuleSchema = z.object({
  name: z.string().min(1),
  pattern: z.string().min(1),
  maskTemplate: z.string(),
  enabled: z.boolean().default(true),
})

export const CustomRulesConfigSchema = z.object({
  rules: z.array(CustomPIIRuleSchema),
})

export interface CustomPIIRule {
  name: string
  pattern: string
  maskTemplate: string
  enabled: boolean
}

export interface CustomRulesConfig {
  rules: CustomPIIRule[]
}

export function validateCustomRule(rule: unknown): { valid: boolean; error?: string } {
  const result = CustomPIIRuleSchema.safeParse(rule)
  if (!result.success) {
    return { valid: false, error: result.error.message }
  }
  return { valid: true }
}

export function validateRuleConfig(config: unknown): { valid: boolean; error?: string } {
  const result = CustomRulesConfigSchema.safeParse(config)
  if (!result.success) {
    return { valid: false, error: result.error.message }
  }
  return { valid: true }
}