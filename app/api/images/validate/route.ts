import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { fetchTagInfo } from '@/lib/docker-hub'
import { pullAndInspectImage, getLocalImageInfo } from '@/lib/ghcr'
import { validateTagSchema } from '@/lib/validations'

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
  const parsed = validateTagSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const { tag, repository } = parsed.data

  try {
    // Docker Hub (default)
    if (repository === 'dockerhub') {
      const info = await fetchTagInfo(tag)
      if (!info) {
        return NextResponse.json({ error: 'Tag 不存在，请前往 Docker Hub 确认版本号' }, { status: 404 })
      }
      return NextResponse.json({
        tag: info.tag,
        digest: info.digest,
        pushedAt: info.pushedAt.toISOString(),
        compressedSize: info.compressedSize,
        os: info.os,
        architecture: info.architecture,
        repository: 'openclaw/openclaw',
      })
    }

    // ghcr.io
    if (repository === 'ghcr') {
      // Check if image exists locally first
      let info = await getLocalImageInfo('ghcr.io/openclaw/openclaw', tag)
      if (!info) {
        // Pull image if not local
        info = await pullAndInspectImage('ghcr.io/openclaw/openclaw', tag)
      }
      if (!info) {
        return NextResponse.json({ error: '镜像不存在或拉取失败' }, { status: 404 })
      }
      return NextResponse.json({
        tag: info.tag,
        digest: info.digest,
        pushedAt: info.pushedAt.toISOString(),
        compressedSize: info.compressedSize,
        os: info.os,
        architecture: info.architecture,
        repository: 'ghcr.io/openclaw/openclaw',
      })
    }

    return NextResponse.json({ error: '无效的仓库来源' }, { status: 400 })
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? '查询失败' }, { status: 500 })
  }
}