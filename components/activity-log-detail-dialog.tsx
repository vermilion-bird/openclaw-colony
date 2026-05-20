'use client'

import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'

interface ActivityLog {
  id: number
  userId: string | null
  userName: string
  userEmail: string
  eventCategory: string
  eventType: string
  eventDesc: string
  targetType: string | null
  targetId: string | null
  targetName: string | null
  result: string
  failReason: string | null
  ipAddress: string | null
  userAgent: string | null
  extra: string | null
  createdAt: string
}

interface Props {
  log: ActivityLog | null
  onClose: () => void
}

export function ActivityLogDetailDialog({ log, onClose }: Props) {
  if (!log) return null

  let parsedExtra: Record<string, unknown> | null = null
  try {
    parsedExtra = log.extra ? JSON.parse(log.extra) : null
  } catch {
    parsedExtra = null
  }

  return (
    <Dialog open={!!log} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>操作记录详情 #{log.id}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 text-sm">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <span className="font-medium text-gray-500">用户名：</span>
              {log.userName}
            </div>
            <div>
              <span className="font-medium text-gray-500">邮箱：</span>
              {log.userEmail}
            </div>
            <div>
              <span className="font-medium text-gray-500">事件类别：</span>
              {log.eventCategory}
            </div>
            <div>
              <span className="font-medium text-gray-500">事件类型：</span>
              {log.eventType}
            </div>
            <div>
              <span className="font-medium text-gray-500">操作结果：</span>
              <span className={log.result === 'success' ? 'text-green-600' : 'text-red-600'}>
                {log.result}
              </span>
            </div>
            <div>
              <span className="font-medium text-gray-500">时间：</span>
              {new Date(log.createdAt).toLocaleString('zh-CN')}
            </div>
          </div>
          <div>
            <span className="font-medium text-gray-500">描述：</span>
            {log.eventDesc}
          </div>
          {log.targetType && (
            <div className="grid grid-cols-3 gap-4">
              <div>
                <span className="font-medium text-gray-500">对象类型：</span>
                {log.targetType}
              </div>
              <div>
                <span className="font-medium text-gray-500">对象 ID：</span>
                {log.targetId}
              </div>
              <div>
                <span className="font-medium text-gray-500">对象名称：</span>
                {log.targetName}
              </div>
            </div>
          )}
          {log.failReason && (
            <div>
              <span className="font-medium text-gray-500">失败原因：</span>
              <span className="text-red-600">{log.failReason}</span>
            </div>
          )}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <span className="font-medium text-gray-500">IP 地址：</span>
              {log.ipAddress ?? '-'}
            </div>
            <div>
              <span className="font-medium text-gray-500">UA：</span>
              <span className="text-xs">{log.userAgent ?? '-'}</span>
            </div>
          </div>
          {parsedExtra && (
            <div>
              <span className="font-medium text-gray-500">扩展数据：</span>
              <pre className="mt-1 p-2 bg-gray-50 rounded text-xs overflow-auto">
                {JSON.stringify(parsedExtra, null, 2)}
              </pre>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}