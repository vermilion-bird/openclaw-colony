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

export interface AgentIdentity {
  name?: string
  theme?: string
  emoji?: string
  avatar?: string
}

export interface AgentTools {
  profile?: 'minimal' | 'coding' | 'messaging' | 'full'
  allow?: string[]
  deny?: string[]
}

export interface AgentConfig {
  id: string
  default?: boolean
  identity?: AgentIdentity
  model?: string | ModelConfig
  tools?: AgentTools
}

export interface BindingMatch {
  channel?: string
  peer?: string
  guildId?: string
  accountId?: string
  teamId?: string
}

export interface BindingConfig {
  agentId: string
  match: BindingMatch
}

export interface AgentsConfig {
  list?: AgentConfig[]
}

export interface OpenClawConfig {
  channels?: {
    feishu?: FeishuConfig
  }
  agents?: {
    defaults?: {
      model?: ModelConfig
    }
    list?: AgentConfig[]
  }
  bindings?: BindingConfig[]
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
    list: [],
  },
  bindings: [],
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
      bindings: parsed.bindings ?? DEFAULT_CONFIG.bindings,
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

export function mergeAgentsConfig(
  existing: OpenClawConfig,
  agents?: AgentsConfig,
  bindings?: BindingConfig[]
): OpenClawConfig {
  const result = { ...existing }

  if (agents?.list) {
    result.agents = {
      ...existing.agents,
      list: agents.list,
    }
  }

  if (bindings) {
    result.bindings = bindings
  }

  return result
}