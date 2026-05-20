import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import bcrypt from 'bcryptjs'
import { z } from 'zod'

const setupSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
})

export async function POST(req: NextRequest) {
  const count = await prisma.user.count()
  if (count > 0) return NextResponse.json({ error: 'Setup already complete' }, { status: 409 })

  const body = await req.json()
  const parsed = setupSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const passwordHash = await bcrypt.hash(parsed.data.password, 12)
  const user = await prisma.user.create({
    data: { email: parsed.data.email, passwordHash, role: 'admin' },
  })
  return NextResponse.json({ id: user.id, email: user.email }, { status: 201 })
}
