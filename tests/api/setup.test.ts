import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/db', () => ({
  prisma: {
    user: {
      count: vi.fn(),
      create: vi.fn(),
    },
  },
}))

const { POST } = await import('@/app/api/setup/route')
import { prisma } from '@/lib/db'

describe('POST /api/setup', () => {
  beforeEach(() => vi.clearAllMocks())

  it('creates first admin when no users exist', async () => {
    vi.mocked(prisma.user.count).mockResolvedValue(0)
    vi.mocked(prisma.user.create).mockResolvedValue({ id: '1', email: 'admin@test.com', role: 'admin' } as any)

    const req = new NextRequest('http://localhost/api/setup', {
      method: 'POST',
      body: JSON.stringify({ email: 'admin@test.com', password: 'password123' }),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req)
    expect(res.status).toBe(201)
  })

  it('returns 409 if users already exist', async () => {
    vi.mocked(prisma.user.count).mockResolvedValue(1)
    const req = new NextRequest('http://localhost/api/setup', {
      method: 'POST',
      body: JSON.stringify({ email: 'admin@test.com', password: 'password123' }),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req)
    expect(res.status).toBe(409)
  })

  it('returns 400 on invalid input', async () => {
    vi.mocked(prisma.user.count).mockResolvedValue(0)
    const req = new NextRequest('http://localhost/api/setup', {
      method: 'POST',
      body: JSON.stringify({ email: 'not-an-email', password: '123' }),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })
})
