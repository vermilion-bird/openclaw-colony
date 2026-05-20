import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { auth } from '@/lib/auth'
import { removeContainer, stopContainer, getContainerStatus, deleteDataDirectory } from '@/lib/docker'

type Params = { params: Promise<{ id: string }> }

export async function GET(req: NextRequest, { params }: Params) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params
  const instance = await prisma.instance.findUnique({ where: { id } })
  if (!instance) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  let liveStatus = instance.status
  if (instance.containerId) {
    try {
      const s = await getContainerStatus(instance.containerId)
      liveStatus = s === 'running' ? 'running' : 'stopped'
    } catch { liveStatus = 'error' }
  }
  return NextResponse.json({ ...instance, status: liveStatus, apiKey: undefined })
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const session = await auth()
  if (!session?.user || (session.user as any).role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  const { id } = await params
  const instance = await prisma.instance.findUnique({ where: { id } })
  if (!instance) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  if (instance.containerId) {
    try { await stopContainer(instance.containerId) } catch {}
    try { await removeContainer(instance.containerId) } catch {}
  }

  const url = new URL(req.url)
  const deleteData = url.searchParams.get('deleteData') === 'true'
  if (deleteData && instance.dataDir) {
    // Convert container dataDir to host path
    const dataRoot = process.env.HOST_DATA_ROOT ?? process.env.DATA_ROOT ?? './data/instances'
    const hostDataDir = instance.dataDir.replace(process.env.DATA_ROOT ?? './data/instances', dataRoot)
    try { await deleteDataDirectory(hostDataDir) } catch {}
  }

  await prisma.instance.delete({ where: { id } })
  return NextResponse.json({ success: true })
}
