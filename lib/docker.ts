import Dockerode from 'dockerode'

let _docker: Dockerode | null = null

export function getDockerClient(): Dockerode {
  if (!_docker) _docker = new Dockerode({ socketPath: '/var/run/docker.sock' })
  return _docker
}

export interface CreateContainerOptions {
  name: string
  imageTag: string
  port: number
  provider: string
  model: string
  apiKey: string
  baseUrl?: string
  bindAddress: string
  allowedOrigin?: string
  cpuLimit: number
  memoryLimit: string
  dataDir: string
  hostDataDir?: string  // Host machine path for bind mounts
  gatewayToken: string  // Required token for OpenClaw auth
}

function parseMemoryBytes(mem: string): number {
  const match = mem.match(/^(\d+(?:\.\d+)?)\s*([GgMmKk]?)$/)
  if (!match) throw new Error(`Invalid memory format: ${mem}`)
  const num = parseFloat(match[1])
  const unit = match[2].toUpperCase()
  if (unit === 'G') return Math.floor(num * 1024 * 1024 * 1024)
  if (unit === 'M') return Math.floor(num * 1024 * 1024)
  if (unit === 'K') return Math.floor(num * 1024)
  return Math.floor(num)
}

export async function createOpenClawContainer(opts: CreateContainerOptions) {
  const docker = getDockerClient()
  const env: string[] = [
    `PROVIDER=${opts.provider}`,
    `MODEL=${opts.model}`,
    `API_KEY=${opts.apiKey}`,
    `OPENCLAW_GATEWAY_TOKEN=${opts.gatewayToken}`,
  ]
  if (opts.baseUrl) env.push(`BASE_URL=${opts.baseUrl}`)
  if (opts.allowedOrigin) env.push(`ALLOWED_ORIGIN=${opts.allowedOrigin}`)

  // Tell OpenClaw to bind to all interfaces when bindAddress is 0.0.0.0
  // OpenClaw --bind accepts "lan" for all interfaces, not raw IP
  const bindArg = opts.bindAddress === '0.0.0.0' ? ['--bind', 'lan'] : []

  // Use host path for bind mounts if available, otherwise container path
  const mountRoot = opts.hostDataDir ?? opts.dataDir

  const container = await docker.createContainer({
    name: `openclaw-${opts.name}`,
    Image: opts.imageTag,
    Env: env,
    Cmd: ['node', 'openclaw.mjs', 'gateway', '--allow-unconfigured', ...bindArg],
    ExposedPorts: { '18789/tcp': {} },
    Labels: { 'openclaw.managed': 'true', 'openclaw.instance': opts.name },
    HostConfig: {
      PortBindings: { '18789/tcp': [{ HostIp: opts.bindAddress, HostPort: String(opts.port) }] },
      Binds: [
        `${mountRoot}/conf:/home/node/.openclaw`,
        `${mountRoot}/workspace:/home/node/.openclaw/workspace`,
        `/etc/localtime:/etc/localtime:ro`,
      ],
      NanoCpus: Math.floor(opts.cpuLimit * 1e9),
      Memory: parseMemoryBytes(opts.memoryLimit),
      RestartPolicy: { Name: 'unless-stopped' },
    },
  })
  return container
}

export async function startContainer(containerId: string): Promise<void> {
  await getDockerClient().getContainer(containerId).start()
}

export async function stopContainer(containerId: string): Promise<void> {
  await getDockerClient().getContainer(containerId).stop({ t: 30 })
}

export async function restartContainer(containerId: string): Promise<void> {
  await getDockerClient().getContainer(containerId).restart({ t: 30 })
}

export async function removeContainer(containerId: string): Promise<void> {
  await getDockerClient().getContainer(containerId).remove({ force: true })
}

export async function getContainerStatus(containerId: string): Promise<string> {
  const info = await getDockerClient().getContainer(containerId).inspect()
  return info.State.Status
}

export interface ContainerStats {
  cpuPercent: number
  memUsedMb: number
  memLimitMb: number
}

