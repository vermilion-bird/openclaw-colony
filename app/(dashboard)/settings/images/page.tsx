'use client'
import { useEffect, useState, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Plus } from 'lucide-react'
import { ImageListTable, ImageRow } from '@/components/image-list-table'
import { ImportImageDialog } from '@/components/import-image-dialog'
import { DeleteImageDialog } from '@/components/delete-image-dialog'
import { toast } from 'sonner'

export default function ImagesPage() {
  const { data: session } = useSession()
  const router = useRouter()
  const [images, setImages] = useState<ImageRow[]>([])
  const [loading, setLoading] = useState(true)
  const [importOpen, setImportOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; isActive: boolean } | null>(null)

  const fetchImages = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/images')
      if (res.ok) {
        const data = await res.json()
        setImages(data.images)
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (session && (session.user as any)?.role !== 'admin') {
      router.replace('/')
    }
    if (session) {
      fetchImages()
    }
  }, [session, router, fetchImages])

  async function handleActivate(id: string) {
    const res = await fetch(`/api/images/${id}/activate`, { method: 'PATCH' })
    if (res.ok) {
      toast.success('已设置为生效镜像')
      fetchImages()
    } else {
      const data = await res.json()
      toast.error(data.error || '设置失败')
    }
  }

  function handleDeleteClick(id: string) {
    const image = images.find(img => img.id === id)
    if (image) {
      setDeleteTarget({ id, isActive: image.isActive })
    }
  }

  if (!session) return null

  return (
    <div className="max-w-4xl space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">镜像管理</h2>
        <Button size="sm" onClick={() => setImportOpen(true)}>
          <Plus className="w-4 h-4 mr-1" />
          导入镜像
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">已导入镜像</CardTitle>
        </CardHeader>
        <CardContent>
          <ImageListTable
            images={images}
            loading={loading}
            onActivate={handleActivate}
            onDelete={handleDeleteClick}
          />
        </CardContent>
      </Card>

      <ImportImageDialog
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onImported={fetchImages}
      />

      <DeleteImageDialog
        imageId={deleteTarget?.id}
        isActive={deleteTarget?.isActive ?? false}
        onClose={() => setDeleteTarget(null)}
        onDeleted={() => {
          toast.success('镜像已删除')
          fetchImages()
        }}
      />
    </div>
  )
}