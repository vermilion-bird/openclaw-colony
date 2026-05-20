import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/db', () => ({
  prisma: {
    instance: {
      findUnique: vi.fn(),
    },
  },
}))

vi.mock('@/lib/auth', () => ({
  auth: vi.fn().mockResolvedValue({ user: { id: 'user1', role: 'admin' } }),
}))

vi.mock('@/lib/openclaw-config', () => ({
  readOpenClawConfig: vi.fn(),
  writeOpenClawConfig: vi.fn(),
  mergeChannelConfig: vi.fn((existing, feishu) => ({
    ...existing,
    channels: { feishu },
  })),
  mergeModelConfig: vi.fn((existing, model) => ({
    ...existing,
    agents: { defaults: { model } },
  })),
}))

vi.mock('fs', () => ({
  default: {
    existsSync: vi.fn().mockReturnValue(true),
    readFileSync: vi.fn().mockReturnValue('{}'),
    writeFileSync: vi.fn(),
    mkdirSync: vi.fn(),
  },
  existsSync: vi.fn().mockReturnValue(true),
  readFileSync: vi.fn().mockReturnValue('{}'),
  writeFileSync: vi.fn(),
  mkdirSync: vi.fn(),
}))

const { GET, PUT } = await import('@/app/api/instances/[id]/openclaw-config/route')
import { prisma } from '@/lib/db'
import { readOpenClawConfig, writeOpenClawConfig } from '@/lib/openclaw-config'

describe('GET /api/instances/[id]/openclaw-config', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 401 when not authenticated', async () => {
    vi.mocked(prisma.instance.findUnique).mockResolvedValue(null)
    const req = new NextRequest('http://localhost/api/instances/inst1/openclaw-config')
    const res = await GET(req, { params: Promise.resolve({ id: 'inst1' }) })
    expect(res.status).toBe(401)
  })

  it('returns 404 when instance not found', async () => {
    vi.mocked(prisma.instance.findUnique).mockResolvedValue(null)
    const req = new NextRequest('http://localhost/api/instances/inst1/openclaw-config')
    const res = await GET(req, { params: Promise.resolve({ id: 'inst1' }) })
    expect(res.status).toBe(404)
  })

  it('returns config when instance exists', async () => {
    vi.mocked(prisma.instance.findUnique).mockResolvedValue({
      id: 'inst1',
      dataDir: '/data/test',
    } as any)
    vi.mocked(readOpenClawConfig).mockReturnValue({
      channels: { feishu: { appId: 'test', appSecret: 'secret' } },
      agents: { defaults: { model: { primary: 'deepseek/chat', fallbacks: [] } } },
    })

    const req = new NextRequest('http://localhost/api/instances/inst1/openclaw-config')
    const res = await GET(req, { params: Promise.resolve({ id: 'inst1' }) })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.channels).toBeDefined()
    expect(body.agents).toBeDefined()
  })
})

describe('PUT /api/instances/[id]/openclaw-config', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 400 on invalid input', async () => {
    vi.mocked(prisma.instance.findUnique).mockResolvedValue({
      id: 'inst1',
      dataDir: '/data/test',
    } as any)

    const req = new NextRequest('http://localhost/api/instances/inst1/openclaw-config', {
      method: 'PUT',
      body: JSON.stringify({ channels: { feishu: { appId: '' } } }),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await PUT(req, { params: Promise.resolve({ id: 'inst1' }) })
    expect(res.status).toBe(400)
  })

  it('updates feishu config', async () => {
    vi.mocked(prisma.instance.findUnique).mockResolvedValue({
      id: 'inst1',
      dataDir: '/data/test',
    } as any)
    vi.mocked(readOpenClawConfig).mockReturnValue({ channels: {}, agents: {} })
    vi.mocked(writeOpenClawConfig).mockImplementation(() => {})

    const req = new NextRequest('http://localhost/api/instances/inst1/openclaw-config', {
      method: 'PUT',
      body: JSON.stringify({
        channels: { feishu: { appId: 'new-app', appSecret: 'new-secret' } },
      }),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await PUT(req, { params: Promise.resolve({ id: 'inst1' }) })
    expect(res.status).toBe(200)
    expect(writeOpenClawConfig).toHaveBeenCalled()
  })

  it('updates model config', async () => {
    vi.mocked(prisma.instance.findUnique).mockResolvedValue({
      id: 'inst1',
      dataDir: '/data/test',
    } as any)
    vi.mocked(readOpenClawConfig).mockReturnValue({ channels: {}, agents: {} })
    vi.mocked(writeOpenClawConfig).mockImplementation(() => {})

    const req = new NextRequest('http://localhost/api/instances/inst1/openclaw-config', {
      method: 'PUT',
      body: JSON.stringify({
        agents: { defaults: { model: { primary: 'anthropic/claude-sonnet-4-6', fallbacks: ['openai/gpt-4o'] } } },
      }),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await PUT(req, { params: Promise.resolve({ id: 'inst1' }) })
    expect(res.status).toBe(200)
    expect(writeOpenClawConfig).toHaveBeenCalled()
  })
})