import fs from 'fs'
import path from 'path'

export interface FeishuConfig {
  enabled?: boolean
  appId: string
  appSecret: string
  encryptKey?: string
  dmPolicy?: 'pairing' | 'open' | 'disabled'
  allowFrom?: string[]
  groups?: { [key: string]: { requireMention?: boolean } }
}

export interface ModelConfig {
  primary: string
  fallbacks?: string[]
}

export interface OpenClawConfig {
  channels?: {
    feishu?: FeishuConfig
  }
  agents?: {
    defaults?: {
      model?: ModelConfig
    }
  }
  gateway?: {
    reload?: {
      mode?: string
    }
  }
}

const DEFAULT_CONFIG: OpenClawConfig = {
  channels: {},
  agents: {
    defaults: {
      model: {
        primary: '',
        fallbacks: [],
      },
    },
  },
}

export function getOpenClawConfigPath(dataDir: string): string {
  return path.join(dataDir, 'conf', 'openclaw.json')
}

export function readOpenClawConfig(dataDir: string): OpenClawConfig {
  const configPath = getOpenClawConfigPath(dataDir)
  try {
    if (!fs.existsSync(configPath)) {
      return DEFAULT_CONFIG
    }
    const content = fs.readFileSync(configPath, 'utf-8')
    const parsed = JSON.parse(content)
    return {
      ...DEFAULT_CONFIG,
      ...parsed,
      channels: { ...DEFAULT_CONFIG.channels, ...parsed.channels },
      agents: { ...DEFAULT_CONFIG.agents, ...parsed.agents },
    }
  } catch {
    return DEFAULT_CONFIG
  }
}

export function writeOpenClawConfig(
  dataDir: string,
  config: OpenClawConfig,
  existing: OpenClawConfig
): void {
  const configPath = getOpenClawConfigPath(dataDir)

  // Merge with existing config to preserve gateway, meta, etc.
  const merged = deepMerge(existing, config)

  // Ensure reload mode is set for hot-reload
  if (!merged.gateway?.reload?.mode) {
    merged.gateway = { ...merged.gateway, reload: { mode: 'file' } }
  }

  // Ensure directory exists
  const confDir = path.dirname(configPath)
  if (!fs.existsSync(confDir)) {
    fs.mkdirSync(confDir, { recursive: true })
  }

  // Try to fix permissions if file exists but is not writable
  if (fs.existsSync(configPath)) {
    try {
      fs.chmodSync(configPath, 0o666)
    } catch {
      // Ignore chmod errors, try to write anyway
    }
  }

  fs.writeFileSync(configPath, JSON.stringify(merged, null, 2))
}

function deepMerge(target: any, source: any): any {
  const result = { ...target }
  for (const key of Object.keys(source)) {
    if (
      source[key] !== null &&
      typeof source[key] === 'object' &&
      !Array.isArray(source[key]) &&
      target[key] !== null &&
      typeof target[key] === 'object' &&
      !Array.isArray(target[key])
    ) {
      result[key] = deepMerge(target[key], source[key])
    } else if (source[key] !== undefined) {
      result[key] = source[key]
    }
  }
  return result
}

export function mergeChannelConfig(
  existing: OpenClawConfig,
  feishu?: FeishuConfig
): OpenClawConfig {
  if (!feishu) return existing
  return {
    ...existing,
    channels: {
      ...existing.channels,
      feishu,
    },
  }
}

export function mergeModelConfig(
  existing: OpenClawConfig,
  model?: ModelConfig
): OpenClawConfig {
  if (!model) return existing
  return {
    ...existing,
    agents: {
      ...existing.agents,
      defaults: {
        ...existing.agents?.defaults,
        model,
      },
    },
  }
}