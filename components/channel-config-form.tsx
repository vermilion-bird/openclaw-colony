'use client'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Plus, X } from 'lucide-react'

interface FeishuConfig {
  enabled: boolean
  appId: string
  appSecret: string
  encryptKey: string
  dmPolicy: 'pairing' | 'open' | 'disabled'
  allowFrom: string[]
  requireMention: boolean
}

interface Props {
  instanceId: string
  initialConfig: FeishuConfig | null
  onSaved: () => void
}

export function ChannelConfigForm({ instanceId, initialConfig, onSaved }: Props) {
  const [config, setConfig] = useState<FeishuConfig>(
    initialConfig ?? {
      enabled: true,
      appId: '',
      appSecret: '',
      encryptKey: '',
      dmPolicy: 'pairing',
      allowFrom: [],
      requireMention: true,
    }
  )
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [newAllowFrom, setNewAllowFrom] = useState('')

  function update<K extends keyof FeishuConfig>(key: K, value: FeishuConfig[K]) {
    setConfig(c => ({ ...c, [key]: value }))
  }

  function addAllowFrom() {
    if (newAllowFrom.trim()) {
      update('allowFrom', [...config.allowFrom, newAllowFrom.trim()])
      setNewAllowFrom('')
    }
  }

  function removeAllowFrom(index: number) {
    update('allowFrom', config.allowFrom.filter((_, i) => i !== index))
  }

  async function handleSave() {
    if (!config.appId || !config.appSecret) {
      setError('App ID and App Secret are required')
      return
    }
    setSaving(true)
    setError('')

    const payload = {
      channels: {
        feishu: {
          enabled: config.enabled,
          appId: config.appId,
          appSecret: config.appSecret,
          encryptKey: config.encryptKey || undefined,
          dmPolicy: config.dmPolicy,
          allowFrom: config.allowFrom.length > 0 ? config.allowFrom : undefined,
          groups: config.requireMention ? { '*': { requireMention: true } } : undefined,
        },
      },
    }

    const res = await fetch(`/api/instances/${instanceId}/openclaw-config`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    if (res.ok) {
      onSaved()
    } else {
      const data = await res.json()
      setError(typeof data.error === 'string' ? data.error : '保存失败')
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">飞书配置</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-2">
            <Checkbox
              id="enabled"
              checked={config.enabled}
              onCheckedChange={v => update('enabled', v === true)}
            />
            <Label htmlFor="enabled">启用飞书渠道</Label>
          </div>

          <div className="space-y-1">
            <Label htmlFor="appId">App ID *</Label>
            <Input
              id="appId"
              value={config.appId}
              onChange={e => update('appId', e.target.value)}
              placeholder="飞书应用 App ID"
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="appSecret">App Secret *</Label>
            <Input
              id="appSecret"
              type="password"
              value={config.appSecret}
              onChange={e => update('appSecret', e.target.value)}
              placeholder="飞书应用 App Secret"
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="encryptKey">Encrypt Key（可选）</Label>
            <Input
              id="encryptKey"
              value={config.encryptKey}
              onChange={e => update('encryptKey', e.target.value)}
              placeholder="消息加密 Key"
            />
          </div>

          <div className="space-y-1">
            <Label>DM Policy</Label>
            <Select
              value={config.dmPolicy}
              onValueChange={v => update('dmPolicy', v as FeishuConfig['dmPolicy'])}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pairing">配对（默认）</SelectItem>
                <SelectItem value="open">开放</SelectItem>
                <SelectItem value="disabled">禁用</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <details className="text-sm">
            <summary className="cursor-pointer text-gray-500 hover:text-gray-700">高级选项</summary>
            <div className="mt-3 space-y-4 pl-2 border-l-2 border-gray-100">
              <div className="space-y-1">
                <Label>Allow From（用户 ID 白名单）</Label>
                <div className="flex gap-2">
                  <Input
                    value={newAllowFrom}
                    onChange={e => setNewAllowFrom(e.target.value)}
                    placeholder="用户 ID"
                  />
                  <Button size="sm" variant="outline" onClick={addAllowFrom}>
                    <Plus className="w-3 h-3" />
                  </Button>
                </div>
                {config.allowFrom.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {config.allowFrom.map((id, i) => (
                      <span
                        key={i}
                        className="inline-flex items-center gap-1 px-2 py-0.5 bg-gray-100 rounded text-xs"
                      >
                        {id}
                        <X
                          className="w-3 h-3 cursor-pointer hover:text-red-500"
                          onClick={() => removeAllowFrom(i)}
                        />
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2">
                <Checkbox
                  id="requireMention"
                  checked={config.requireMention}
                  onCheckedChange={v => update('requireMention', v === true)}
                />
                <Label htmlFor="requireMention">群消息需要 @ 提及</Label>
              </div>
            </div>
          </details>
        </CardContent>
      </Card>

      {error && <p className="text-sm text-red-500">{error}</p>}
      <p className="text-xs text-gray-500">配置将自动热更新，无需重启实例</p>
      <Button onClick={handleSave} disabled={saving} className="w-full">
        {saving ? '保存中...' : '保存配置'}
      </Button>
    </div>
  )
}