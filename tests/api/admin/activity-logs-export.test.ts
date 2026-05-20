import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/db', () => ({
  prisma: {
    activityLog: {
      findMany: vi.fn(),
    },
  },
}))
vi.mock('@/lib/auth', () => ({
  auth: vi.fn(),
}))

import { prisma } from '@/lib/db'
import { auth } from '@/lib/auth'

describe('GET /api/admin/activity-logs/export', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(auth).mockResolvedValue({ user: { id: 'u1', role: 'admin' } })
  })

  it('returns 401 when not authenticated', async () => {
    vi.mocked(auth).mockResolvedValue(null)
    const { GET } = await import('@/app/api/admin/activity-logs/export/route')
    const req = new NextRequest('http://localhost/api/admin/activity-logs/export')
    const res = await GET(req)
    expect(res.status).toBe(401)
  })

  it('returns 403 when not admin', async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: 'u1', role: 'operator' } } as any)
    const { GET } = await import('@/app/api/admin/activity-logs/export/route')
    const req = new NextRequest('http://localhost/api/admin/activity-logs/export')
    const res = await GET(req)
    expect(res.status).toBe(403)
  })

  it('exports activity logs as CSV', async () => {
    vi.mocked(prisma.activityLog.findMany).mockResolvedValue([
      { id: 1, userName: 'admin', userEmail: 'a@b.com', eventCategory: 'AUTH', eventType: 'auth.login', eventDesc: 'User logged in', targetType: null, targetId: null, targetName: null, result: 'success', failReason: null, ipAddress: '127.0.0.1', userAgent: 'Mozilla', extra: null, createdAt: new Date() } as any,
    ])
    const { GET } = await import('@/app/api/admin/activity-logs/export/route')
    const req = new NextRequest('http://localhost/api/admin/activity-logs/export')
    const res = await GET(req)
    expect(res.status).toBe(200)
    expect(res.headers.get('Content-Type')).toContain('text/csv')
    expect(res.headers.get('Content-Disposition')).toContain('attachment')
  })

  it('filters by userKeyword', async () => {
    vi.mocked(prisma.activityLog.findMany).mockResolvedValue([])
    const { GET } = await import('@/app/api/admin/activity-logs/export/route')
    const req = new NextRequest('http://localhost/api/admin/activity-logs/export?userKeyword=admin')
    const res = await GET(req)
    expect(res.status).toBe(200)
  })

  it('filters by eventCategory', async () => {
    vi.mocked(prisma.activityLog.findMany).mockResolvedValue([])
    const { GET } = await import('@/app/api/admin/activity-logs/export/route')
    const req = new NextRequest('http://localhost/api/admin/activity-logs/export?eventCategory=AUTH')
    const res = await GET(req)
    expect(res.status).toBe(200)
  })
})