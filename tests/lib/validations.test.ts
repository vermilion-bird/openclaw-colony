import { describe, it, expect } from 'vitest'
import { createInstanceSchema, updateConfigSchema, createUserSchema } from '@/lib/validations'

describe('createInstanceSchema', () => {
  it('accepts a valid instance payload', () => {
    const result = createInstanceSchema.safeParse({
      name: 'my-instance',
      imageTag: '1panel/openclaw:2026.5.7',
      port: 18789,
      provider: 'deepseek',
      model: 'deepseek-chat',
      apiKey: 'sk-test',
      bindAddress: '127.0.0.1',
      cpuLimit: 2,
      memoryLimit: '2G',
    })
    expect(result.success).toBe(true)
  })

  it('rejects a name with uppercase letters', () => {
    const result = createInstanceSchema.safeParse({
      name: 'MyInstance',
      port: 18789,
      provider: 'deepseek',
      model: 'deepseek-chat',
      apiKey: 'sk-test',
    })
    expect(result.success).toBe(false)
  })

  it('rejects port below 1024', () => {
    const result = createInstanceSchema.safeParse({
      name: 'ok',
      port: 80,
      provider: 'deepseek',
      model: 'x',
      apiKey: 'y',
    })
    expect(result.success).toBe(false)
  })
})

describe('updateConfigSchema', () => {
  it('accepts partial config update', () => {
    const result = updateConfigSchema.safeParse({ model: 'gpt-4o', apiKey: 'sk-new' })
    expect(result.success).toBe(true)
  })
})

describe('createUserSchema', () => {
  it('rejects short password', () => {
    const result = createUserSchema.safeParse({ email: 'a@b.com', password: 'short', role: 'operator' })
    expect(result.success).toBe(false)
  })
})
