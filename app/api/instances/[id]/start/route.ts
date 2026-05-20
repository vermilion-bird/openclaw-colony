import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { auth } from '@/lib/auth'
import { startContainer } from '@/lib/docker'

type Params = { params: Promise<{ id: string }> }

export async function POST(req: NextRequest, { params }: Params) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params
  const instance = await prisma.instance.findUnique({ where: { id } })
  if (!instance?.containerId) return NextResponse.json({ error: 'Not found or no container' }, { status: 404 })
  await startContainer(instance.containerId)
  await prisma.instance.update({ where: { id }, data: { status: 'running' as const } })
  return NextResponse.json({ status: 'running' })
}
