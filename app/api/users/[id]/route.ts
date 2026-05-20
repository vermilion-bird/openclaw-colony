import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { auth } from '@/lib/auth'
import { z } from 'zod'

type Params = { params: Promise<{ id: string }> }

function requireAdmin(session: any) {
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if ((session.user as any).role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  return null
}

export async function PUT(req: NextRequest, { params }: Params) {
  const session = await auth()
  const err = requireAdmin(session)
  if (err) return err

  const { id } = await params
  const body = await req.json()
  const parsed = z.object({ role: z.enum(['admin', 'operator']) }).safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Invalid role' }, { status: 400 })

  const user = await prisma.user.update({
    where: { id },
    data: { role: parsed.data.role },
    select: { id: true, email: true, role: true },
  })
  return NextResponse.json(user)
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const session = await auth()
  const err = requireAdmin(session)
  if (err) return err

  const { id } = await params
  const target = await prisma.user.findUnique({ where: { id } })
  if (!target) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  if (target.role === 'admin') {
    const adminCount = await prisma.user.count({ where: { role: 'admin' } })
    if (adminCount <= 1) return NextResponse.json({ error: '不能删除唯一的 admin' }, { status: 409 })
  }

  await prisma.user.delete({ where: { id } })
  return NextResponse.json({ success: true })
}
