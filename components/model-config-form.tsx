'use client'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Plus, X } from 'lucide-react'

interface ModelConfig {
  primary: string
  fallbacks: string[]
}

interface Props {
  instanceId: string
  initialConfig: ModelConfig | null
  onSaved: () => void
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

export function ModelConfigForm({ instanceId, initialConfig, onSaved }: Props) {
  const [config, setConfig] = useState<ModelConfig>(
    initialConfig ?? { primary: '', fallbacks: [] }
  )
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [newFallback, setNewFallback] = useState('')

  function update<K extends keyof ModelConfig>(key: K, value: ModelConfig[K]) {
    setConfig(c => ({ ...c, [key]: value }))
  }

  function addFallback() {
    if (newFallback.trim()) {
      update('fallbacks', [...config.fallbacks, newFallback.trim()])
      setNewFallback('')
    }
  }

  function removeFallback(index: number) {
    update('fallbacks', config.fallbacks.filter((_, i) => i !== index))
  }

  async function handleSave() {
    if (!config.primary) {
      setError('主模型不能为空')
      return
    }
    setSaving(true)
    setError('')

    const payload = {
      agents: {
        defaults: {
          model: {
            primary: config.primary,
            fallbacks: config.fallbacks.length > 0 ? config.fallbacks : undefined,
          },
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
          <CardTitle className="text-sm">模型配置</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1">
            <Label htmlFor="primary">主模型 *</Label>
            <Input
              id="primary"
              value={config.primary}
              onChange={e => update('primary', e.target.value)}
              placeholder="provider/model-name"
              list="model-hints"
            />
            <datalist id="model-hints">
              {MODEL_HINTS.map(h => <option key={h} value={h} />)}
            </datalist>
            <p className="text-xs text-gray-500">
              格式：provider/model-name，如 anthropic/claude-sonnet-4-6
            </p>
          </div>

          <div className="space-y-1">
            <Label>Fallback 模型列表</Label>
            <p className="text-xs text-gray-500">
              主模型失败时按顺序依次尝试 fallback 模型
            </p>
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
            {config.fallbacks.length > 0 && (
              <div className="space-y-1 mt-2">
                {config.fallbacks.map((model, i) => (
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