'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'
import { ActivityLogsTable } from '@/components/activity-logs-table'

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

interface Pagination {
  page: number
  pageSize: number
  total: number
  totalPages: number
}

const CATEGORIES = ['AUTH', 'OPENCLAW', 'IMAGE', 'USER', 'CONFIG', 'DATA'] as const
const RESULTS = ['success', 'failure'] as const

export default function ActivityLogsPage() {
  const { data: session } = useSession()
  const router = useRouter()
  const searchParams = useSearchParams()

  const [logs, setLogs] = useState<ActivityLog[]>([])
  const [pagination, setPagination] = useState<Pagination>({ page: 1, pageSize: 20, total: 0, totalPages: 0 })
  const [loading, setLoading] = useState(true)

  const userKeyword = searchParams.get('userKeyword') ?? ''
  const eventCategory = searchParams.get('eventCategory') ?? ''
  const eventType = searchParams.get('eventType') ?? ''
  const result = searchParams.get('result') ?? ''
  const startDate = searchParams.get('startDate') ?? ''
  const endDate = searchParams.get('endDate') ?? ''
  const page = Number(searchParams.get('page') ?? 1)

  const fetchLogs = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams()
    if (userKeyword) params.set('userKeyword', userKeyword)
    if (eventCategory) params.set('eventCategory', eventCategory)
    if (eventType) params.set('eventType', eventType)
    if (result) params.set('result', result)
    if (startDate) params.set('startDate', startDate)
    if (endDate) params.set('endDate', endDate)
    params.set('page', String(page))
    params.set('pageSize', '20')

    const res = await fetch(`/api/admin/activity-logs?${params}`)
    if (res.ok) {
      const data = await res.json()
      setLogs(data.data)
      setPagination(data.pagination)
    } else if (res.status === 401 || res.status === 403) {
      router.push('/login')
    }
    setLoading(false)
  }, [userKeyword, eventCategory, eventType, result, startDate, endDate, page, router])

  useEffect(() => { fetchLogs() }, [fetchLogs])

  const updateFilter = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams)
    if (value) params.set(key, value)
    else params.delete(key)
    params.set('page', '1')
    router.push(`/activity-logs?${params}`)
  }

  const exportCsv = async () => {
    const params = new URLSearchParams()
    if (userKeyword) params.set('userKeyword', userKeyword)
    if (eventCategory) params.set('eventCategory', eventCategory)
    if (eventType) params.set('eventType', eventType)
    if (result) params.set('result', result)
    if (startDate) params.set('startDate', startDate)
    if (endDate) params.set('endDate', endDate)

    const res = await fetch(`/api/admin/activity-logs/export?${params}`)
    if (res.ok) {
      const blob = await res.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `activity-logs-${new Date().toISOString().split('T')[0]}.csv`
      a.click()
      window.URL.revokeObjectURL(url)
    }
  }

  if ((session?.user as any)?.role !== 'admin') {
    return <div className="p-8 text-center text-gray-500">需要管理员权限访问此页面</div>
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">操作记录</h1>
        <Button onClick={exportCsv}>导出 CSV</Button>
      </div>

      <div className="bg-white rounded-lg border p-4">
        <div className="flex gap-4 items-end flex-wrap">
          <div className="flex-1 min-w-[200px]">
            <label className="block text-sm font-medium mb-1">用户搜索</label>
            <Input
              placeholder="用户名或邮箱"
              value={userKeyword}
              onChange={(e) => updateFilter('userKeyword', e.target.value)}
            />
          </div>
          <div className="min-w-[120px]">
            <label className="block text-sm font-medium mb-1">事件类别</label>
            <Select value={eventCategory || ''} onValueChange={(v) => updateFilter('eventCategory', v ?? '')}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="全部" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">全部</SelectItem>
                {CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="min-w-[100px]">
            <label className="block text-sm font-medium mb-1">结果</label>
            <Select value={result || ''} onValueChange={(v) => updateFilter('result', v ?? '')}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="全部" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">全部</SelectItem>
                {RESULTS.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="min-w-[180px]">
            <label className="block text-sm font-medium mb-1">起始时间</label>
            <Input
              type="datetime-local"
              value={startDate}
              onChange={(e) => updateFilter('startDate', e.target.value)}
            />
          </div>
          <div className="min-w-[180px]">
            <label className="block text-sm font-medium mb-1">结束时间</label>
            <Input
              type="datetime-local"
              value={endDate}
              onChange={(e) => updateFilter('endDate', e.target.value)}
            />
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg border">
        {loading ? (
          <div className="p-8 text-center text-gray-500">加载中...</div>
        ) : logs.length === 0 ? (
          <div className="p-8 text-center text-gray-500">暂无数据</div>
        ) : (
          <ActivityLogsTable logs={logs} />
        )}
      </div>

      {pagination.totalPages > 1 && (
        <div className="flex justify-center gap-2">
          <Button
            variant="outline"
            disabled={page <= 1}
            onClick={() => {
              const params = new URLSearchParams(searchParams)
              params.set('page', String(page - 1))
              router.push(`/activity-logs?${params}`)
            }}
          >
            上一页
          </Button>
          <span className="px-4 py-2 text-sm">
            第 {page} / {pagination.totalPages} 页，共 {pagination.total} 条
          </span>
          <Button
            variant="outline"
            disabled={page >= pagination.totalPages}
            onClick={() => {
              const params = new URLSearchParams(searchParams)
              params.set('page', String(page + 1))
              router.push(`/activity-logs?${params}`)
            }}
          >
            下一页
          </Button>
        </div>
      )}
    </div>
  )
}