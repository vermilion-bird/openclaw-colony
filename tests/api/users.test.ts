import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/auth', () => ({
  auth: vi.fn().mockResolvedValue({ user: { id: 'admin1', role: 'admin' } }),
}))
vi.mock('@/lib/db', () => ({
  prisma: {
    user: {
      findMany: vi.fn().mockResolvedValue([
        { id: 'admin1', email: 'a@b.com', role: 'admin', createdAt: new Date() },
      ]),
      create: vi.fn().mockResolvedValue({ id: 'u2', email: 'b@c.com', role: 'operator', createdAt: new Date() }),
      count: vi.fn().mockResolvedValue(2),
      findUnique: vi.fn().mockResolvedValue({ id: 'u2', email: 'b@c.com', role: 'operator' }),
      update: vi.fn().mockResolvedValue({ id: 'u2', role: 'admin' }),
      delete: vi.fn().mockResolvedValue({ id: 'u2' }),
    },
  },
}))

describe('GET /api/users', () => {
  it('returns user list for admin', async () => {
    const { GET } = await import('@/app/api/users/route')
    const req = new NextRequest('http://localhost/api/users')
    const res = await GET(req)
    expect(res.status).toBe(200)
  })
})

describe('POST /api/users', () => {
  beforeEach(() => vi.clearAllMocks())

  it('creates a new user', async () => {
    const { POST } = await import('@/app/api/users/route')
    const req = new NextRequest('http://localhost/api/users', {
      method: 'POST',
      body: JSON.stringify({ email: 'b@c.com', password: 'password123', role: 'operator' }),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req)
    expect(res.status).toBe(201)
  })
})

describe('DELETE /api/users/:id', () => {
  it('deletes a non-admin user', async () => {
    const { DELETE } = await import('@/app/api/users/[id]/route')
    const req = new NextRequest('http://localhost/api/users/u2', { method: 'DELETE' })
    const res = await DELETE(req, { params: Promise.resolve({ id: 'u2' }) })
    expect(res.status).toBe(200)
  })

  it('blocks deleting the last admin', async () => {
    const { prisma } = await import('@/lib/db')
    vi.mocked(prisma.user.count).mockResolvedValue(1)
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ id: 'admin1', role: 'admin' } as any)
    const { DELETE } = await import('@/app/api/users/[id]/route')
    const req = new NextRequest('http://localhost/api/users/admin1', { method: 'DELETE' })
    const res = await DELETE(req, { params: Promise.resolve({ id: 'admin1' }) })
    expect(res.status).toBe(409)
  })
})
