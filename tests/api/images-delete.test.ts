import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/db', () => ({
  prisma: {
    image: {
      findUnique: vi.fn(),
      delete: vi.fn(),
    },
    auditLog: {
      create: vi.fn(),
    },
  },
}))

vi.mock('@/lib/auth', () => ({
  auth: vi.fn(),
}))

const { DELETE } = await import('@/app/api/images/[id]/route')
import { prisma } from '@/lib/db'
import { auth } from '@/lib/auth'

describe('DELETE /api/images/[id]', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 401 if not authenticated', async () => {
    vi.mocked(auth).mockResolvedValue(null)
    const req = new NextRequest('http://localhost/api/images/img1', { method: 'DELETE' })
    const res = await DELETE(req, { params: Promise.resolve({ id: 'img1' }) })
    expect(res.status).toBe(401)
  })

  it('returns 403 if not admin', async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: 'u1', role: 'operator' } } as any)
    const req = new NextRequest('http://localhost/api/images/img1', { method: 'DELETE' })
    const res = await DELETE(req, { params: Promise.resolve({ id: 'img1' }) })
    expect(res.status).toBe(403)
  })

  it('returns 404 if image not found', async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: 'u1', role: 'admin' } } as any)
    vi.mocked(prisma.image.findUnique).mockResolvedValue(null)

    const req = new NextRequest('http://localhost/api/images/img1', { method: 'DELETE' })
    const res = await DELETE(req, { params: Promise.resolve({ id: 'img1' }) })
    expect(res.status).toBe(404)
  })

  it('deletes image and creates audit log', async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: 'u1', role: 'admin' } } as any)
    vi.mocked(prisma.image.findUnique).mockResolvedValue({
      id: 'img1',
      tag: 'v1.0.0',
      digest: 'sha256:abc',
      isActive: false,
    } as any)
    vi.mocked(prisma.image.delete).mockResolvedValue({} as any)
    vi.mocked(prisma.auditLog.create).mockResolvedValue({} as any)

    const req = new NextRequest('http://localhost/api/images/img1', { method: 'DELETE' })
    const res = await DELETE(req, { params: Promise.resolve({ id: 'img1' }) })
    expect(res.status).toBe(200)
    expect(prisma.image.delete).toHaveBeenCalledWith({ where: { id: 'img1' } })
    expect(prisma.auditLog.create).toHaveBeenCalled()
  })

  it('returns warning when deleting active image', async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: 'u1', role: 'admin' } } as any)
    vi.mocked(prisma.image.findUnique).mockResolvedValue({
      id: 'img1',
      tag: 'v1.0.0',
      digest: 'sha256:abc',
      isActive: true,
    } as any)
    vi.mocked(prisma.image.delete).mockResolvedValue({} as any)
    vi.mocked(prisma.auditLog.create).mockResolvedValue({} as any)

    const req = new NextRequest('http://localhost/api/images/img1', { method: 'DELETE' })
    const res = await DELETE(req, { params: Promise.resolve({ id: 'img1' }) })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.warning).toBe(true)
  })
})