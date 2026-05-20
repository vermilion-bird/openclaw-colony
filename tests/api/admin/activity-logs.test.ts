import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/db', () => ({
  prisma: {
    activityLog: {
      findMany: vi.fn(),
      count: vi.fn(),
    },
  },
}))

vi.mock('@/lib/auth', () => ({
  auth: vi.fn(),
}))

const { GET } = await import('@/app/api/admin/activity-logs/route')
import { prisma } from '@/lib/db'
import { auth } from '@/lib/auth'

describe('GET /api/admin/activity-logs', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 401 when not authenticated', async () => {
    vi.mocked(auth).mockResolvedValue(null)
    const req = new NextRequest('http://localhost/api/admin/activity-logs')
    const res = await GET(req)
    expect(res.status).toBe(401)
  })

  it('returns 403 when not admin', async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: 'u1', role: 'operator' } } as any)
    const req = new NextRequest('http://localhost/api/admin/activity-logs')
    const res = await GET(req)
    expect(res.status).toBe(403)
  })

  it('returns paginated activity logs', async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: 'u1', role: 'admin' } } as any)
    vi.mocked(prisma.activityLog.findMany).mockResolvedValue([
      { id: 1, userName: 'admin', userEmail: 'a@b.com', eventCategory: 'AUTH', eventType: 'auth.login', result: 'success', createdAt: new Date() } as any,
    ])
    vi.mocked(prisma.activityLog.count).mockResolvedValue(1)

    const req = new NextRequest('http://localhost/api/admin/activity-logs')
    const res = await GET(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data).toHaveLength(1)
    expect(body.pagination.total).toBe(1)
    expect(body.pagination.page).toBe(1)
  })

  it('filters by userKeyword', async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: 'u1', role: 'admin' } } as any)
    vi.mocked(prisma.activityLog.findMany).mockResolvedValue([])
    vi.mocked(prisma.activityLog.count).mockResolvedValue(0)

    const req = new NextRequest('http://localhost/api/admin/activity-logs?userKeyword=admin')
    const res = await GET(req)
    expect(res.status).toBe(200)
  })

  it('filters by eventCategory', async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: 'u1', role: 'admin' } } as any)
    vi.mocked(prisma.activityLog.findMany).mockResolvedValue([])
    vi.mocked(prisma.activityLog.count).mockResolvedValue(0)

    const req = new NextRequest('http://localhost/api/admin/activity-logs?eventCategory=AUTH')
    const res = await GET(req)
    expect(res.status).toBe(200)
  })

  it('filters by result', async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: 'u1', role: 'admin' } } as any)
    vi.mocked(prisma.activityLog.findMany).mockResolvedValue([])
    vi.mocked(prisma.activityLog.count).mockResolvedValue(0)

    const req = new NextRequest('http://localhost/api/admin/activity-logs?result=success')
    const res = await GET(req)
    expect(res.status).toBe(200)
  })

  it('returns 400 on invalid page number', async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: 'u1', role: 'admin' } } as any)

    const req = new NextRequest('http://localhost/api/admin/activity-logs?page=0')
    const res = await GET(req)
    expect(res.status).toBe(400)
  })

  it('returns 400 on invalid pageSize', async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: 'u1', role: 'admin' } } as any)

    const req = new NextRequest('http://localhost/api/admin/activity-logs?pageSize=200')
    const res = await GET(req)
    expect(res.status).toBe(400)
  })

  it('returns 400 on invalid eventCategory', async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: 'u1', role: 'admin' } } as any)

    const req = new NextRequest('http://localhost/api/admin/activity-logs?eventCategory=INVALID')
    const res = await GET(req)
    expect(res.status).toBe(400)
  })

  it('returns 400 on invalid result', async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: 'u1', role: 'admin' } } as any)

    const req = new NextRequest('http://localhost/api/admin/activity-logs?result=invalid')
    const res = await GET(req)
    expect(res.status).toBe(400)
  })
})