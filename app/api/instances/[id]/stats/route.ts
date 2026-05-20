import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { auth } from '@/lib/auth'
import { getContainerStats } from '@/lib/docker'

type Params = { params: Promise<{ id: string }> }

export async function GET(req: NextRequest, { params }: Params) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params
  const instance = await prisma.instance.findUnique({ where: { id } })
  if (!instance?.containerId) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  try {
    const stats = await getContainerStats(instance.containerId)
    return NextResponse.json({ ...stats, timestamp: Date.now() })
  } catch {
    return NextResponse.json({ cpuPercent: 0, memUsedMb: 0, memLimitMb: 0, timestamp: Date.now() })
  }
}
