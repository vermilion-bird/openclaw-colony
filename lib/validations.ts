import { z } from 'zod'

export const PROVIDERS = [
  'deepseek', 'openai', 'anthropic', 'gemini', 'ollama',
  'openrouter', 'vllm', 'minimax', 'groq', 'cohere',
  'mistral', 'perplexity', 'together', 'custom',
] as const

// z.string().url() is deprecated in Zod v4; use z.url().or(z.literal('')) with .optional()
const optionalUrl = z.union([z.url(), z.literal('')]).optional()

export const createInstanceSchema = z.object({
  name: z.string().regex(/^[a-z0-9-]+$/, 'Only lowercase letters, numbers, and hyphens'),
  imageTag: z.string().default('1panel/openclaw:2026.5.7'),
  port: z.number().int().min(1024).max(65535),
  provider: z.string().min(1),
  model: z.string().min(1),
  apiKey: z.string().min(1),
  baseUrl: optionalUrl,
  bindAddress: z.enum(['127.0.0.1', '0.0.0.0']).default('127.0.0.1'),
  allowedOrigin: optionalUrl,
  cpuLimit: z.number().positive().default(2),
  memoryLimit: z.string().regex(/^\d+[GgMmKk]?$/).default('2G'),
  dataDir: z.string().optional(),
})

export type CreateInstanceInput = z.infer<typeof createInstanceSchema>

export const updateConfigSchema = z.object({
  provider: z.string().min(1).optional(),
  model: z.string().min(1).optional(),
  apiKey: z.string().min(1).optional(),
  baseUrl: optionalUrl,
  allowedOrigin: optionalUrl,
  cpuLimit: z.number().positive().optional(),
  memoryLimit: z.string().regex(/^\d+[GgMmKk]?$/).optional(),
  imageTag: z.string().optional(),
})

export type UpdateConfigInput = z.infer<typeof updateConfigSchema>

export const createUserSchema = z.object({
  email: z.email(),
  password: z.string().min(8),
  role: z.enum(['admin', 'operator']).default('operator'),
})

export type CreateUserInput = z.infer<typeof createUserSchema>

export const feishuConfigSchema = z.object({
  enabled: z.boolean().optional(),
  appId: z.string().min(1, 'App ID is required'),
  appSecret: z.string().min(1, 'App Secret is required'),
  encryptKey: z.string().optional(),
  dmPolicy: z.enum(['pairing', 'open', 'disabled']).optional(),
  allowFrom: z.array(z.string()).optional(),
  groups: z.record(z.object({
    requireMention: z.boolean().optional(),
  })).optional(),
})

export type FeishuConfigInput = z.infer<typeof feishuConfigSchema>

export const modelConfigSchema = z.object({
  primary: z.string().min(1, 'Primary model is required'),
  fallbacks: z.array(z.string()).optional(),
})

export type ModelConfigInput = z.infer<typeof modelConfigSchema>

export const openclawConfigUpdateSchema = z.object({
  channels: z.object({
    feishu: feishuConfigSchema.optional(),
  }).optional(),
  agents: z.object({
    defaults: z.object({
      model: modelConfigSchema.optional(),
    }).optional(),
  }).optional(),
})

export type OpenclawConfigUpdateInput = z.infer<typeof openclawConfigUpdateSchema>
