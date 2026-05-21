'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { PROVIDERS } from '@/lib/validations'
import { AlertTriangle } from 'lucide-react'

interface ActiveImage {
  repository: string
  tag: string
}

export default function NewInstancePage() {
  const router = useRouter()
  const [activeImage, setActiveImage] = useState<ActiveImage | null>(null)
  const [noActiveImage, setNoActiveImage] = useState(false)
  const [form, setForm] = useState({
    name: '', imageTag: '', port: '18789',
    provider: 'deepseek', model: '', apiKey: '', baseUrl: '',
    bindAddress: '127.0.0.1', allowedOrigin: '', cpuLimit: '2', memoryLimit: '2G',
    gatewayToken: '',
  })
  const [error, setError] = useState('')
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    // Fetch active image on mount
    fetch('/api/images?limit=1')
      .then(res => res.json())
      .then(data => {
        const active = data.images?.find((img: any) => img.isActive)
        if (active) {
          setActiveImage({ repository: active.repository, tag: active.tag })
          setForm(f => ({ ...f, imageTag: `${active.repository}:${active.tag}` }))
        } else {
          setNoActiveImage(true)
        }
      })
      .catch(() => setNoActiveImage(true))
  }, [])

  function set(key: string, val: string) { setForm(f => ({ ...f, [key]: val })) }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (noActiveImage && !form.imageTag) {
      setError('请先在镜像管理中设置生效镜像')
      return
    }
    setCreating(true)
    setError('')
    const payload = {
      ...form,
      port: parseInt(form.port),
      cpuLimit: parseFloat(form.cpuLimit),
      baseUrl: form.baseUrl || undefined,
      allowedOrigin: form.allowedOrigin || undefined,
      gatewayToken: form.gatewayToken || undefined,
    }
    const res = await fetch('/api/instances', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    if (res.ok) {
      router.push('/')
    } else {
      const data = await res.json()
      setError(typeof data.error === 'string' ? data.error : '创建失败，请检查输入')
      setCreating(false)
    }
  }

  return (
    <div className="max-w-xl mx-auto">
      {noActiveImage && (
        <div className="mb-4 bg-yellow-50 border border-yellow-200 rounded-lg p-3 flex items-start gap-2">
          <AlertTriangle className="w-5 h-5 text-yellow-600 mt-0.5" />
          <div className="text-sm">
            <p className="font-medium text-yellow-700">无生效镜像</p>
            <p className="text-yellow-600">请先在镜像管理中设置生效镜像，或手动填写镜像 Tag</p>
          </div>
        </div>
      )}
      <Card>
        <CardHeader><CardTitle>新建 OpenClaw 实例</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label htmlFor="name">实例名（小写字母/数字/横杠）</Label>
                <Input
                  id="name"
                  value={form.name}
                  onChange={e => set('name', e.target.value)}
                  placeholder="my-instance"
                  pattern="[a-z0-9-]+"
                  required
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="port">端口</Label>
                <Input
                  id="port"
                  type="number"
                  value={form.port}
                  onChange={e => set('port', e.target.value)}
                  min={1024}
                  max={65535}
                  required
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label>提供商</Label>
              <Select value={form.provider} onValueChange={v => set('provider', v ?? '')}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PROVIDERS.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label htmlFor="model">模型名</Label>
                <Input
                  id="model"
                  value={form.model}
                  onChange={e => set('model', e.target.value)}
                  placeholder="deepseek-chat"
                  required
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="apiKey">API Key</Label>
                <Input
                  id="apiKey"
                  type="password"
                  value={form.apiKey}
                  onChange={e => set('apiKey', e.target.value)}
                  required
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label htmlFor="baseUrl">Base URL（可选，用于 Ollama 等）</Label>
              <Input
                id="baseUrl"
                value={form.baseUrl}
                onChange={e => set('baseUrl', e.target.value)}
                placeholder="http://localhost:11434"
              />
            </div>
            <details className="text-sm">
              <summary className="cursor-pointer text-gray-500 hover:text-gray-700">高级选项</summary>
              <div className="mt-3 space-y-4 pl-2 border-l-2 border-gray-100">
                <div className="space-y-1">
                  <Label htmlFor="imageTag">镜像 Tag</Label>
                  <Input
                    id="imageTag"
                    value={form.imageTag}
                    onChange={e => set('imageTag', e.target.value)}
                    placeholder={activeImage ? `${activeImage.repository}:${activeImage.tag}` : 'openclaw/openclaw:latest'}
                  />
                  {activeImage && (
                    <p className="text-xs text-gray-400">当前生效镜像: {activeImage.repository}:{activeImage.tag}</p>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <Label htmlFor="cpuLimit">CPU 上限</Label>
                    <Input
                      id="cpuLimit"
                      type="number"
                      step="0.5"
                      value={form.cpuLimit}
                      onChange={e => set('cpuLimit', e.target.value)}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="memoryLimit">内存上限</Label>
                    <Input
                      id="memoryLimit"
                      value={form.memoryLimit}
                      onChange={e => set('memoryLimit', e.target.value)}
                      placeholder="2G"
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <Label>绑定地址</Label>
                  <Select value={form.bindAddress} onValueChange={v => set('bindAddress', v ?? '')}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="127.0.0.1">127.0.0.1（仅本机）</SelectItem>
                      <SelectItem value="0.0.0.0">0.0.0.0（局域网）</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="allowedOrigin">外部访问地址（可选 HTTPS URL）</Label>
                  <Input
                    id="allowedOrigin"
                    value={form.allowedOrigin}
                    onChange={e => set('allowedOrigin', e.target.value)}
                    placeholder="https://my-domain.com"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="gatewayToken">Gateway Token</Label>
                  <Input
                    id="gatewayToken"
                    value={form.gatewayToken}
                    onChange={e => set('gatewayToken', e.target.value)}
                    placeholder="留空自动生成 32 位随机 token"
                  />
                </div>
              </div>
            </details>
            {error && <p className="text-sm text-red-500">{error}</p>}
            <div className="flex gap-3 pt-2">
              <Button type="button" variant="outline" onClick={() => router.back()}>取消</Button>
              <Button type="submit" disabled={creating} className="flex-1">
                {creating ? '创建中...' : '创建实例'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
