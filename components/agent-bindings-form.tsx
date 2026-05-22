'use client'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Plus, X } from 'lucide-react'

interface BindingConfig {
  agentId: string
  match: {
    channel?: string
    peer?: string
    guildId?: string
    accountId?: string
    teamId?: string
  }
}

interface Props {
  value: BindingConfig[]
  onChange: (bindings: BindingConfig[]) => void
  agentOptions: { id: string; name?: string }[]
}

const CHANNEL_OPTIONS = [
  { value: 'feishu', label: '飞书' },
  { value: 'discord', label: 'Discord' },
  { value: 'telegram', label: 'Telegram' },
  { value: 'whatsapp', label: 'WhatsApp' },
]

export function AgentBindingsForm({ value, onChange, agentOptions }: Props) {
  const [newBinding, setNewBinding] = useState<BindingConfig>({
    agentId: '',
    match: { channel: 'feishu' },
  })

  function addBinding() {
    if (!newBinding.agentId) return
    onChange([...value, newBinding])
    setNewBinding({ agentId: '', match: { channel: 'feishu' } })
  }

  function removeBinding(index: number) {
    onChange(value.filter((_, i) => i !== index))
  }

  function updateNewBinding<K extends keyof BindingConfig>(key: K, val: BindingConfig[K]) {
    setNewBinding(b => ({ ...b, [key]: val }))
  }

  function updateNewMatch<K extends keyof BindingConfig['match']>(key: K, val: string) {
    setNewBinding(b => ({
      ...b,
      match: { ...b.match, [key]: val },
    }))
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">渠道绑定</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-xs text-gray-500">
            将特定渠道（群聊/私聊）绑定到 Agent。匹配优先级：peer &gt; guildId &gt; teamId &gt; accountId
          </p>

          {value.length > 0 && (
            <div className="space-y-2">
              {value.map((binding, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between p-2 bg-gray-50 rounded"
                >
                  <div className="text-sm">
                    <span className="font-medium">{binding.agentId}</span>
                    <span className="text-gray-500 mx-1">→</span>
                    {binding.match.channel && <span>{binding.match.channel}</span>}
                    {binding.match.peer && <span className="text-blue-600"> (peer: {binding.match.peer})</span>}
                    {binding.match.guildId && <span className="text-blue-600"> (group: {binding.match.guildId})</span>}
                    {binding.match.accountId && <span className="text-blue-600"> (account: {binding.match.accountId})</span>}
                  </div>
                  <X
                    className="w-4 h-4 cursor-pointer hover:text-red-500"
                    onClick={() => removeBinding(i)}
                  />
                </div>
              ))}
            </div>
          )}

          <div className="space-y-2 border-t pt-4">
            <Label>添加新绑定</Label>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-xs">Agent</Label>
                <Select
                  value={newBinding.agentId}
                  onValueChange={v => updateNewBinding('agentId', v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="选择 Agent" />
                  </SelectTrigger>
                  <SelectContent>
                    {agentOptions.map(a => (
                      <SelectItem key={a.id} value={a.id}>
                        {a.name ?? a.id}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label className="text-xs">渠道类型</Label>
                <Select
                  value={newBinding.match.channel ?? 'feishu'}
                  onValueChange={v => updateNewMatch('channel', v)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CHANNEL_OPTIONS.map(c => (
                      <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <details className="text-sm">
              <summary className="cursor-pointer text-gray-500 hover:text-gray-700">匹配条件</summary>
              <div className="mt-2 space-y-2 pl-2 border-l-2 border-gray-100">
                <div className="space-y-1">
                  <Label className="text-xs">Peer ID（私聊）</Label>
                  <Input
                    value={newBinding.match.peer ?? ''}
                    onChange={e => updateNewMatch('peer', e.target.value)}
                    placeholder="如：oc_xxx"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Guild ID（群聊）</Label>
                  <Input
                    value={newBinding.match.guildId ?? ''}
                    onChange={e => updateNewMatch('guildId', e.target.value)}
                    placeholder="如：group_xxx"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Account ID</Label>
                  <Input
                    value={newBinding.match.accountId ?? ''}
                    onChange={e => updateNewMatch('accountId', e.target.value)}
                    placeholder="如：account_xxx 或 *"
                  />
                </div>
              </div>
            </details>

            <Button size="sm" variant="outline" onClick={addBinding} disabled={!newBinding.agentId}>
              <Plus className="w-3 h-3 mr-1" />添加绑定
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}