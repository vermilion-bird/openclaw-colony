import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { auth } from '@/lib/auth'
import {
  readOpenClawConfig,
  writeOpenClawConfig,
  mergeChannelConfig,
  mergeModelConfig,
  mergeAgentsConfig,
  type OpenClawConfig,
  type FeishuConfig,
  type AgentConfig,
  type BindingConfig,
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
    agents: {
      defaults: config.agents?.defaults ?? { model: { primary: '', fallbacks: [] } },
      list: config.agents?.list ?? [],
    },
    bindings: config.bindings ?? [],
  })
}

function validateAgentsConfig(list: AgentConfig[] | undefined): string | null {
  if (!list || list.length === 0) return null

  const ids = list.map(a => a.id)
  const uniqueIds = new Set(ids)
  if (ids.length !== uniqueIds.size) {
    return 'Agent ID must be unique'
  }

  const defaultCount = list.filter(a => a.default === true).length
  if (defaultCount > 1) {
    return 'Only one agent can be default'
  }

  return null
}

function validateBindingsConfig(bindings: BindingConfig[] | undefined, agentIds: string[]): string | null {
  if (!bindings || bindings.length === 0) return null

  for (const b of bindings) {
    if (!agentIds.includes(b.agentId)) {
      return `Binding references unknown agent: ${b.agentId}`
    }
  }

  return null
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

  // Validate agents config
  const agentError = validateAgentsConfig(parsed.data.agents?.list)
  if (agentError) {
    return NextResponse.json({ error: agentError }, { status: 400 })
  }

  // Validate bindings
  const agentIds = parsed.data.agents?.list?.map(a => a.id) ?? []
  const bindingError = validateBindingsConfig(parsed.data.bindings, agentIds)
  if (bindingError) {
    return NextResponse.json({ error: bindingError }, { status: 400 })
  }

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

  if (parsed.data.agents?.list || parsed.data.bindings) {
    merged = mergeAgentsConfig(merged, parsed.data.agents, parsed.data.bindings)
  }

  try {
    writeOpenClawConfig(dataDir, merged, existing)
  } catch (err) {
    return NextResponse.json({ error: 'Failed to write config' }, { status: 500 })
  }

  return NextResponse.json({
    channels: merged.channels,
    agents: merged.agents,
    bindings: merged.bindings,
    message: 'Config updated. Hot-reload will apply changes automatically.',
  })
}