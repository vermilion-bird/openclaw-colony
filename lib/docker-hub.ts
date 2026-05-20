import { z } from 'zod'

const DOCKER_HUB_API = 'https://hub.docker.com/v2/repositories/openclaw/openclaw/tags'
const TIMEOUT_MS = 5000
const CACHE_TTL_MS = 10 * 60 * 1000 // 10 minutes

// In-memory cache
const tagCache = new Map<string, { data: TagInfo; timestamp: number }>()

export interface TagInfo {
  tag: string
  digest: string
  pushedAt: Date
  compressedSize: number
  os: string
  architecture: string
}

export function clearTagCache(): void {
  tagCache.clear()
}

export async function fetchTagInfo(tag: string, timeoutMs = TIMEOUT_MS): Promise<TagInfo | null> {
  // Check cache first
  const cached = tagCache.get(tag)
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.data
  }

  const url = `${DOCKER_HUB_API}/${tag}`

  try {
    const response = await fetchWithTimeout(url, timeoutMs)

    if (!response.ok) {
      if (response.status === 404) return null
      throw new Error(`Docker Hub API 错误: ${response.status}`)
    }

    const data = await response.json()

    // Extract first image variant (assume linux/amd64 if multiple)
    const image = data.images?.[0] ?? { os: 'linux', architecture: 'amd64' }

    const info: TagInfo = {
      tag: data.name,
      digest: data.digest,
      pushedAt: new Date(data.last_pushed),
      compressedSize: data.full_size,
      os: image.os,
      architecture: image.architecture,
    }

    // Cache the result
    tagCache.set(tag, { data: info, timestamp: Date.now() })

    return info
  } catch (err) {
    if (err instanceof Error && err.message.includes('Timeout')) {
      throw new Error('Docker Hub API 超时，请稍后重试')
    }
    throw err
  }
}

async function fetchWithTimeout(url: string, timeoutMs: number): Promise<Response> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

  try {
    // Retry once on failure
    let response = await fetch(url, { signal: controller.signal })
    if (!response.ok && response.status >= 500) {
      response = await fetch(url, { signal: controller.signal })
    }
    return response
  } finally {
    clearTimeout(timeoutId)
  }
}