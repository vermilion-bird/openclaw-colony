import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { auth } from '@/lib/auth'
import { buildImage } from '@/lib/docker'
import { buildImageSchema } from '@/lib/validations'

function requireAdmin(session: any) {
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if ((session.user as any).role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  return null
}

export async function POST(req: NextRequest) {
  const session = await auth()
  const authErr = requireAdmin(session)
  if (authErr) return authErr

  const body = await req.json()
  const parsed = buildImageSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const { baseImageId, dockerfile, imageName, imageTag } = parsed.data

  // Check base image exists
  const baseImage = await prisma.image.findUnique({ where: { id: baseImageId } })
  if (!baseImage) return NextResponse.json({ error: '基础镜像不存在' }, { status: 404 })

  // Execute build
  const buildGen = await buildImage({ dockerfile, imageName, imageTag })
  const logs: string[] = []
  let result

  // Iterate through the async generator to collect logs and get the final result
  let item = await buildGen.next()
  while (!item.done) {
    logs.push(item.value)
    item = await buildGen.next()
  }
  result = item.value

  if (!result.success) {
    return NextResponse.json({
      error: '构建失败',
      logs,
      detail: result.error
    }, { status: 500 })
  }

  // Check for existing image with same name:tag
  const existing = await prisma.image.findFirst({
    where: { repository: imageName, tag: imageTag },
  })

  if (existing) {
    // Update existing image
    const updated = await prisma.image.update({
      where: { id: existing.id },
      data: {
        digest: result.digest,
        dockerfile,
        baseImageId,
        buildType: 'build',
        pushedAt: new Date(),
      },
    })
    return NextResponse.json({ image: updated, logs })
  }

  // Create new image record
  const image = await prisma.image.create({
    data: {
      repository: imageName,
      tag: imageTag,
      digest: result.digest,
      os: 'linux',
      architecture: 'amd64',
      compressedSize: 0,
      buildType: 'build',
      dockerfile,
      baseImageId,
      importedBy: session!.user!.id!,
      pushedAt: new Date(),
    },
  })

  // Create audit log
  await prisma.auditLog.create({
    data: {
      userId: session!.user!.id!,
      action: 'build',
      resource: 'image',
      resourceId: image.id,
      metadata: JSON.stringify({ imageName, imageTag, baseImageId }),
    },
  })

  return NextResponse.json({ image, logs }, { status: 201 })
}