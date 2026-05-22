import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { auth } from '@/lib/auth'
import { stopContainer } from '@/lib/docker'
import { logActivity } from '@/lib/activity-log'

type Params = { params: Promise<{ id: string }> }

export async function POST(req: NextRequest, { params }: Params) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params
  const instance = await prisma.instance.findUnique({ where: { id } })
  if (!instance?.containerId) return NextResponse.json({ error: 'Not found or no container' }, { status: 404 })

  try {
    await stopContainer(instance.containerId)
    await prisma.instance.update({ where: { id }, data: { status: 'stopped' as const } })

    await logActivity({
      userId: session.user.id,
      userName: session.user.email ?? 'unknown',
      userEmail: session.user.email ?? 'unknown',
      eventCategory: 'OPENCLAW',
      eventType: 'openclaw.stop',
      eventDesc: `停止实例 ${instance.name}`,
      targetType: 'instance',
      targetId: id,
      targetName: instance.name,
      result: 'success',
    })

    return NextResponse.json({ status: 'stopped' })
  } catch (error: any) {
    await logActivity({
      userId: session.user.id,
      userName: session.user.email ?? 'unknown',
      userEmail: session.user.email ?? 'unknown',
      eventCategory: 'OPENCLAW',
      eventType: 'openclaw.stop',
      eventDesc: `停止实例 ${instance.name}`,
      targetType: 'instance',
      targetId: id,
      targetName: instance.name,
      result: 'failure',
      failReason: error.message,
    })
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
