'use client'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ToolConfigForm } from '@/components/tool-config-form'
import { Plus, X } from 'lucide-react'

interface AgentConfig {
  id: string
  default?: boolean
  identity?: { name?: string; theme?: string; emoji?: string; avatar?: string }
  model?: string | { primary: string; fallbacks?: string[] }
  tools?: { profile?: string; allow?: string[]; deny?: string[] }
}

interface Props {
  instanceId: string
  initialAgent: AgentConfig | null
  existingIds: string[]
  onSave: (agent: AgentConfig) => void
  onCancel: () => void
}

const MODEL_HINTS = [
  'anthropic/claude-opus-4-7',
  'anthropic/claude-sonnet-4-6',
  'openai/gpt-4o',
  'openai/gpt-4o-mini',
  'deepseek/deepseek-chat',
  'google/gemini-2.0-flash',
  'ollama/llama3',
]

function generateId(): string {
  return 'agent-' + Math.random().toString(36).substring(2, 8)
}

function normalizeModel(model: AgentConfig['model']): { primary: string; fallbacks?: string[] } {
  if (!model) return { primary: '' }
  if (typeof model === 'string') return { primary: model }
  return model
}

export function AgentEditForm({ instanceId, initialAgent, existingIds, onSave, onCancel }: Props) {
  const [agent, setAgent] = useState<AgentConfig>(
    initialAgent ? {
      ...initialAgent,
      model: normalizeModel(initialAgent.model),
    } : { id: generateId(), default: false, identity: {}, model: { primary: '' }, tools: {} }
  )
  const [newFallback, setNewFallback] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const isEdit = initialAgent !== null

  function getModelPrimary(): string {
    const m = agent.model
    if (!m) return ''
    return typeof m === 'string' ? m : m.primary
  }

  function getModelFallbacks(): string[] {
    const m = agent.model
    if (!m || typeof m === 'string') return []
    return m.fallbacks ?? []
  }

  function update<K extends keyof AgentConfig>(key: K, value: AgentConfig[K]) {
    setAgent(a => ({ ...a, [key]: value }))
  }

  function updateIdentity<K extends keyof NonNullable<AgentConfig['identity']>>(key: K, value: string) {
    setAgent(a => ({
      ...a,
      identity: { ...a.identity, [key]: value },
    }))
  }

  function addFallback() {
    if (newFallback.trim()) {
      const fallbacks = getModelFallbacks()
      update('model', { primary: getModelPrimary(), fallbacks: [...fallbacks, newFallback.trim()] })
      setNewFallback('')
    }
  }

  function removeFallback(index: number) {
    const fallbacks = getModelFallbacks()
    update('model', { primary: getModelPrimary(), fallbacks: fallbacks.filter((_, i) => i !== index) })
  }

  function handleSave() {
    setError('')

    if (!agent.id) {
      setError('Agent ID 不能为空')
      return
    }

    if (!isEdit && existingIds.includes(agent.id)) {
      setError('Agent ID 已存在')
      return
    }

    if (!getModelPrimary()) {
      setError('主模型不能为空')
      return
    }

    setSaving(true)
    onSave(agent)
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">{isEdit ? '编辑 Agent' : '新建 Agent'}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1">
            <Label htmlFor="id">Agent ID *</Label>
            <Input
              id="id"
              value={agent.id}
              onChange={e => update('id', e.target.value)}
              placeholder="唯一标识符"
              disabled={isEdit}
            />
            <p className="text-xs text-gray-500">创建后不可修改，建议使用英文标识</p>
          </div>

          <div className="flex items-center gap-2">
            <Checkbox
              id="default"
              checked={agent.default ?? false}
              onCheckedChange={v => update('default', v === true)}
            />
            <Label htmlFor="default">设为默认 Agent</Label>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label htmlFor="name">显示名称</Label>
              <Input
                id="name"
                value={agent.identity?.name ?? ''}
                onChange={e => updateIdentity('name', e.target.value)}
                placeholder="如：翻译助手"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="emoji">Emoji</Label>
              <Input
                id="emoji"
                value={agent.identity?.emoji ?? ''}
                onChange={e => updateIdentity('emoji', e.target.value)}
                placeholder="如：🌐"
              />
            </div>
          </div>

          <div className="space-y-1">
            <Label htmlFor="primary">主模型 *</Label>
            <Input
              id="primary"
              value={getModelPrimary()}
              onChange={e => update('model', { primary: e.target.value, fallbacks: getModelFallbacks() })}
              placeholder="provider/model-name"
              list="model-hints"
            />
            <datalist id="model-hints">
              {MODEL_HINTS.map(h => <option key={h} value={h} />)}
            </datalist>
          </div>

          <div className="space-y-1">
            <Label>Fallback 模型</Label>
            <div className="flex gap-2">
              <Input
                value={newFallback}
                onChange={e => setNewFallback(e.target.value)}
                placeholder="provider/model-name"
                list="model-hints"
              />
              <Button size="sm" variant="outline" onClick={addFallback}>
                <Plus className="w-3 h-3" />
              </Button>
            </div>
            {getModelFallbacks().length > 0 && (
              <div className="space-y-1 mt-2">
                {getModelFallbacks().map((model, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between p-2 bg-gray-50 rounded"
                  >
                    <span className="text-sm">{i + 1}. {model}</span>
                    <X
                      className="w-4 h-4 cursor-pointer hover:text-red-500"
                      onClick={() => removeFallback(i)}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>

          <ToolConfigForm
            value={agent.tools ?? {}}
            onChange={tools => update('tools', tools)}
          />
        </CardContent>
      </Card>

      {error && <p className="text-sm text-red-500">{error}</p>}
      <div className="flex gap-2">
        <Button variant="outline" onClick={onCancel} className="flex-1">
          取消
        </Button>
        <Button onClick={handleSave} disabled={saving} className="flex-1">
          {saving ? '保存中...' : '保存'}
        </Button>
      </div>
    </div>
  )
}