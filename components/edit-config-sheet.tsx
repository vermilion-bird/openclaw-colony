'use client'
import { useEffect, useState } from 'react'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from '@/components/ui/sheet'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ChannelConfigForm } from '@/components/channel-config-form'
import { ModelConfigForm } from '@/components/model-config-form'

interface FeishuConfig {
  enabled: boolean
  appId: string
  appSecret: string
  encryptKey: string
  dmPolicy: 'pairing' | 'open' | 'disabled'
  allowFrom: string[]
  requireMention: boolean
}

interface ModelConfig {
  primary: string
  fallbacks: string[]
}

interface OpenClawConfigData {
  channels: { feishu?: any }
  agents: { defaults?: { model?: ModelConfig } }
}

interface Props {
  instanceId: string
  onClose: () => void
  onSaved: () => void
}

export function EditConfigSheet({ instanceId, onClose, onSaved }: Props) {
  const [tab, setTab] = useState('basic')
  const [basicForm, setBasicForm] = useState({
    provider: '', model: '', apiKey: '', baseUrl: '', cpuLimit: '', memoryLimit: '',
    gatewayToken: '',
  })
  const [feishuConfig, setFeishuConfig] = useState<FeishuConfig | null>(null)
  const [modelConfig, setModelConfig] = useState<ModelConfig | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    // Fetch basic config
    fetch(`/api/instances/${instanceId}`).then(r => r.json()).then(data => {
      setBasicForm({
        provider: data.provider ?? '',
        model: data.model ?? '',
        apiKey: '',
        baseUrl: data.baseUrl ?? '',
        cpuLimit: String(data.cpuLimit ?? 2),
        memoryLimit: data.memoryLimit ?? '2G',
        gatewayToken: data.gatewayToken ?? '',
      })
    })

    // Fetch openclaw config
    fetch(`/api/instances/${instanceId}/openclaw-config`).then(r => r.json()).then(data => {
      const feishu = data.channels?.feishu
      if (feishu) {
        setFeishuConfig({
          enabled: feishu.enabled ?? true,
          appId: feishu.appId ?? '',
          appSecret: feishu.appSecret ?? '',
          encryptKey: feishu.encryptKey ?? '',
          dmPolicy: feishu.dmPolicy ?? 'pairing',
          allowFrom: feishu.allowFrom ?? [],
          requireMention: feishu.groups?.['*']?.requireMention ?? true,
        })
      }

      const model = data.agents?.defaults?.model
      if (model) {
        setModelConfig({
          primary: model.primary ?? '',
          fallbacks: model.fallbacks ?? [],
        })
      }
    })
  }, [instanceId])

  async function handleBasicSave() {
    setSaving(true)
    setError('')
    const payload: Record<string, string | number> = {
      provider: basicForm.provider,
      model: basicForm.model,
      baseUrl: basicForm.baseUrl,
      cpuLimit: parseFloat(basicForm.cpuLimit),
      memoryLimit: basicForm.memoryLimit,
    }
    if (basicForm.apiKey) payload.apiKey = basicForm.apiKey
    if (basicForm.gatewayToken) payload.gatewayToken = basicForm.gatewayToken

    const res = await fetch(`/api/instances/${instanceId}/config`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    if (res.ok) {
      onSaved()
      onClose()
    } else {
      const data = await res.json()
      setError(typeof data.error === 'string' ? data.error : '保存失败')
      setSaving(false)
    }
  }

  return (
    <Sheet open onOpenChange={onClose}>
      <SheetContent className="w-[400px] space-y-4">
        <SheetHeader><SheetTitle>编辑配置</SheetTitle></SheetHeader>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="w-full">
            <TabsTrigger value="basic" className="flex-1">基础</TabsTrigger>
            <TabsTrigger value="channel" className="flex-1">渠道</TabsTrigger>
            <TabsTrigger value="model" className="flex-1">模型</TabsTrigger>
          </TabsList>

          <TabsContent value="basic" className="space-y-4 mt-4">
            <p className="text-sm text-amber-600 bg-amber-50 p-2 rounded">
              ⚠️ 此操作会重启实例，数据保留，连接中断约 5s
            </p>
            {[
              { key: 'provider', label: '提供商', type: 'text' },
              { key: 'model', label: '模型名', type: 'text' },
              { key: 'apiKey', label: 'API Key（留空保持不变）', type: 'password' },
              { key: 'baseUrl', label: 'Base URL（可选）', type: 'text' },
              { key: 'gatewayToken', label: 'Gateway Token（留空保持不变）', type: 'text' },
              { key: 'cpuLimit', label: 'CPU 上限', type: 'number' },
              { key: 'memoryLimit', label: '内存上限（如 2G）', type: 'text' },
            ].map(({ key, label, type }) => (
              <div key={key} className="space-y-1">
                <Label>{label}</Label>
                <Input
                  type={type}
                  value={(basicForm as any)[key]}
                  onChange={e => setBasicForm(f => ({ ...f, [key]: e.target.value }))}
                />
              </div>
            ))}
            {error && <p className="text-sm text-red-500">{error}</p>}
            <SheetFooter>
              <Button onClick={handleBasicSave} disabled={saving} className="w-full">
                {saving ? '保存并重建中...' : '保存配置'}
              </Button>
            </SheetFooter>
          </TabsContent>

          <TabsContent value="channel" className="mt-4">
            <ChannelConfigForm
              instanceId={instanceId}
              initialConfig={feishuConfig}
              onSaved={() => { onSaved(); onClose(); }}
            />
          </TabsContent>

          <TabsContent value="model" className="mt-4">
            <ModelConfigForm
              instanceId={instanceId}
              initialConfig={modelConfig}
              onSaved={() => { onSaved(); onClose(); }}
            />
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  )
}