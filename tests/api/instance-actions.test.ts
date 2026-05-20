import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const mockInstance = {
  id: 'inst1', name: 'test', containerId: 'ctr1', port: 18789,
  provider: 'deepseek', model: 'deepseek-chat', apiKey: 'enc:sk-test',
  imageTag: '1panel/openclaw:2026.5.7', bindAddress: '127.0.0.1',
  cpuLimit: 2, memoryLimit: '2G', dataDir: '/data/test', status: 'running',
  baseUrl: null, allowedOrigin: null, createdBy: 'user1', createdAt: new Date(),
}

vi.mock('@/lib/db', () => ({
  prisma: {
    instance: {
      findUnique: vi.fn().mockResolvedValue(mockInstance),
      delete: vi.fn().mockResolvedValue(mockInstance),
      update: vi.fn().mockResolvedValue(mockInstance),
    },
  },
}))
vi.mock('@/lib/docker', () => ({
  startContainer: vi.fn().mockResolvedValue(undefined),
  stopContainer: vi.fn().mockResolvedValue(undefined),
  restartContainer: vi.fn().mockResolvedValue(undefined),
  removeContainer: vi.fn().mockResolvedValue(undefined),
  createOpenClawContainer: vi.fn().mockResolvedValue({ id: 'new-ctr' }),
  getContainerStatus: vi.fn().mockResolvedValue('running'),
}))
vi.mock('@/lib/crypto', () => ({
  encrypt: vi.fn((s: string) => `enc:${s}`),
  decrypt: vi.fn((s: string) => s.replace('enc:', '')),
}))
vi.mock('@/lib/auth', () => ({
  auth: vi.fn().mockResolvedValue({ user: { id: 'user1', role: 'admin' } }),
}))
vi.mock('fs', () => ({
  default: { rmSync: vi.fn(), existsSync: vi.fn().mockReturnValue(false) },
  rmSync: vi.fn(),
  existsSync: vi.fn().mockReturnValue(false),
}))

describe('DELETE /api/instances/:id', () => {
  it('removes instance and returns 200', async () => {
    const { DELETE } = await import('@/app/api/instances/[id]/route')
    const req = new NextRequest('http://localhost/api/instances/inst1', { method: 'DELETE' })
    const res = await DELETE(req, { params: Promise.resolve({ id: 'inst1' }) })
    expect(res.status).toBe(200)
  })
})

describe('POST /api/instances/:id/start', () => {
  it('starts the instance', async () => {
    const { POST } = await import('@/app/api/instances/[id]/start/route')
    const req = new NextRequest('http://localhost/api/instances/inst1/start', { method: 'POST' })
    const res = await POST(req, { params: Promise.resolve({ id: 'inst1' }) })
    expect(res.status).toBe(200)
  })
})

describe('POST /api/instances/:id/stop', () => {
  it('stops the instance', async () => {
    const { POST } = await import('@/app/api/instances/[id]/stop/route')
    const req = new NextRequest('http://localhost/api/instances/inst1/stop', { method: 'POST' })
    const res = await POST(req, { params: Promise.resolve({ id: 'inst1' }) })
    expect(res.status).toBe(200)
  })
})

describe('POST /api/instances/:id/restart', () => {
  it('restarts the instance', async () => {
    const { POST } = await import('@/app/api/instances/[id]/restart/route')
    const req = new NextRequest('http://localhost/api/instances/inst1/restart', { method: 'POST' })
    const res = await POST(req, { params: Promise.resolve({ id: 'inst1' }) })
    expect(res.status).toBe(200)
  })
})
