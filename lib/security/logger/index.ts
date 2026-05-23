// lib/security/logger/index.ts

import fs from 'fs'
import path from 'path'
import { SecurityEvent, SecurityContext, SecurityResult } from '../types'
import { SecurityNotifier } from './notifier'
import { maskPII, DEFAULT_DETECTORS } from '../pii-filter'

export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`
}

export class SecurityLogger {
  private logPath: string
  private retentionDays: number
  private notifier: SecurityNotifier

  constructor(logPath: string, retentionDays: number = 30) {
    this.logPath = logPath
    this.retentionDays = retentionDays
    this.notifier = new SecurityNotifier()
  }

  async record(ctx: SecurityContext, result: SecurityResult, layer: string): Promise<void> {
    const event: SecurityEvent = {
      id: generateId(),
      timestamp: new Date(),
      channelId: ctx.channelId,
      userId: ctx.userId,
      userName: ctx.userName,
      layer: layer as 'input' | 'pii' | 'output',
      result: result.action === 'reject' ? 'rejected' :
              result.action === 'mask_and_allow' ? 'masked' : 'warned',
      riskLevel: result.riskLevel,
      detector: result.detector || 'unknown',
      reason: result.reason || '',
      originalContent: this.sanitizeContent(ctx.message),
      matchedPattern: result.matchedPattern,
      confidence: result.confidence,
      actionTaken: result.action,
      notified: false,
    }

    await this.writeLog(event)

    if (result.riskLevel === 'high') {
      await this.notifier.notify(event)
      event.notified = true
    }
  }

  private async writeLog(event: SecurityEvent): Promise<void> {
    const date = event.timestamp.toISOString().slice(0, 10)
    const logFile = path.join(this.logPath, `security-${date}.jsonl`)

    if (!fs.existsSync(this.logPath)) {
      fs.mkdirSync(this.logPath, { recursive: true })
    }

    const line = JSON.stringify(event) + '\n'
    fs.appendFileSync(logFile, line)
  }

  sanitizeContent(content: string): string {
    const truncated = content.slice(0, 100)
    return maskPII(truncated, DEFAULT_DETECTORS)
  }

  async cleanup(): Promise<void> {
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - this.retentionDays)

    if (!fs.existsSync(this.logPath)) return

    const files = fs.readdirSync(this.logPath)
    for (const file of files) {
      if (file.startsWith('security-') && file.endsWith('.jsonl')) {
        const fileDate = file.replace('security-', '').replace('.jsonl', '')
        if (new Date(fileDate) < cutoffDate) {
          fs.unlinkSync(path.join(this.logPath, file))
        }
      }
    }
  }
}

export { SecurityNotifier } from './notifier'