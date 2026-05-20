import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/db', () => ({
  prisma: {
    image: {
      findMany: vi.fn(),
      create: vi.fn(),
      findFirst: vi.fn(),
      count: vi.fn(),
    },
    auditLog: {
      create: vi.fn(),
    },
  },
}))

vi.mock('@/lib/auth', () => ({
  auth: vi.fn(),
}))

vi.mock('@/lib/docker-hub', () => ({
  fetchTagInfo: vi.fn(),
}))

const { GET, POST } = await import('@/app/api/images/route')
import { prisma } from '@/lib/db'
import { auth } from '@/lib/auth'
import { fetchTagInfo } from '@/lib/docker-hub'

describe('GET /api/images', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 401 if not authenticated', async () => {
    vi.mocked(auth).mockResolvedValue(null)
    const req = new NextRequest('http://localhost/api/images')
    const res = await GET(req)
    expect(res.status).toBe(401)
  })

  it('returns 403 if not admin', async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: 'u1', role: 'operator' } } as any)
    const req = new NextRequest('http://localhost/api/images')
    const res = await GET(req)
    expect(res.status).toBe(403)
  })

  it('returns paginated image list', async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: 'u1', role: 'admin' } } as any)
    vi.mocked(prisma.image.findMany).mockResolvedValue([
      { id: 'img1', tag: 'v1.0.0', digest: 'sha256:a', isActive: false, pushedAt: new Date(), importedAt: new Date() } as any,
    ])
    vi.mocked(prisma.image.count).mockResolvedValue(1)

    const req = new NextRequest('http://localhost/api/images?page=1&limit=10')
    const res = await GET(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.images).toHaveLength(1)
    expect(body.total).toBe(1)
  })
})

describe('POST /api/images (import)', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 401 if not authenticated', async () => {
    vi.mocked(auth).mockResolvedValue(null)
    const req = new NextRequest('http://localhost/api/images', {
      method: 'POST',
      body: JSON.stringify({ tag: 'latest' }),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req)
    expect(res.status).toBe(401)
  })

  it('imports image and creates audit log', async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: 'u1', role: 'admin' } } as any)
    vi.mocked(fetchTagInfo).mockResolvedValue({
      tag: 'latest',
      digest: 'sha256:abc123',
      pushedAt: new Date('2026-05-20T10:00:00Z'),
      compressedSize: 500000000,
      os: 'linux',
      architecture: 'amd64',
    })
    vi.mocked(prisma.image.findFirst).mockResolvedValue(null) // No duplicate
    vi.mocked(prisma.image.create).mockResolvedValue({
      id: 'img1',
      repository: 'openclaw/openclaw',
      tag: 'latest',
      digest: 'sha256:abc123',
      os: 'linux',
      architecture: 'amd64',
      compressedSize: 500000000,
      isActive: false,
      pushedAt: new Date('2026-05-20T10:00:00Z'),
      importedAt: new Date(),
      importedBy: 'u1',
    } as any)
    vi.mocked(prisma.auditLog.create).mockResolvedValue({} as any)

    const req = new NextRequest('http://localhost/api/images', {
      method: 'POST',
      body: JSON.stringify({ tag: 'latest' }),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req)
    expect(res.status).toBe(201)
    expect(prisma.image.create).toHaveBeenCalled()
    expect(prisma.auditLog.create).toHaveBeenCalled()
  })

  it('returns 400 if digest already exists', async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: 'u1', role: 'admin' } } as any)
    vi.mocked(fetchTagInfo).mockResolvedValue({
      tag: 'latest',
      digest: 'sha256:duplicate',
      pushedAt: new Date(),
      compressedSize: 500000000,
      os: 'linux',
      architecture: 'amd64',
    })
    vi.mocked(prisma.image.findFirst).mockResolvedValue({ id: 'existing' } as any)

    const req = new NextRequest('http://localhost/api/images', {
      method: 'POST',
      body: JSON.stringify({ tag: 'latest' }),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toContain('该版本已导入')
  })

  it('returns 404 if tag not found on Docker Hub', async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: 'u1', role: 'admin' } } as any)
    vi.mocked(fetchTagInfo).mockResolvedValue(null)

    const req = new NextRequest('http://localhost/api/images', {
      method: 'POST',
      body: JSON.stringify({ tag: 'nonexistent' }),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req)
    expect(res.status).toBe(404)
  })
})