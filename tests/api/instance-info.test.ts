import { describe, it, expect, vi } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/auth', () => ({
  auth: vi.fn().mockResolvedValue({ user: { id: 'user1', role: 'admin' } }),
}))
vi.mock('@/lib/db', () => ({
  prisma: {
    instance: {
      findUnique: vi.fn().mockResolvedValue({
        id: 'inst1', containerId: 'ctr1', dataDir: '/tmp/test-inst', name: 'test',
        port: 18789, status: 'running',
      }),
    },
  },
}))
vi.mock('@/lib/docker', () => ({
  getContainerStats: vi.fn().mockResolvedValue({ cpuPercent: 5.2, memUsedMb: 256, memLimitMb: 2048 }),
}))

describe('GET /api/instances/:id/stats', () => {
  it('returns cpu and memory stats', async () => {
    const { GET } = await import('@/app/api/instances/[id]/stats/route')
    const req = new NextRequest('http://localhost/api/instances/inst1/stats')
    const res = await GET(req, { params: Promise.resolve({ id: 'inst1' }) })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.cpuPercent).toBe(5.2)
    expect(body.memUsedMb).toBe(256)
  })
})

describe('GET /api/instances/:id/token', () => {
  it('returns 404 when openclaw.json does not exist', async () => {
    const { GET } = await import('@/app/api/instances/[id]/token/route')
    const req = new NextRequest('http://localhost/api/instances/inst1/token')
    const res = await GET(req, { params: Promise.resolve({ id: 'inst1' }) })
    // /tmp/test-inst/conf/openclaw.json doesn't exist
    expect(res.status).toBe(404)
  })
})
