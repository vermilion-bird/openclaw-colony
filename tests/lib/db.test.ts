import { describe, it, expect } from 'vitest'
import { prisma } from '@/lib/db'

describe('prisma singleton', () => {
  it('exports a PrismaClient instance', () => {
    expect(prisma).toBeDefined()
    expect(typeof prisma.user.findMany).toBe('function')
    expect(typeof prisma.instance.findMany).toBe('function')
  })

  it('returns the same instance on repeated imports', async () => {
    const { prisma: prisma2 } = await import('@/lib/db')
    expect(prisma).toBe(prisma2)
  })
})
