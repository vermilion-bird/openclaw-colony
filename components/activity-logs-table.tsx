'use client'

import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ActivityLogDetailDialog } from './activity-log-detail-dialog'

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
  logs: ActivityLog[]
}

export function ActivityLogsTable({ logs }: Props) {
  const [selectedLog, setSelectedLog] = useState<ActivityLog | null>(null)

  const resultColor = (result: string) =>
    result === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'

  const categoryColor = (cat: string) => {
    const colors: Record<string, string> = {
      AUTH: 'bg-blue-100 text-blue-800',
      OPENCLAW: 'bg-purple-100 text-purple-800',
      IMAGE: 'bg-orange-100 text-orange-800',
      USER: 'bg-cyan-100 text-cyan-800',
      CONFIG: 'bg-yellow-100 text-yellow-800',
      DATA: 'bg-gray-100 text-gray-800',
    }
    return colors[cat] ?? 'bg-gray-100 text-gray-800'
  }

  return (
    <>
      <table className="w-full text-sm">
        <thead className="bg-gray-50 border-b">
          <tr>
            <th className="px-3 py-2 text-left font-medium">用户</th>
            <th className="px-3 py-2 text-left font-medium">事件类型</th>
            <th className="px-3 py-2 text-left font-medium">描述</th>
            <th className="px-3 py-2 text-left font-medium">结果</th>
            <th className="px-3 py-2 text-left font-medium">时间</th>
            <th className="px-3 py-2 text-left font-medium">操作</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {logs.map(log => (
            <tr key={log.id} className="hover:bg-gray-50">
              <td className="px-3 py-2">
                <div className="font-medium">{log.userName}</div>
                <div className="text-xs text-gray-500">{log.userEmail}</div>
              </td>
              <td className="px-3 py-2">
                <Badge className={categoryColor(log.eventCategory)}>{log.eventCategory}</Badge>
                <span className="ml-1 text-xs">{log.eventType}</span>
              </td>
              <td className="px-3 py-2">{log.eventDesc}</td>
              <td className="px-3 py-2">
                <Badge className={resultColor(log.result)}>{log.result}</Badge>
              </td>
              <td className="px-3 py-2 text-xs text-gray-500">
                {new Date(log.createdAt).toLocaleString('zh-CN')}
              </td>
              <td className="px-3 py-2">
                <Button size="sm" variant="ghost" onClick={() => setSelectedLog(log)}>
                  详情
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <ActivityLogDetailDialog log={selectedLog} onClose={() => setSelectedLog(null)} />
    </>
  )
}