import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { auth } from '@/lib/auth'
import { encrypt } from '@/lib/crypto'
import { createOpenClawContainer, startContainer, getContainerStatus } from '@/lib/docker'
import { createInstanceSchema } from '@/lib/validations'
import path from 'path'
import fs from 'fs'

function requireAuth(session: any) {
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  return null
}

export async function GET(req: NextRequest) {
  const session = await auth()
  const authErr = requireAuth(session)
  if (authErr) return authErr

  const instances = await prisma.instance.findMany({ orderBy: { createdAt: 'desc' } })

  // Enrich with live Docker status
  const enriched = await Promise.all(
    instances.map(async (inst) => {
      let liveStatus = inst.status
      if (inst.containerId) {
        try {
          const dockerStatus = await getContainerStatus(inst.containerId)
          liveStatus = dockerStatus === 'running' ? 'running' : dockerStatus === 'exited' ? 'stopped' : 'unhealthy'
        } catch {
          liveStatus = 'error'
        }
      }
      return { ...inst, status: liveStatus, apiKey: undefined }
    }),
  )
  return NextResponse.json(enriched)
}

export async function POST(req: NextRequest) {
  const session = await auth()
  const authErr = requireAuth(session)
  if (authErr) return authErr

  const body = await req.json()
  const parsed = createInstanceSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const data = parsed.data
  const dataRoot = process.env.DATA_ROOT ?? './data/instances'
  const hostDataRoot = process.env.HOST_DATA_ROOT ?? dataRoot
  const dataDir = data.dataDir ?? path.join(dataRoot, data.name)
  const hostDataDir = path.join(hostDataRoot, data.name)

  // Ensure data directories exist with proper permissions for node user (uid 1000)
  const confDir = path.join(dataDir, 'conf')
  const workspaceDir = path.join(dataDir, 'workspace')
  fs.mkdirSync(confDir, { recursive: true })
  fs.mkdirSync(workspaceDir, { recursive: true })
  // Set permissions to allow node user (uid 1000) to write
  fs.chmodSync(confDir, 0o777)
  fs.chmodSync(workspaceDir, 0o777)

  const instance = await prisma.instance.create({
    data: {
      name: data.name,
      imageTag: data.imageTag,
      port: data.port,
      provider: data.provider,
      model: data.model,
      apiKey: encrypt(data.apiKey),
      baseUrl: data.baseUrl || null,
      bindAddress: data.bindAddress,
      allowedOrigin: data.allowedOrigin || null,
      cpuLimit: data.cpuLimit,
      memoryLimit: data.memoryLimit,
      dataDir,
      status: 'creating' as const,
      createdBy: session!.user!.id!,
    },
  })

  try {
    const container = await createOpenClawContainer({ ...data, apiKey: data.apiKey, dataDir, hostDataDir })
    await startContainer(container.id)
    await prisma.instance.update({
      where: { id: instance.id },
      data: { containerId: container.id, status: 'running' as const },
    })
    return NextResponse.json({ ...instance, containerId: container.id, status: 'running', apiKey: undefined }, { status: 201 })
  } catch (err: any) {
    await prisma.instance.update({ where: { id: instance.id }, data: { status: 'error' as const } })
    return NextResponse.json({ error: err.message ?? 'Failed to create container' }, { status: 500 })
  }
}
