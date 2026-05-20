'use client'
import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { AlertTriangle, Loader2 } from 'lucide-react'

interface Props {
  imageId: string | null
  isActive: boolean
  onClose: () => void
  onDeleted: () => void
}

export function DeleteImageDialog({ imageId, isActive, onClose, onDeleted }: Props) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [confirmStep, setConfirmStep] = useState(0)

  useEffect(() => {
    if (imageId) {
      setConfirmStep(0)
      setError('')
    }
  }, [imageId])

  async function handleDelete() {
    if (!imageId) return

    if (isActive && confirmStep === 0) {
      setConfirmStep(1)
      return
    }

    setLoading(true)
    setError('')

    try {
      const res = await fetch(`/api/images/${imageId}`, { method: 'DELETE' })
      const data = await res.json()

      if (!res.ok) {
        setError(data.error || '删除失败')
      } else {
        onDeleted()
        onClose()
      }
    } catch {
      setError('网络错误，请稍后重试')
    } finally {
      setLoading(false)
      setConfirmStep(0)
    }
  }

  function handleClose() {
    setConfirmStep(0)
    setError('')
    onClose()
  }

  if (!imageId) return null

  return (
    <Dialog open={imageId !== null} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isActive && <AlertTriangle className="w-5 h-5 text-red-500" />}
            删除镜像
          </DialogTitle>
          <DialogDescription>
            {isActive && confirmStep === 0
              ? '该镜像当前生效，删除后将无生效镜像，新建 OpenClaw 可能失败，请谨慎操作'
              : '删除后数据将无法恢复'}
          </DialogDescription>
        </DialogHeader>

        {isActive && confirmStep === 0 && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
            <p className="font-medium">风险警告</p>
            <p className="mt-1">该镜像当前生效，删除后将无生效镜像，新建 OpenClaw 可能失败，请谨慎操作</p>
          </div>
        )}

        {error && <p className="text-sm text-red-500">{error}</p>}

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            取消
          </Button>
          <Button
            variant={isActive && confirmStep === 0 ? 'destructive' : 'default'}
            onClick={handleDelete}
            disabled={loading}
          >
            {loading && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
            {isActive && confirmStep === 0 ? '确认删除（需二次确认）' : '确认删除'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}