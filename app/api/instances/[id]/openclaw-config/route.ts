import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { auth } from '@/lib/auth'
import {
  readOpenClawConfig,
  writeOpenClawConfig,
  mergeChannelConfig,
  mergeModelConfig,
  type OpenClawConfig,
  type FeishuConfig,
} from '@/lib/openclaw-config'
import { openclawConfigUpdateSchema } from '@/lib/validations'

type Params = { params: Promise<{ id: string }> }

export async function GET(req: NextRequest, { params }: Params) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const instance = await prisma.instance.findUnique({ where: { id } })
  if (!instance) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const dataDir = instance.dataDir ?? ''
  const config = readOpenClawConfig(dataDir)

  return NextResponse.json({
    channels: config.channels ?? {},
    agents: config.agents ?? { defaults: { model: { primary: '', fallbacks: [] } } },
  })
}

export async function PUT(req: NextRequest, { params }: Params) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const instance = await prisma.instance.findUnique({ where: { id } })
  if (!instance) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body = await req.json()
  const parsed = openclawConfigUpdateSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const dataDir = instance.dataDir ?? ''
  const existing = readOpenClawConfig(dataDir)

  let merged: OpenClawConfig = existing

  if (parsed.data.channels?.feishu) {
    const feishuConfig: FeishuConfig = {
      ...parsed.data.channels.feishu,
      groups: parsed.data.channels.feishu.groups as { [key: string]: { requireMention?: boolean } } | undefined,
    }
    merged = mergeChannelConfig(merged, feishuConfig)
  }

  if (parsed.data.agents?.defaults?.model) {
    merged = mergeModelConfig(merged, parsed.data.agents.defaults.model)
  }

  try {
    writeOpenClawConfig(dataDir, merged, existing)
  } catch (err) {
    return NextResponse.json({ error: 'Failed to write config' }, { status: 500 })
  }

  return NextResponse.json({
    channels: merged.channels,
    agents: merged.agents,
    message: 'Config updated. Hot-reload will apply changes automatically.',
  })
}