export async function getContainerStats(containerId: string): Promise<ContainerStats> {
  const raw = await getDockerClient().getContainer(containerId).stats({ stream: false }) as any
  const cpuDelta = raw.cpu_stats.cpu_usage.total_usage - raw.precpu_stats.cpu_usage.total_usage
  const sysDelta = raw.cpu_stats.system_cpu_usage - raw.precpu_stats.system_cpu_usage
  const cpus = raw.cpu_stats.online_cpus ?? 1
  const cpuPercent = sysDelta > 0 ? (cpuDelta / sysDelta) * cpus * 100 : 0
  return {
    cpuPercent: Math.round(cpuPercent * 10) / 10,
    memUsedMb: Math.round(raw.memory_stats.usage / 1024 / 1024),
    memLimitMb: Math.round(raw.memory_stats.limit / 1024 / 1024),
  }
}

export async function pingDocker(): Promise<boolean> {
  try {
    await getDockerClient().ping()
    return true
  } catch {
    return false
  }
}

// Delete data directory using Docker API (runs as root to bypass permission issues)
// OpenClaw creates files with uid=1000 and mode 600/700, colony runs as uid=1001
export async function deleteDataDirectory(hostDataDir: string): Promise<void> {
  const docker = getDockerClient()

  // Use busybox (minimal) to delete the directory as root
  // Pull image if not available locally
  try {
    await docker.getImage('busybox:musl').inspect()
  } catch {
    // Pull and wait for completion
    const stream = await docker.pull('busybox:musl')
    await new Promise<void>((resolve, reject) => {
      docker.modem.followProgress(stream, (err) => err ? reject(err) : resolve())
    })
  }

  // Mount parent directory and delete the target subdirectory
  // (bind mount only shows contents, not the directory itself)
  const parentDir = hostDataDir.split('/').slice(0, -1).join('/')
  const targetName = hostDataDir.split('/').pop()

  const container = await docker.createContainer({
    Image: 'busybox:musl',
    Cmd: ['rm', '-rf', `/data/${targetName}`],
    HostConfig: {
      Binds: [`${parentDir}:/data`],
      AutoRemove: true,
    },
  })

  await container.start()
  // Wait for container to finish (it auto-removes)
  await container.wait()
}

export interface BuildImageOptions {
  dockerfile: string
  imageName: string
  imageTag: string
}

export interface BuildResult {
  imageId: string
  digest: string
  success: boolean
  error?: string
}

export async function buildImage(opts: BuildImageOptions): Promise<AsyncGenerator<string, BuildResult>> {
  const docker = getDockerClient()
  const tempDir = `/tmp/build-${Date.now()}`
  const fs = await import('fs/promises')
  const path = await import('path')

  // Create temp directory and write Dockerfile
  await fs.mkdir(tempDir, { recursive: true })
  await fs.writeFile(path.join(tempDir, 'Dockerfile'), opts.dockerfile)

  const fullTag = `${opts.imageName}:${opts.imageTag}`

  async function* generate(): AsyncGenerator<string, BuildResult> {
    try {
      const stream = await docker.buildImage({
        context: tempDir,
        src: ['Dockerfile'],
      }, {
        t: fullTag,
        dockerfile: 'Dockerfile',
      })

      // Stream build logs
      for await (const chunk of stream as AsyncIterable<Buffer>) {
        const lines = chunk.toString().split('\n').filter(l => l.trim())
        for (const line of lines) {
          try {
            const parsed = JSON.parse(line)
            if (parsed.stream) {
              yield parsed.stream.trim()
            } else if (parsed.error) {
              yield `ERROR: ${parsed.error.trim()}`
            }
          } catch {
            yield line
          }
        }
      }

      // Get image info after build
      const image = await docker.getImage(fullTag).inspect()

      // Cleanup temp directory
      await fs.rm(tempDir, { recursive: true, force: true })

      return {
        imageId: image.Id,
        digest: image.RepoDigests?.[0]?.split('@')[1] ?? image.Id,
        success: true,
      }
    } catch (err: any) {
      // Cleanup on error
      await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {})
      return {
        imageId: '',
        digest: '',
        success: false,
        error: err.message ?? '构建失败',
      }
    }
  }

  return generate()
}

// Generate Dockerfile template from base image
export function generateDockerfileTemplate(repository: string, tag: string): string {
  return `FROM ${repository}:${tag}

# 在此添加自定义配置
# 示例：
# RUN apk add --no-cache vim curl
# ENV MY_VAR=value
# COPY custom-config.yaml /app/config/
`
}
