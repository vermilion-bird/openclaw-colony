import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { auth } from '@/lib/auth'
import bcrypt from 'bcryptjs'
import { createUserSchema } from '@/lib/validations'

function requireAdmin(session: any) {
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if ((session.user as any).role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  return null
}

export async function GET(req: NextRequest) {
  const session = await auth()
  const err = requireAdmin(session)
  if (err) return err
  const users = await prisma.user.findMany({
    orderBy: { createdAt: 'asc' },
    select: { id: true, email: true, role: true, createdAt: true },
  })
  return NextResponse.json(users)
}

export async function POST(req: NextRequest) {
  const session = await auth()
  const err = requireAdmin(session)
  if (err) return err

  const body = await req.json()
  const parsed = createUserSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const passwordHash = await bcrypt.hash(parsed.data.password, 12)
  const user = await prisma.user.create({
    data: { email: parsed.data.email, passwordHash, role: parsed.data.role },
    select: { id: true, email: true, role: true, createdAt: true },
  })
  return NextResponse.json(user, { status: 201 })
}
