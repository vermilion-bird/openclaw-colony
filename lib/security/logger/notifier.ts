// lib/security/logger/notifier.ts

import { SecurityEvent } from '../types'

export interface NotifierConfig {
  channels: ('feishu' | 'email')[]
  feishuWebhook?: string
  emailRecipients?: string[]
  highRiskOnly: boolean
}

const DEFAULT_CONFIG: NotifierConfig = {
  channels: [],
  highRiskOnly: true,
}

export class SecurityNotifier {
  private config: NotifierConfig

  constructor(config?: NotifierConfig) {
    this.config = config ?? DEFAULT_CONFIG
  }

  async notify(event: SecurityEvent): Promise<void> {
    if (this.config.highRiskOnly && event.riskLevel !== 'high') return

    const message = this.formatMessage(event)
    const promises: Promise<void>[] = []

    if (this.config.channels.includes('feishu') && this.config.feishuWebhook) {
      promises.push(this.sendFeishu(this.config.feishuWebhook, message))
    }

    if (this.config.channels.includes('email') && this.config.emailRecipients) {
      promises.push(this.sendEmail(this.config.emailRecipients, message))
    }

    await Promise.allSettled(promises)
  }

  private formatMessage(event: SecurityEvent): string {
    return `🚨 安全事件告警

层级: ${event.layer}
风险: ${event.riskLevel}
结果: ${event.result}

来源:
- 用户: ${event.userName || event.userId}
- 渠道: ${event.channelId}

检测器: ${event.detector}
原因: ${event.reason}

时间: ${event.timestamp.toISOString()}
事件ID: ${event.id}`
  }

  private async sendFeishu(webhook: string, message: string): Promise<void> {
    try {
      await fetch(webhook, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          msg_type: 'text',
          content: { text: message },
        }),
      })
    } catch (err) {
      console.error('Failed to send Feishu notification:', err)
    }
  }

  private async sendEmail(recipients: string[], message: string): Promise<void> {
    console.log('Email notification would be sent to:', recipients)
  }

  setConfig(config: NotifierConfig): void {
    this.config = config
  }
}