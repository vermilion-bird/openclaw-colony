import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { auth } from '@/lib/auth'
import { fetchTagInfo } from '@/lib/docker-hub'
import { importImageSchema } from '@/lib/validations'

function requireAdmin(session: any) {
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if ((session.user as any).role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  return null
}

export async function GET(req: NextRequest) {
  const session = await auth()
  const authErr = requireAdmin(session)
  if (authErr) return authErr

  const { searchParams } = new URL(req.url)
  const page = parseInt(searchParams.get('page') ?? '1')
  const limit = parseInt(searchParams.get('limit') ?? '10')
  const skip = (page - 1) * limit

  const images = await prisma.image.findMany({
    orderBy: { pushedAt: 'desc' },
    skip,
    take: limit,
  })

  const total = await prisma.image.count()

  return NextResponse.json({ images, total, page, limit })
}

export async function POST(req: NextRequest) {
  const session = await auth()
  const authErr = requireAdmin(session)
  if (authErr) return authErr

  const body = await req.json()
  const parsed = importImageSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const tag = parsed.data.tag

  // Fetch tag info from Docker Hub
  const info = await fetchTagInfo(tag)
  if (!info) {
    return NextResponse.json({ error: 'Tag 不存在，请前往 Docker Hub 确认版本号' }, { status: 404 })
  }

  // Check for duplicate digest
  const existing = await prisma.image.findFirst({
    where: { digest: info.digest },
  })

  if (existing) {
    return NextResponse.json({ error: '该版本已导入（digest 相同）' }, { status: 400 })
  }

  // Special handling for latest: check if digest matches existing latest
  if (tag === 'latest') {
    const existingLatest = await prisma.image.findFirst({
      where: { tag: 'latest' },
    })
    if (existingLatest && existingLatest.digest === info.digest) {
      return NextResponse.json({ error: '当前 latest 版本已是最新' }, { status: 400 })
    }
  }

  // Create image record
  const image = await prisma.image.create({
    data: {
      repository: 'openclaw/openclaw',
      tag: info.tag,
      digest: info.digest,
      os: info.os,
      architecture: info.architecture,
      compressedSize: info.compressedSize,
      pushedAt: info.pushedAt,
      importedBy: session!.user!.id!,
    },
  })

  // Create audit log
  await prisma.auditLog.create({
    data: {
      userId: session!.user!.id!,
      action: 'import',
      resource: 'image',
      resourceId: image.id,
      metadata: JSON.stringify({ tag: info.tag, digest: info.digest }),
    },
  })

  return NextResponse.json(image, { status: 201 })
}