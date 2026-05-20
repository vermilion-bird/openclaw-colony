import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/db', () => ({
  prisma: {
    activityLog: {
      findUnique: vi.fn(),
    },
  },
}))
vi.mock('@/lib/auth', () => ({
  auth: vi.fn(),
}))

import { prisma } from '@/lib/db'
import { auth } from '@/lib/auth'

describe('GET /api/admin/activity-logs/:id', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(auth).mockResolvedValue({ user: { id: 'u1', role: 'admin' } })
  })

  it('returns 401 when not authenticated', async () => {
    vi.mocked(auth).mockResolvedValue(null)
    const { GET } = await import('@/app/api/admin/activity-logs/[id]/route')
    const req = new NextRequest('http://localhost/api/admin/activity-logs/1')
    const res = await GET(req, { params: Promise.resolve({ id: '1' }) })
    expect(res.status).toBe(401)
  })

  it('returns 403 when not admin', async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: 'u1', role: 'operator' } } as any)
    const { GET } = await import('@/app/api/admin/activity-logs/[id]/route')
    const req = new NextRequest('http://localhost/api/admin/activity-logs/1')
    const res = await GET(req, { params: Promise.resolve({ id: '1' }) })
    expect(res.status).toBe(403)
  })

  it('returns 400 on invalid ID', async () => {
    const { GET } = await import('@/app/api/admin/activity-logs/[id]/route')
    const req = new NextRequest('http://localhost/api/admin/activity-logs/invalid')
    const res = await GET(req, { params: Promise.resolve({ id: 'invalid' }) })
    expect(res.status).toBe(400)
  })

  it('returns 404 when log not found', async () => {
    vi.mocked(prisma.activityLog.findUnique).mockResolvedValue(null)
    const { GET } = await import('@/app/api/admin/activity-logs/[id]/route')
    const req = new NextRequest('http://localhost/api/admin/activity-logs/1')
    const res = await GET(req, { params: Promise.resolve({ id: '1' }) })
    expect(res.status).toBe(404)
  })

  it('returns log details', async () => {
    vi.mocked(prisma.activityLog.findUnique).mockResolvedValue({
      id: 1,
      userName: 'admin',
      userEmail: 'a@b.com',
      eventCategory: 'AUTH',
      eventType: 'auth.login',
      eventDesc: 'User logged in',
      targetType: null,
      targetId: null,
      targetName: null,
      result: 'success',
      failReason: null,
      ipAddress: '127.0.0.1',
      userAgent: 'Mozilla',
      extra: null,
      createdAt: new Date(),
    } as any)
    const { GET } = await import('@/app/api/admin/activity-logs/[id]/route')
    const req = new NextRequest('http://localhost/api/admin/activity-logs/1')
    const res = await GET(req, { params: Promise.resolve({ id: '1' }) })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.id).toBe(1)
    expect(body.userName).toBe('admin')
  })
})