import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { auth } from '@/lib/auth'

function requireAdmin(session: any) {
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if ((session.user as any).role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  return null
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  const err = requireAdmin(session)
  if (err) return err

  const { id } = await params
  const logId = Number(id)
  if (!Number.isFinite(logId)) {
    return NextResponse.json({ error: 'Invalid ID' }, { status: 400 })
  }

  const log = await prisma.activityLog.findUnique({ where: { id: logId } })
  if (!log) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  return NextResponse.json({ ...log, id: Number(log.id) })
}