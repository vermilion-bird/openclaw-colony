import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { auth } from '@/lib/auth'
import { getContainerStatus } from '@/lib/docker'
import Dockerode from 'dockerode'

type Params = { params: Promise<{ id: string }> }

// Read file from container using Docker API (bypasses permission issues)
async function readConfigFromContainer(containerName: string): Promise<any> {
  const docker = new Dockerode({ socketPath: '/var/run/docker.sock' })
  const container = docker.getContainer(containerName)

  const exec = await container.exec({
    Cmd: ['cat', '/home/node/.openclaw/openclaw.json'],
    AttachStdout: true,
    AttachStderr: true,
  })

  const stream = await exec.start({ Detach: false })
  const chunks: Buffer[] = []

  return new Promise((resolve, reject) => {
    stream.on('data', (chunk: Buffer) => chunks.push(chunk))
    stream.on('end', () => {
      try {
        const output = Buffer.concat(chunks).toString('utf-8')
        // Docker exec output has 8-byte header, strip it
        const cleanOutput = output.slice(output.indexOf('{'))
        resolve(JSON.parse(cleanOutput.trim()))
      } catch (e) {
        reject(new Error('Failed to parse config'))
      }
    })
    stream.on('error', reject)
  })
}

export async function GET(req: NextRequest, { params }: Params) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params
  const instance = await prisma.instance.findUnique({ where: { id } })
  if (!instance) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Check if container is running
  if (instance.containerId) {
    try {
      const status = await getContainerStatus(instance.containerId)
      if (status !== 'running') {
        return NextResponse.json({ error: '实例未运行' }, { status: 400 })
      }
    } catch {
      return NextResponse.json({ error: '无法获取容器状态' }, { status: 500 })
    }
  }

  // Read config from inside the container (bypasses host file permission issues)
  try {
    const config = await readConfigFromContainer(`openclaw-${instance.name}`)
    const token = config?.token ?? config?.gateway?.token ?? config?.gateway?.auth?.token
    if (!token) return NextResponse.json({ error: 'Token not found in config' }, { status: 404 })

    const hostIp = process.env.HOST_IP ?? '127.0.0.1'
    const url = `http://${hostIp}:${instance.port}?token=${token}`
    return NextResponse.json({ url, token })
  } catch (e: any) {
    return NextResponse.json({ error: '实例尚未完成初始化，请稍候再试' }, { status: 404 })
  }
}
