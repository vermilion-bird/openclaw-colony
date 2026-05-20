'use client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Play, Square, RotateCcw, FileText, Settings, ExternalLink, Trash2 } from 'lucide-react'

export interface InstanceCardData {
  id: string
  name: string
  status: string
  port: number
  provider: string
  model: string
  cpuPercent?: number
  memUsedMb?: number
  memLimitMb?: number
}

interface Props {
  instance: InstanceCardData
  isAdmin: boolean
  onStart: (id: string) => void
  onStop: (id: string) => void
  onRestart: (id: string) => void
  onLogs: (id: string) => void
  onConfig: (id: string) => void
  onOpenPanel: (id: string) => void
  onDelete: (id: string) => void
}

const statusColors: Record<string, string> = {
  running: 'bg-green-100 text-green-700',
  stopped: 'bg-gray-100 text-gray-600',
  creating: 'bg-blue-100 text-blue-700',
  unhealthy: 'bg-yellow-100 text-yellow-700',
  error: 'bg-red-100 text-red-700',
}

const statusLabels: Record<string, string> = {
  running: '运行中', stopped: '已停止', creating: '创建中',
  unhealthy: '异常', error: '错误',
}

export function InstanceCard({ instance, isAdmin, onStart, onStop, onRestart, onLogs, onConfig, onOpenPanel, onDelete }: Props) {
  const isRunning = instance.status === 'running'

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader className="pb-2 flex flex-row items-start justify-between">
        <div>
          <h3 className="font-medium">{instance.name}</h3>
          <p className="text-xs text-gray-500 mt-0.5">{instance.provider} / {instance.model}</p>
        </div>
        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColors[instance.status] ?? 'bg-gray-100'}`}>
          {statusLabels[instance.status] ?? instance.status}
        </span>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex gap-4 text-xs text-gray-500">
          <span>端口: {instance.port}</span>
          {instance.cpuPercent !== undefined && <span>CPU: {instance.cpuPercent}%</span>}
          {instance.memUsedMb !== undefined && <span>内存: {instance.memUsedMb}/{instance.memLimitMb}MB</span>}
        </div>
        <div className="flex flex-wrap gap-1.5">
          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => onStart(instance.id)} disabled={isRunning}>
            <Play className="w-3 h-3 mr-1" />启动
          </Button>
          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => onStop(instance.id)} disabled={!isRunning}>
            <Square className="w-3 h-3 mr-1" />停止
          </Button>
          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => onRestart(instance.id)} disabled={!isRunning}>
            <RotateCcw className="w-3 h-3 mr-1" />重启
          </Button>
          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => onLogs(instance.id)}>
            <FileText className="w-3 h-3 mr-1" />日志
          </Button>
          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => onConfig(instance.id)}>
            <Settings className="w-3 h-3 mr-1" />配置
          </Button>
          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => onOpenPanel(instance.id)} disabled={!isRunning}>
            <ExternalLink className="w-3 h-3 mr-1" />面板
          </Button>
          {isAdmin && (
            <Button size="sm" variant="outline" className="h-7 text-xs text-red-600 hover:bg-red-50" onClick={() => onDelete(instance.id)}>
              <Trash2 className="w-3 h-3 mr-1" />删除
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
