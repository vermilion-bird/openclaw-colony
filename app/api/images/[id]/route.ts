import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { auth } from '@/lib/auth'

function requireAdmin(session: any) {
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if ((session.user as any).role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  return null
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  const authErr = requireAdmin(session)
  if (authErr) return authErr

  const { id } = await params

  const image = await prisma.image.findUnique({ where: { id } })
  if (!image) {
    return NextResponse.json({ error: '镜像不存在' }, { status: 404 })
  }

  const wasActive = image.isActive

  // Delete image record (platform only, not remote)
  await prisma.image.delete({ where: { id } })

  // Create audit log
  await prisma.auditLog.create({
    data: {
      userId: session!.user!.id!,
      action: 'delete',
      resource: 'image',
      resourceId: id,
      metadata: JSON.stringify({ tag: image.tag, digest: image.digest, wasActive }),
    },
  })

  return NextResponse.json({
    success: true,
    warning: wasActive,
  })
}