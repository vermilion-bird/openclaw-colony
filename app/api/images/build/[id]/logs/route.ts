import { NextRequest } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'

type Params = { params: Promise<{ id: string }> }

export async function GET(req: NextRequest, { params }: Params) {
  const session = await auth()
  if (!session?.user || (session.user as any).role !== 'admin') {
    return new Response('Unauthorized', { status: 401 })
  }

  const { id } = await params

  const image = await prisma.image.findUnique({ where: { id } })
  if (!image || image.buildType !== 'build') {
    return new Response('Not found', { status: 404 })
  }

  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(`data: Dockerfile:\n\n`))
      if (image.dockerfile) {
        const lines = image.dockerfile.split('\n')
        for (const line of lines) {
          controller.enqueue(encoder.encode(`data: ${line}\n\n`))
        }
      }
      controller.enqueue(encoder.encode(`data: \n\n`))
      controller.enqueue(encoder.encode(`data: Build completed: ${image.repository}:${image.tag}\n\n`))
      controller.close()
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  })
}