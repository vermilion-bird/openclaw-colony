import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/db', () => ({
  prisma: {
    instance: {
      findMany: vi.fn().mockResolvedValue([]),
      create: vi.fn(),
      update: vi.fn(),
      findUnique: vi.fn(),
    },
  },
}))

vi.mock('@/lib/docker', () => ({
  createOpenClawContainer: vi.fn().mockResolvedValue({ id: 'container-abc' }),
  startContainer: vi.fn().mockResolvedValue(undefined),
  getContainerStatus: vi.fn().mockResolvedValue('running'),
  pingDocker: vi.fn().mockResolvedValue(true),
}))

vi.mock('@/lib/crypto', () => ({
  encrypt: vi.fn((s: string) => `enc:${s}`),
  decrypt: vi.fn((s: string) => s.replace('enc:', '')),
}))

vi.mock('@/lib/auth', () => ({
  auth: vi.fn().mockResolvedValue({ user: { id: 'user1', role: 'admin' } }),
}))

vi.mock('fs', () => ({
  default: {
    mkdirSync: vi.fn(),
  },
  mkdirSync: vi.fn(),
}))

const { GET, POST } = await import('@/app/api/instances/route')
import { prisma } from '@/lib/db'

describe('GET /api/instances', () => {
  it('returns empty array when no instances', async () => {
    const req = new NextRequest('http://localhost/api/instances')
    const res = await GET(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toEqual([])
  })
})

describe('POST /api/instances', () => {
  beforeEach(() => vi.clearAllMocks())

  it('creates instance and returns 201', async () => {
    vi.mocked(prisma.instance.create).mockResolvedValue({
      id: 'inst1', name: 'test', containerId: null, port: 18789, status: 'creating',
      provider: 'deepseek', model: 'deepseek-chat', apiKey: 'enc:sk-test',
      imageTag: '1panel/openclaw:2026.5.7', bindAddress: '127.0.0.1',
      cpuLimit: 2, memoryLimit: '2G', dataDir: '/data/test',
      baseUrl: null, allowedOrigin: null, createdBy: 'user1', createdAt: new Date(),
    } as any)
    vi.mocked(prisma.instance.update).mockResolvedValue({} as any)

    const req = new NextRequest('http://localhost/api/instances', {
      method: 'POST',
      body: JSON.stringify({
        name: 'test', port: 18789, provider: 'deepseek',
        model: 'deepseek-chat', apiKey: 'sk-test',
      }),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req)
    expect(res.status).toBe(201)
  })

  it('returns 400 on invalid payload', async () => {
    const req = new NextRequest('http://localhost/api/instances', {
      method: 'POST',
      body: JSON.stringify({ name: 'INVALID NAME', port: 80 }),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })
})
