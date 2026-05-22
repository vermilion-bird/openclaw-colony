import Docker from 'dockerode'

let _docker: Docker | null = null

function getDockerClient(): Docker {
  if (!_docker) _docker = new Docker({ socketPath: '/var/run/docker.sock' })
  return _docker
}

export interface ImageInfo {
  tag: string
  digest: string
  pushedAt: Date
  compressedSize: number
  os: string
  architecture: string
}

// Pull image from ghcr.io and get its info
export async function pullAndInspectImage(repository: string, tag: string): Promise<ImageInfo | null> {
  const docker = getDockerClient()
  const fullTag = `${repository}:${tag}`

  try {
    // Pull image
    const stream = await docker.pull(fullTag)
    await new Promise<void>((resolve, reject) => {
      docker.modem.followProgress(stream, (err) => err ? reject(err) : resolve())
    })

    // Inspect image
    const image = await docker.getImage(fullTag).inspect()

    // Get size from layers
    const size = image.Size ?? 0

    // Get OS and architecture
    const os = image.Os ?? 'linux'
    const architecture = image.Architecture ?? 'amd64'

    // Get digest
    const digest = image.RepoDigests?.[0]?.split('@')[1] ?? image.Id

    return {
      tag,
      digest,
      pushedAt: new Date(image.Created ?? Date.now()),
      compressedSize: size,
      os,
      architecture,
    }
  } catch (err: any) {
    if (err.message?.includes('not found') || err.statusCode === 404) {
      return null
    }
    throw new Error(`拉取镜像失败: ${err.message}`)
  }
}

// Check if image exists locally
export async function getLocalImageInfo(repository: string, tag: string): Promise<ImageInfo | null> {
  const docker = getDockerClient()
  const fullTag = `${repository}:${tag}`

  try {
    const image = await docker.getImage(fullTag).inspect()

    const size = image.Size ?? 0
    const os = image.Os ?? 'linux'
    const architecture = image.Architecture ?? 'amd64'
    const digest = image.RepoDigests?.[0]?.split('@')[1] ?? image.Id

    return {
      tag,
      digest,
      pushedAt: new Date(image.Created ?? Date.now()),
      compressedSize: size,
      os,
      architecture,
    }
  } catch {
    return null
  }
}