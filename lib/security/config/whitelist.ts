import fs from 'fs'
import { SecurityConfig } from '../types'
import { DEFAULT_SECURITY_CONFIG, getSecurityConfigPath } from './settings'

export function getDefaultConfig(): SecurityConfig {
  return { ...DEFAULT_SECURITY_CONFIG }
}

export class WhitelistManager {
  config: SecurityConfig
  private configPath: string

  constructor(configPath?: string) {
    this.configPath = configPath ?? ''
    this.config = this.load()
  }

  private load(): SecurityConfig {
    if (!this.configPath) return getDefaultConfig()

    try {
      if (!fs.existsSync(this.configPath)) return getDefaultConfig()
      const content = fs.readFileSync(this.configPath, 'utf-8')
      return { ...DEFAULT_SECURITY_CONFIG, ...JSON.parse(content) }
    } catch {
      return getDefaultConfig()
    }
  }

  reload(): void {
    this.config = this.load()
  }

  isWhitelisted(channelId: string, userId: string): boolean {
    if (!this.config.enabled) return true
    if (this.config.whitelist.channels.includes(channelId)) return true
    if (this.config.whitelist.users.includes(userId)) return true
    if (channelId.startsWith('ou_') && this.config.whitelist.dmPolicy === 'all_bypass') return true
    return false
  }

  addToWhitelist(type: 'channel' | 'user', id: string): void {
    if (type === 'channel') {
      if (!this.config.whitelist.channels.includes(id)) {
        this.config.whitelist.channels.push(id)
      }
    } else {
      if (!this.config.whitelist.users.includes(id)) {
        this.config.whitelist.users.push(id)
      }
    }
    this.save()
  }

  removeFromWhitelist(type: 'channel' | 'user', id: string): void {
    if (type === 'channel') {
      this.config.whitelist.channels = this.config.whitelist.channels.filter(c => c !== id)
    } else {
      this.config.whitelist.users = this.config.whitelist.users.filter(u => u !== id)
    }
    this.save()
  }

  private save(): void {
    if (this.configPath) {
      fs.writeFileSync(this.configPath, JSON.stringify(this.config, null, 2))
    }
  }
}

export { getSecurityConfigPath } from './settings'