'use client'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Card, CardContent } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ExternalLink, Loader2 } from 'lucide-react'

interface Props {
  open: boolean
  onClose: () => void
  onImported: () => void
}

interface PreviewInfo {
  tag: string
  digest: string
  os: string
  architecture: string
  compressedSize: number
  pushedAt: string
  repository?: string
}

function formatSize(bytes: number): string {
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`
}

export function ImportImageDialog({ open, onClose, onImported }: Props) {
  const [repository, setRepository] = useState<'dockerhub' | 'ghcr'>('dockerhub')
  const [tag, setTag] = useState('')
  const [preview, setPreview] = useState<PreviewInfo | null>(null)
  const [error, setError] = useState('')
  const [validating, setValidating] = useState(false)
  const [importing, setImporting] = useState(false)

  async function handleValidate() {
    if (!tag.trim()) return
    setError('')
    setPreview(null)
    setValidating(true)

    try {
      const res = await fetch('/api/images/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tag: tag.trim(), repository }),
      })
      const data = await res.json()

      if (!res.ok) {
        setError(data.error || '查询失败')
      } else {
        setPreview(data)
      }
    } catch {
      setError('网络错误，请稍后重试')
    } finally {
      setValidating(false)
    }
  }

  async function handleImport() {
    if (!preview) return
    setError('')
    setImporting(true)

    try {
      const res = await fetch('/api/images', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tag: preview.tag, repository }),
      })
      const data = await res.json()

      if (!res.ok) {
        setError(data.error || '导入失败')
      } else {
        setTag('')
        setPreview(null)
        onImported()
        onClose()
      }
    } catch {
      setError('网络错误，请稍后重试')
    } finally {
      setImporting(false)
    }
  }

  function handleClose() {
    setTag('')
    setPreview(null)
    setError('')
    setRepository('dockerhub')
    onClose()
  }

  const hubUrl = 'https://hub.docker.com/r/openclaw/openclaw/tags'
  const ghcrUrl = 'https://github.com/openclaw-org/openclaw/pkgs/container/openclaw'

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>导入镜像</DialogTitle>
          <DialogDescription>
            选择镜像仓库来源，输入 Tag 版本号
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>镜像仓库</Label>
            <Select value={repository} onValueChange={v => setRepository(v as 'dockerhub' | 'ghcr')}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="dockerhub">Docker Hub (openclaw/openclaw)</SelectItem>
                <SelectItem value="ghcr">GitHub (ghcr.io/openclaw/openclaw)</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-gray-500">
              {repository === 'dockerhub' ? (
                <a
                  href={hubUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-blue-600 hover:underline"
                >
                  <ExternalLink className="w-3 h-3" />
                  查看所有可用 Tag
                </a>
              ) : (
                <a
                  href={ghcrUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-blue-600 hover:underline"
                >
                  <ExternalLink className="w-3 h-3" />
                  查看 GitHub Container Registry
                </a>
              )}
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="tag">Tag</Label>
            <Input
              id="tag"
              value={tag}
              onChange={e => setTag(e.target.value)}
              placeholder="如 latest、2026.5.18"
            />
          </div>

          <Button
            onClick={handleValidate}
            disabled={!tag.trim() || validating}
            variant="outline"
            className="w-full"
          >
            {validating && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
            {repository === 'ghcr' ? '拉取并查询' : '查询'}
          </Button>

          {error && <p className="text-sm text-red-500">{error}</p>}

          {preview && (
            <Card className="bg-gray-50">
              <CardContent className="pt-4 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">仓库:</span>
                  <span className="font-medium">{preview.repository}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Tag:</span>
                  <span className="font-medium">{preview.tag}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Digest:</span>
                  <span className="font-mono">{preview.digest.replace('sha256:', '').slice(0, 12)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">架构:</span>
                  <span>{preview.os}/{preview.architecture}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">大小:</span>
                  <span>{formatSize(preview.compressedSize)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">推送时间:</span>
                  <span>{new Date(preview.pushedAt).toLocaleDateString()}</span>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>取消</Button>
          <Button
            onClick={handleImport}
            disabled={!preview || importing}
          >
            {importing && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
            确认导入
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}