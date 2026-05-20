import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/db', () => ({
  prisma: {
    image: {
      findUnique: vi.fn(),
      updateMany: vi.fn(),
      update: vi.fn(),
    },
    auditLog: {
      create: vi.fn(),
    },
    $transaction: vi.fn((fn: any) => fn(prisma)),
  },
}))

vi.mock('@/lib/auth', () => ({
  auth: vi.fn(),
}))

const { PATCH } = await import('@/app/api/images/[id]/activate/route')
import { prisma } from '@/lib/db'
import { auth } from '@/lib/auth'

describe('PATCH /api/images/[id]/activate', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 401 if not authenticated', async () => {
    vi.mocked(auth).mockResolvedValue(null)
    const req = new NextRequest('http://localhost/api/images/img1/activate', { method: 'PATCH' })
    const res = await PATCH(req, { params: Promise.resolve({ id: 'img1' }) })
    expect(res.status).toBe(401)
  })

  it('returns 403 if not admin', async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: 'u1', role: 'operator' } } as any)
    const req = new NextRequest('http://localhost/api/images/img1/activate', { method: 'PATCH' })
    const res = await PATCH(req, { params: Promise.resolve({ id: 'img1' }) })
    expect(res.status).toBe(403)
  })

  it('returns 404 if image not found', async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: 'u1', role: 'admin' } } as any)
    vi.mocked(prisma.image.findUnique).mockResolvedValue(null)

    const req = new NextRequest('http://localhost/api/images/img1/activate', { method: 'PATCH' })
    const res = await PATCH(req, { params: Promise.resolve({ id: 'img1' }) })
    expect(res.status).toBe(404)
  })

  it('activates image and creates audit log', async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: 'u1', role: 'admin' } } as any)
    vi.mocked(prisma.image.findUnique).mockResolvedValue({
      id: 'img1',
      tag: 'v1.0.0',
      digest: 'sha256:abc',
      isActive: false,
    } as any)
    vi.mocked(prisma.image.updateMany).mockResolvedValue({ count: 2 })
    vi.mocked(prisma.image.update).mockResolvedValue({
      id: 'img1',
      isActive: true,
    } as any)
    vi.mocked(prisma.auditLog.create).mockResolvedValue({} as any)

    const req = new NextRequest('http://localhost/api/images/img1/activate', { method: 'PATCH' })
    const res = await PATCH(req, { params: Promise.resolve({ id: 'img1' }) })
    expect(res.status).toBe(200)
    expect(prisma.image.updateMany).toHaveBeenCalledWith({ where: {}, data: { isActive: false } })
    expect(prisma.image.update).toHaveBeenCalledWith({ where: { id: 'img1' }, data: { isActive: true } })
    expect(prisma.auditLog.create).toHaveBeenCalled()
  })

  it('is idempotent for already active image', async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: 'u1', role: 'admin' } } as any)
    vi.mocked(prisma.image.findUnique).mockResolvedValue({
      id: 'img1',
      tag: 'v1.0.0',
      digest: 'sha256:abc',
      isActive: true,
    } as any)
    vi.mocked(prisma.image.updateMany).mockResolvedValue({ count: 1 })
    vi.mocked(prisma.image.update).mockResolvedValue({
      id: 'img1',
      isActive: true,
    } as any)

    const req = new NextRequest('http://localhost/api/images/img1/activate', { method: 'PATCH' })
    const res = await PATCH(req, { params: Promise.resolve({ id: 'img1' }) })
    expect(res.status).toBe(200)
    expect(prisma.image.updateMany).toHaveBeenCalled()
  })
})