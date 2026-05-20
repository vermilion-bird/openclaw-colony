import { NextRequest } from 'next/server'
import { prisma } from '@/lib/db'
import { auth } from '@/lib/auth'
import { getDockerClient } from '@/lib/docker'

type Params = { params: Promise<{ id: string }> }

export async function GET(req: NextRequest, { params }: Params) {
  const session = await auth()
  if (!session?.user) return new Response('Unauthorized', { status: 401 })
  const { id } = await params
  const instance = await prisma.instance.findUnique({ where: { id } })
  if (!instance?.containerId) return new Response('Not found', { status: 404 })

  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      try {
        const docker = getDockerClient()
        const container = docker.getContainer(instance.containerId!)
        const logStream = await container.logs({
          follow: true, stdout: true, stderr: true, tail: 200,
        }) as unknown as NodeJS.ReadableStream
        logStream.on('data', (chunk: Buffer) => {
          // Docker multiplexes stdout/stderr: first 8 bytes are header
          const text = chunk.length > 8 ? chunk.subarray(8).toString('utf8') : chunk.toString('utf8')
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(text)}\n\n`))
        })
        logStream.on('end', () => controller.close())
        logStream.on('error', () => controller.close())
        req.signal.addEventListener('abort', () => {
          (logStream as any).destroy?.()
          controller.close()
        })
      } catch (err: any) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(`Error: ${err.message}`)}\n\n`))
        controller.close()
      }
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
