import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { auth } from '@/lib/auth'

function requireAdmin(session: any) {
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if ((session.user as any).role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  return null
}

export async function PATCH(
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

  // Use transaction to ensure atomicity and prevent race conditions
  await prisma.$transaction(async (tx) => {
    // Deactivate all images first
    await tx.image.updateMany({
      where: {},
      data: { isActive: false },
    })
    // Activate target image
    await tx.image.update({
      where: { id },
      data: { isActive: true },
    })
  })

  // Create audit log
  await prisma.auditLog.create({
    data: {
      userId: session!.user!.id!,
      action: 'activate',
      resource: 'image',
      resourceId: id,
      metadata: JSON.stringify({ tag: image.tag, digest: image.digest }),
    },
  })

  return NextResponse.json({ ...image, isActive: true })
}