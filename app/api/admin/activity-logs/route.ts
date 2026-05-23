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
    page: searchParams.get('page'),
    pageSize: searchParams.get('pageSize'),
  })

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const { userKeyword, eventCategory, eventType, result, startDate, endDate, page, pageSize } = parsed.data
  const skip = (page - 1) * pageSize

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

  const [logs, total] = await Promise.all([
    prisma.activityLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: pageSize,
    }),
    prisma.activityLog.count({ where }),
  ])

  return NextResponse.json({
    data: logs.map((log: any) => ({ ...log, id: Number(log.id) })),
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
    },
  })
}