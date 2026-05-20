'use client'
import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'

interface Props {
  instanceId: string
  onClose: () => void
  onDeleted: () => void
}

export function DeleteInstanceDialog({ instanceId, onClose, onDeleted }: Props) {
  const [deleteData, setDeleteData] = useState(false)
  const [deleting, setDeleting] = useState(false)

  async function handleDelete() {
    setDeleting(true)
    const url = `/api/instances/${instanceId}${deleteData ? '?deleteData=true' : ''}`
    const res = await fetch(url, { method: 'DELETE' })
    if (res.ok) {
      onDeleted()
      onClose()
    } else {
      setDeleting(false)
    }
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>删除实例</DialogTitle></DialogHeader>
        <p className="text-sm text-gray-600">此操作不可撤销，容器将被停止并删除。</p>
        <div className="flex items-center gap-2 mt-2">
          <Checkbox
            id="del-data"
            checked={deleteData}
            onCheckedChange={v => setDeleteData(!!v)}
          />
          <Label htmlFor="del-data" className="text-sm">
            同时删除数据目录（配置和工作区）
          </Label>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} disabled={deleting}>取消</Button>
          <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
            {deleting ? '删除中...' : '确认删除'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
