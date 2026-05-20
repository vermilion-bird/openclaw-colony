import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { auth } from '@/lib/auth'
import { encrypt, decrypt } from '@/lib/crypto'
import { stopContainer, removeContainer, createOpenClawContainer, startContainer } from '@/lib/docker'
import { updateConfigSchema } from '@/lib/validations'

type Params = { params: Promise<{ id: string }> }

export async function PUT(req: NextRequest, { params }: Params) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params
  const instance = await prisma.instance.findUnique({ where: { id } })
  if (!instance) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body = await req.json()
  const parsed = updateConfigSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const patch = parsed.data
  const merged = {
    name: instance.name,
    imageTag: patch.imageTag ?? instance.imageTag,
    port: instance.port,
    provider: patch.provider ?? instance.provider,
    model: patch.model ?? instance.model,
    apiKey: patch.apiKey ?? decrypt(instance.apiKey),
    baseUrl: patch.baseUrl !== undefined ? (patch.baseUrl || undefined) : (instance.baseUrl ?? undefined),
    allowedOrigin: patch.allowedOrigin !== undefined ? (patch.allowedOrigin || undefined) : (instance.allowedOrigin ?? undefined),
    bindAddress: instance.bindAddress,
    cpuLimit: patch.cpuLimit ?? instance.cpuLimit,
    memoryLimit: patch.memoryLimit ?? instance.memoryLimit,
    dataDir: instance.dataDir ?? '',
  }

  if (instance.containerId) {
    try { await stopContainer(instance.containerId) } catch {}
    try { await removeContainer(instance.containerId) } catch {}
  }

  const container = await createOpenClawContainer(merged)
  await startContainer(container.id)
  const updated = await prisma.instance.update({
    where: { id },
    data: {
      containerId: container.id,
      imageTag: merged.imageTag,
      provider: merged.provider,
      model: merged.model,
      apiKey: encrypt(merged.apiKey),
      baseUrl: merged.baseUrl ?? null,
      allowedOrigin: merged.allowedOrigin ?? null,
      cpuLimit: merged.cpuLimit,
      memoryLimit: merged.memoryLimit,
      status: 'running' as const,
    },
  })
  return NextResponse.json({ ...updated, apiKey: undefined })
}
