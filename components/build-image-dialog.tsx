'use client'
import { useState, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Loader2, Hammer } from 'lucide-react'
import { ImageRow } from '@/components/image-list-table'
import { generateDockerfileTemplate } from '@/lib/docker-template'

interface Props {
  open: boolean
  onClose: () => void
  onBuilt: () => void
  images: ImageRow[]
}

export function BuildImageDialog({ open, onClose, onBuilt, images }: Props) {
  const [baseImageId, setBaseImageId] = useState('')
  const [dockerfile, setDockerfile] = useState('')
  const [imageName, setImageName] = useState('')
  const [imageTag, setImageTag] = useState('latest')
  const [building, setBuilding] = useState(false)
  const [logs, setLogs] = useState<string[]>([])
  const [error, setError] = useState('')
  const logsEndRef = useRef<HTMLDivElement>(null)

  // Auto-scroll logs to bottom
  useEffect(() => {
    if (logsEndRef.current) {
      logsEndRef.current.scrollTop = logsEndRef.current.scrollHeight
    }
  }, [logs])

  // When base image changes, generate Dockerfile template
  function handleBaseImageChange(value: string) {
    setBaseImageId(value)
    const baseImage = images.find(img => img.id === value)
    if (baseImage) {
      const template = generateDockerfileTemplate(baseImage.repository, baseImage.tag)
      setDockerfile(template)
    } else {
      setDockerfile('')
    }
  }

  async function handleBuild() {
    if (!dockerfile.trim() || !imageName.trim() || !imageTag.trim()) {
      setError('请填写所有必填字段')
      return
    }

    setError('')
    setLogs([])
    setBuilding(true)

    try {
      const res = await fetch('/api/images/build', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dockerfile: dockerfile.trim(),
          imageName: imageName.trim(),
          imageTag: imageTag.trim(),
        }),
      })

      const reader = res.body?.getReader()
      if (!reader) {
        setError('无法读取构建流')
        setBuilding(false)
        return
      }

      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          if (line.trim()) {
            try {
              const parsed = JSON.parse(line)
              if (parsed.log) {
                setLogs(prev => [...prev, parsed.log])
              }
              if (parsed.error) {
                setError(parsed.error)
              }
              if (parsed.success) {
                setLogs(prev => [...prev, '构建成功!'])
                setTimeout(() => {
                  onBuilt()
                  handleClose()
                }, 1000)
              }
            } catch {
              // If not JSON, just add as plain log
              setLogs(prev => [...prev, line])
            }
          }
        }
      }
    } catch (err: any) {
      setError(err.message || '构建失败')
    } finally {
      setBuilding(false)
    }
  }

  function handleClose() {
    if (building) return // Prevent closing while building
    setBaseImageId('')
    setDockerfile('')
    setImageName('')
    setImageTag('latest')
    setLogs([])
    setError('')
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>构建自定义镜像</DialogTitle>
          <DialogDescription>
            基于已导入的镜像创建自定义镜像，可修改 Dockerfile 添加额外配置
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-auto space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="baseImage">基础镜像</Label>
            <Select value={baseImageId} onValueChange={handleBaseImageChange}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="选择基础镜像" />
              </SelectTrigger>
              <SelectContent>
                {images.map(img => (
                  <SelectItem key={img.id} value={img.id}>
                    {img.repository}:{img.tag}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="dockerfile">Dockerfile</Label>
            <Textarea
              id="dockerfile"
              value={dockerfile}
              onChange={e => setDockerfile(e.target.value)}
              placeholder="选择基础镜像后自动生成模板，可自由编辑"
              className="font-mono text-xs min-h-[200px]"
              disabled={building}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="imageName">镜像名称</Label>
              <Input
                id="imageName"
                value={imageName}
                onChange={e => setImageName(e.target.value)}
                placeholder="如 my-openclaw"
                disabled={building}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="imageTag">镜像标签</Label>
              <Input
                id="imageTag"
                value={imageTag}
                onChange={e => setImageTag(e.target.value)}
                placeholder="latest"
                disabled={building}
              />
            </div>
          </div>

          {error && <p className="text-sm text-red-500">{error}</p>}

          {logs.length > 0 && (
            <div className="space-y-2">
              <Label>构建日志</Label>
              <div
                ref={logsEndRef}
                className="bg-gray-900 text-gray-100 rounded-md p-3 h-48 overflow-y-auto font-mono text-xs"
              >
                {logs.map((log, i) => (
                  <div key={i} className="whitespace-pre-wrap">{log}</div>
                ))}
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={building}>
            取消
          </Button>
          <Button
            onClick={handleBuild}
            disabled={!dockerfile.trim() || !imageName.trim() || !imageTag.trim() || building}
          >
            {building ? (
              <>
                <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                构建中...
              </>
            ) : (
              <>
                <Hammer className="w-4 h-4 mr-1" />
                开始构建
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}