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
  imageTag: z.string().min(1).optional(),
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
  gatewayToken: z.string().min(8).max(64).optional(),
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
  gatewayToken: z.string().min(8).max(64).optional(),
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
  groups: z.record(z.string(), z.object({
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

export const importImageSchema = z.object({
  tag: z.string().min(1, 'Tag 不能为空').max(128),
  repository: z.enum(['dockerhub', 'ghcr']).default('dockerhub'),
})

export type ImportImageInput = z.infer<typeof importImageSchema>

export const validateTagSchema = z.object({
  tag: z.string().min(1, 'Tag 不能为空').max(128),
  repository: z.enum(['dockerhub', 'ghcr']).default('dockerhub'),
})

export type ValidateTagInput = z.infer<typeof validateTagSchema>

export const activityLogQuerySchema = z.object({
  userKeyword: z.string().nullable().optional().transform(v => v ?? undefined),
  eventCategory: z.enum(['AUTH', 'OPENCLAW', 'IMAGE', 'USER', 'CONFIG', 'DATA']).nullable().optional().transform(v => v ?? undefined),
  eventType: z.string().nullable().optional().transform(v => v ?? undefined),
  result: z.enum(['success', 'failure']).nullable().optional().transform(v => v ?? undefined),
  startDate: z.string().nullable().optional().transform(v => v ?? undefined),
  endDate: z.string().nullable().optional().transform(v => v ?? undefined),
  page: z.string().nullable().optional().transform(v => v ? parseInt(v, 10) : 1).pipe(z.number().int().min(1)),
  pageSize: z.string().nullable().optional().transform(v => v ? parseInt(v, 10) : 20).pipe(z.number().int().min(1).max(100)),
})

export type ActivityLogQueryInput = z.infer<typeof activityLogQuerySchema>

export const buildImageSchema = z.object({
  baseImageId: z.string().min(1, '基础镜像不能为空'),
  dockerfile: z.string().min(1, 'Dockerfile 不能为空'),
  imageName: z.string().regex(/^[a-z0-9-]+$/, '镜像名只能包含小写字母、数字和横杠'),
  imageTag: z.string().regex(/^[a-zA-Z0-9._-]+$/, 'Tag 格式无效'),
})

export type BuildImageInput = z.infer<typeof buildImageSchema>