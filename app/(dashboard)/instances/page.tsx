'use client'
import { useEffect, useState, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'
import { InstanceCard, type InstanceCardData } from '@/components/instance-card'
import { LogViewer } from '@/components/log-viewer'
import { EditConfigSheet } from '@/components/edit-config-sheet'
import { DeleteInstanceDialog } from '@/components/delete-instance-dialog'

export default function DashboardPage() {
  const { data: session } = useSession()
  const [instances, setInstances] = useState<InstanceCardData[]>([])
  const [logsInstanceId, setLogsInstanceId] = useState<string | null>(null)
  const [configInstanceId, setConfigInstanceId] = useState<string | null>(null)
  const [deleteInstanceId, setDeleteInstanceId] = useState<string | null>(null)

  const fetchInstances = useCallback(async () => {
    const res = await fetch('/api/instances')
    if (res.ok) setInstances(await res.json())
  }, [])

  useEffect(() => {
    fetchInstances()
    const interval = setInterval(fetchInstances, 10000)
    return () => clearInterval(interval)
  }, [fetchInstances])

  async function doAction(id: string, action: 'start' | 'stop' | 'restart') {
    await fetch(`/api/instances/${id}/${action}`, { method: 'POST' })
    fetchInstances()
  }

  async function openPanel(id: string) {
    const res = await fetch(`/api/instances/${id}/token`)
    if (res.ok) {
      const { url } = await res.json()
      window.open(url, '_blank')
    } else {
      alert('实例尚未完成初始化，请稍候再试')
    }
  }

  const isAdmin = (session?.user as any)?.role === 'admin'

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">实例列表</h2>
        <Link href="/instances/new">
          <Button size="sm"><Plus className="w-4 h-4 mr-1" />新建实例</Button>
        </Link>
      </div>

      {instances.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <p className="text-lg">暂无实例</p>
          <Link href="/instances/new" className="mt-4 inline-block">
            <Button variant="outline">创建第一个实例</Button>
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {instances.map(inst => (
            <InstanceCard
              key={inst.id}
              instance={inst}
              isAdmin={isAdmin}
              onStart={id => doAction(id, 'start')}
              onStop={id => doAction(id, 'stop')}
              onRestart={id => doAction(id, 'restart')}
              onLogs={setLogsInstanceId}
              onConfig={setConfigInstanceId}
              onOpenPanel={openPanel}
              onDelete={setDeleteInstanceId}
            />
          ))}
        </div>
      )}

      {logsInstanceId && (
        <LogViewer instanceId={logsInstanceId} onClose={() => setLogsInstanceId(null)} />
      )}
      {configInstanceId && (
        <EditConfigSheet
          instanceId={configInstanceId}
          onClose={() => setConfigInstanceId(null)}
          onSaved={fetchInstances}
        />
      )}
      {deleteInstanceId && (
        <DeleteInstanceDialog
          instanceId={deleteInstanceId}
          onClose={() => setDeleteInstanceId(null)}
          onDeleted={fetchInstances}
        />
      )}
    </div>
  )
}
