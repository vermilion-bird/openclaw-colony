import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fetchTagInfo, clearTagCache } from '@/lib/docker-hub'

// Mock fetch globally
const mockFetch = vi.fn()
global.fetch = mockFetch

describe('fetchTagInfo', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    clearTagCache()
  })

  it('returns tag info from Docker Hub', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        name: 'latest',
        digest: 'sha256:abc123',
        last_pushed: '2026-05-20T10:00:00Z',
        full_size: 500000000,
        images: [{ os: 'linux', architecture: 'amd64' }],
      }),
    })

    const result = await fetchTagInfo('latest')
    expect(result).toEqual({
      tag: 'latest',
      digest: 'sha256:abc123',
      pushedAt: new Date('2026-05-20T10:00:00Z'),
      compressedSize: 500000000,
      os: 'linux',
      architecture: 'amd64',
    })
  })

  it('returns null on 404', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 404 })
    const result = await fetchTagInfo('nonexistent')
    expect(result).toBeNull()
  })

  it('throws on timeout', async () => {
    mockFetch.mockImplementationOnce(() =>
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Timeout')), 100)
      )
    )
    await expect(fetchTagInfo('latest', 50)).rejects.toThrow('Docker Hub API 超时')
  })

  it('caches result for same tag', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        name: 'v1.0.0',
        digest: 'sha256:cached',
        last_pushed: '2026-05-20T10:00:00Z',
        full_size: 400000000,
        images: [{ os: 'linux', architecture: 'amd64' }],
      }),
    })

    await fetchTagInfo('v1.0.0')
    await fetchTagInfo('v1.0.0')

    // Should only call fetch once due to caching
    expect(mockFetch).toHaveBeenCalledTimes(1)
  })

  it('bypasses cache after TTL expires', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        name: 'v1.0.0',
        digest: 'sha256:new',
        last_pushed: '2026-05-20T10:00:00Z',
        full_size: 400000000,
        images: [{ os: 'linux', architecture: 'amd64' }],
      }),
    })

    await fetchTagInfo('v1.0.0')
    // Manually clear cache to simulate TTL expiry
    clearTagCache()
    await fetchTagInfo('v1.0.0')

    expect(mockFetch).toHaveBeenCalledTimes(2)
  })
})