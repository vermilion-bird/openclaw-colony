import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { auth } from '@/lib/auth'
import { encrypt } from '@/lib/crypto'
import { createOpenClawContainer, startContainer, getContainerStatus } from '@/lib/docker'
import { createInstanceSchema } from '@/lib/validations'
import { generateRandomToken } from '@/lib/utils'
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
    instances.map(async (inst: any) => {
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

  // Generate gatewayToken if not provided
  const gatewayToken = data.gatewayToken || generateRandomToken(32)

  // Check if imageTag is provided or use active image
  if (!data.imageTag) {
    const activeImage = await prisma.image.findFirst({ where: { isActive: true } })
    if (!activeImage) {
      return NextResponse.json({ error: '请先在镜像管理中设置生效镜像' }, { status: 400 })
    }
    data.imageTag = `${activeImage.repository}:${activeImage.tag}`
  }

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
      gatewayToken,
      status: 'creating' as const,
      createdBy: session!.user!.id!,
    },
  })

  try {
    const container = await createOpenClawContainer({
      ...data,
      imageTag: data.imageTag!,
      apiKey: data.apiKey,
      gatewayToken,
      dataDir,
      hostDataDir,
    })
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
