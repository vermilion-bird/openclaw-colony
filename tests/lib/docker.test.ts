import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock dockerode before importing docker.ts
vi.mock('dockerode', () => {
  const mockContainer = {
    start: vi.fn().mockResolvedValue(undefined),
    stop: vi.fn().mockResolvedValue(undefined),
    restart: vi.fn().mockResolvedValue(undefined),
    remove: vi.fn().mockResolvedValue(undefined),
    inspect: vi.fn().mockResolvedValue({ State: { Status: 'running' } }),
    stats: vi.fn().mockResolvedValue({
      cpu_stats: { cpu_usage: { total_usage: 2000000000 }, system_cpu_usage: 10000000000, online_cpus: 4 },
      precpu_stats: { cpu_usage: { total_usage: 1000000000 }, system_cpu_usage: 9000000000 },
      memory_stats: { usage: 524288000, limit: 2147483648 },
    }),
  }
  const MockDockerode = vi.fn(function (this: any) {
    this.createContainer = vi.fn().mockResolvedValue({ id: 'abc123', ...mockContainer })
    this.getContainer = vi.fn().mockReturnValue(mockContainer)
    this.ping = vi.fn().mockResolvedValue('OK')
  })
  return { default: MockDockerode }
})

const { getDockerClient, createOpenClawContainer, startContainer, stopContainer, getContainerStats } = await import('@/lib/docker')

describe('docker wrapper', () => {
  it('getDockerClient returns dockerode instance', () => {
    expect(getDockerClient()).toBeDefined()
  })

  it('createOpenClawContainer calls docker.createContainer with correct spec', async () => {
    const docker = getDockerClient()
    const result = await createOpenClawContainer({
      name: 'test-instance',
      imageTag: '1panel/openclaw:2026.5.7',
      port: 18789,
      provider: 'deepseek',
      model: 'deepseek-chat',
      apiKey: 'sk-test',
      baseUrl: undefined,
      bindAddress: '127.0.0.1',
      allowedOrigin: undefined,
      cpuLimit: 2,
      memoryLimit: '2G',
      dataDir: '/data/instances/test-instance',
    })
    expect(docker.createContainer).toHaveBeenCalled()
    expect(result.id).toBe('abc123')
  })

  it('startContainer calls container.start', async () => {
    const docker = getDockerClient()
    await startContainer('abc123')
    expect(docker.getContainer('abc123').start).toHaveBeenCalled()
  })

  it('stopContainer calls container.stop with timeout', async () => {
    const docker = getDockerClient()
    await stopContainer('abc123')
    expect(docker.getContainer('abc123').stop).toHaveBeenCalled()
  })

  it('getContainerStats returns cpu and memory percentages', async () => {
    const stats = await getContainerStats('abc123')
    expect(stats.cpuPercent).toBeTypeOf('number')
    expect(stats.memUsedMb).toBeTypeOf('number')
    expect(stats.memLimitMb).toBeTypeOf('number')
  })
})
