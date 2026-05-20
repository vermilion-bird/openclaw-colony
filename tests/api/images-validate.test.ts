import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/auth', () => ({
  auth: vi.fn(),
}))

vi.mock('@/lib/docker-hub', () => ({
  fetchTagInfo: vi.fn(),
}))

const { POST } = await import('@/app/api/images/validate/route')
import { auth } from '@/lib/auth'
import { fetchTagInfo } from '@/lib/docker-hub'

describe('POST /api/images/validate', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 401 if not authenticated', async () => {
    vi.mocked(auth).mockResolvedValue(null)
    const req = new NextRequest('http://localhost/api/images/validate', {
      method: 'POST',
      body: JSON.stringify({ tag: 'latest' }),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req)
    expect(res.status).toBe(401)
  })

  it('returns 403 if not admin', async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: 'u1', role: 'operator' } } as any)
    const req = new NextRequest('http://localhost/api/images/validate', {
      method: 'POST',
      body: JSON.stringify({ tag: 'latest' }),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req)
    expect(res.status).toBe(403)
  })

  it('returns preview info for valid tag', async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: 'u1', role: 'admin' } } as any)
    vi.mocked(fetchTagInfo).mockResolvedValue({
      tag: 'latest',
      digest: 'sha256:abc123',
      pushedAt: new Date('2026-05-20T10:00:00Z'),
      compressedSize: 500000000,
      os: 'linux',
      architecture: 'amd64',
    })

    const req = new NextRequest('http://localhost/api/images/validate', {
      method: 'POST',
      body: JSON.stringify({ tag: 'latest' }),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.tag).toBe('latest')
    expect(body.digest).toBe('sha256:abc123')
  })

  it('returns 404 for nonexistent tag', async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: 'u1', role: 'admin' } } as any)
    vi.mocked(fetchTagInfo).mockResolvedValue(null)

    const req = new NextRequest('http://localhost/api/images/validate', {
      method: 'POST',
      body: JSON.stringify({ tag: 'nonexistent' }),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req)
    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body.error).toContain('Tag 不存在')
  })

  it('returns 400 for empty tag', async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: 'u1', role: 'admin' } } as any)

    const req = new NextRequest('http://localhost/api/images/validate', {
      method: 'POST',
      body: JSON.stringify({ tag: '' }),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })
})