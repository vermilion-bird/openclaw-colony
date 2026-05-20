import { describe, it, expect, beforeEach, vi } from 'vitest'

// Mock prisma to avoid initialization issues
vi.mock('@/lib/db', () => ({
  prisma: {
    activityLog: {
      create: vi.fn(),
    },
  },
}))

beforeEach(() => {
  process.env.ENCRYPTION_KEY = 'a'.repeat(64)
  process.env.DATABASE_URL = 'file:./tests/test.db'
})

describe('Activity Logs Service', () => {
  // Type exports cannot be checked at runtime, so we verify the module structure
  it('exports logActivity function', async () => {
    const lib = await import('@/lib/activity-log')
    expect(lib.logActivity).toBeDefined()
    expect(typeof lib.logActivity).toBe('function')
  })
})

describe('Activity Log Query Validation', () => {
  it('validates valid query parameters', async () => {
    const { activityLogQuerySchema } = await import('@/lib/validations')
    // Schema expects string values (from query params) and transforms them
    const result = activityLogQuerySchema.safeParse({
      userKeyword: 'test',
      eventCategory: 'AUTH',
      result: 'success',
      page: '1',
      pageSize: '20',
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.page).toBe(1)
      expect(result.data.pageSize).toBe(20)
    }
  })

  it('rejects invalid eventCategory', async () => {
    const { activityLogQuerySchema } = await import('@/lib/validations')
    const result = activityLogQuerySchema.safeParse({
      eventCategory: 'INVALID',
    })
    expect(result.success).toBe(false)
  })

  it('rejects invalid result', async () => {
    const { activityLogQuerySchema } = await import('@/lib/validations')
    const result = activityLogQuerySchema.safeParse({
      result: 'pending',
    })
    expect(result.success).toBe(false)
  })

  it('applies default values for page and pageSize', async () => {
    const { activityLogQuerySchema } = await import('@/lib/validations')
    const result = activityLogQuerySchema.safeParse({})
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.page).toBe(1)
      expect(result.data.pageSize).toBe(20)
    }
  })

  it('rejects pageSize > 100', async () => {
    const { activityLogQuerySchema } = await import('@/lib/validations')
    const result = activityLogQuerySchema.safeParse({
      pageSize: 200,
    })
    expect(result.success).toBe(false)
  })
})