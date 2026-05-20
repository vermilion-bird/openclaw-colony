import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { auth } from '@/lib/auth'
import { activityLogQuerySchema } from '@/lib/validations'

function requireAdmin(session: any) {
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if ((session.user as any).role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  return null
}

export async function GET(req: NextRequest) {
  const session = await auth()
  const err = requireAdmin(session)
  if (err) return err

  const { searchParams } = new URL(req.url)
  const parsed = activityLogQuerySchema.safeParse({
    userKeyword: searchParams.get('userKeyword'),
    eventCategory: searchParams.get('eventCategory'),
    eventType: searchParams.get('eventType'),
    result: searchParams.get('result'),
    startDate: searchParams.get('startDate'),
    endDate: searchParams.get('endDate'),
    page: undefined,
    pageSize: undefined,
  })

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const { userKeyword, eventCategory, eventType, result, startDate, endDate } = parsed.data

  const where: any = {}
  if (userKeyword) {
    where.OR = [
      { userName: { contains: userKeyword } },
      { userEmail: { contains: userKeyword } },
    ]
  }
  if (eventCategory) where.eventCategory = eventCategory
  if (eventType) where.eventType = eventType
  if (result) where.result = result
  if (startDate) where.createdAt = { ...where.createdAt, gte: new Date(startDate) }
  if (endDate) where.createdAt = { ...where.createdAt, lte: new Date(endDate) }

  const logs = await prisma.activityLog.findMany({
    where,
    orderBy: { createdAt: 'desc' },
  })

  const headers = [
    'ID', '用户名', '用户邮箱', '事件类别', '事件类型', '事件描述',
    '对象类型', '对象ID', '对象名称', '结果', '失败原因',
    'IP地址', 'UA', '扩展数据', '时间'
  ]

  const rows = logs.map(log => [
    log.id.toString(),
    log.userName,
    log.userEmail,
    log.eventCategory,
    log.eventType,
    log.eventDesc,
    log.targetType ?? '',
    log.targetId ?? '',
    log.targetName ?? '',
    log.result,
    log.failReason ?? '',
    log.ipAddress ?? '',
    log.userAgent ?? '',
    log.extra ?? '',
    log.createdAt.toISOString(),
  ])

  const csv = [headers.join(','), ...rows.map(r => r.map(cell => `"${cell.replace(/"/g, '""')}"`).join(','))].join('\n')

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="activity-logs-${new Date().toISOString().split('T')[0]}.csv"`,
    },
  })
}