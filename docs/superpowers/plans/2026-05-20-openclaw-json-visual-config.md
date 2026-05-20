# OpenClaw.json Visual Configuration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add visual UI for configuring openclaw.json channels (Feishu) and models (primary + fallbacks) with hot-reload capability in the instance list page.

**Architecture:** Extend EditConfigSheet with Tabs component. Create new API route for reading/writing openclaw.json files directly from instance dataDir. Build separate form components for channel and model config.

**Tech Stack:** Next.js 16, @base-ui/react (Tabs), Zod 4, TypeScript, Vitest

---

## File Structure

| File | Action | Purpose |
|------|--------|---------|
| `components/ui/tabs.tsx` | Create | shadcn-style Tabs using @base-ui/react |
| `lib/openclaw-config.ts` | Create | Helper functions for openclaw.json file operations |
| `lib/validations.ts` | Modify | Add feishuConfigSchema and modelConfigSchema |
| `app/api/instances/[id]/openclaw-config/route.ts` | Create | GET/PUT API for openclaw.json config |
| `components/channel-config-form.tsx` | Create | Feishu channel configuration form |
| `components/model-config-form.tsx` | Create | Model primary/fallback configuration form |
| `components/edit-config-sheet.tsx` | Modify | Add Tabs with three sections |
| `tests/api/instances/openclaw-config.test.ts` | Create | Unit tests for openclaw-config API |

---

## Task 1: Create Tabs UI Component

**Files:**
- Create: `components/ui/tabs.tsx`

- [ ] **Step 1: Create tabs.tsx component using @base-ui/react**

```tsx
"use client"

import * as React from "react"
import { Tabs as TabsPrimitive } from "@base-ui/react/tabs"

import { cn } from "@/lib/utils"

const Tabs = TabsPrimitive.Root

function TabsList({
  className,
  ...props
}: TabsPrimitive.List.Props) {
  return (
    <TabsPrimitive.List
      data-slot="tabs-list"
      className={cn(
        "inline-flex h-9 items-center gap-1 rounded-lg bg-muted p-1 text-muted-foreground",
        className
      )}
      {...props}
    />
  )
}

function TabsTrigger({
  className,
  ...props
}: TabsPrimitive.Tab.Props) {
  return (
    <TabsPrimitive.Tab
      data-slot="tabs-trigger"
      className={cn(
        "inline-flex items-center justify-center gap-1.5 rounded-md px-3 py-1 text-sm font-medium whitespace-nowrap transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 data-selected:bg-background data-selected:text-foreground data-selected:shadow-sm",
        className
      )}
      {...props}
    />
  )
}

function TabsContent({
  className,
  ...props
}: TabsPrimitive.Panel.Props) {
  return (
    <TabsPrimitive.Panel
      data-slot="tabs-content"
      className={cn(
        "flex-1 outline-none",
        className
      )}
      {...props}
    />
  )
}

export { Tabs, TabsList, TabsTrigger, TabsContent }
```

- [ ] **Step 2: Verify component compiles**

Run: `cd /home/ubuntu/workspace/openclaw_colony/openclaw-colony && npx tsc --noEmit components/ui/tabs.tsx`
Expected: No errors

---

## Task 2: Create OpenClaw Config Helper Library

**Files:**
- Create: `lib/openclaw-config.ts`

- [ ] **Step 1: Write openclaw-config.ts helper functions**

```ts
import fs from 'fs'
import path from 'path'

export interface FeishuConfig {
  enabled?: boolean
  appId: string
  appSecret: string
  encryptKey?: string
  dmPolicy?: 'pairing' | 'open' | 'disabled'
  allowFrom?: string[]
  groups?: { [key: string]: { requireMention?: boolean } }
}

export interface ModelConfig {
  primary: string
  fallbacks?: string[]
}

export interface OpenClawConfig {
  channels?: {
    feishu?: FeishuConfig
  }
  agents?: {
    defaults?: {
      model?: ModelConfig
    }
  }
  gateway?: {
    reload?: {
      mode?: string
    }
  }
}

const DEFAULT_CONFIG: OpenClawConfig = {
  channels: {},
  agents: {
    defaults: {
      model: {
        primary: '',
        fallbacks: [],
      },
    },
  },
}

export function getOpenClawConfigPath(dataDir: string): string {
  return path.join(dataDir, 'conf', 'openclaw.json')
}

export function readOpenClawConfig(dataDir: string): OpenClawConfig {
  const configPath = getOpenClawConfigPath(dataDir)
  try {
    if (!fs.existsSync(configPath)) {
      return DEFAULT_CONFIG
    }
    const content = fs.readFileSync(configPath, 'utf-8')
    const parsed = JSON.parse(content)
    return {
      ...DEFAULT_CONFIG,
      ...parsed,
      channels: { ...DEFAULT_CONFIG.channels, ...parsed.channels },
      agents: { ...DEFAULT_CONFIG.agents, ...parsed.agents },
    }
  } catch {
    return DEFAULT_CONFIG
  }
}

export function writeOpenClawConfig(
  dataDir: string,
  config: OpenClawConfig,
  existing: OpenClawConfig
): void {
  const configPath = getOpenClawConfigPath(dataDir)

  // Merge with existing config to preserve gateway, meta, etc.
  const merged = deepMerge(existing, config)

  // Ensure reload mode is set for hot-reload
  if (!merged.gateway?.reload?.mode) {
    merged.gateway = { ...merged.gateway, reload: { mode: 'file' } }
  }

  // Ensure directory exists
  const confDir = path.dirname(configPath)
  if (!fs.existsSync(confDir)) {
    fs.mkdirSync(confDir, { recursive: true })
  }

  fs.writeFileSync(configPath, JSON.stringify(merged, null, 2))
}

function deepMerge(target: any, source: any): any {
  const result = { ...target }
  for (const key of Object.keys(source)) {
    if (
      source[key] !== null &&
      typeof source[key] === 'object' &&
      !Array.isArray(source[key]) &&
      target[key] !== null &&
      typeof target[key] === 'object' &&
      !Array.isArray(target[key])
    ) {
      result[key] = deepMerge(target[key], source[key])
    } else if (source[key] !== undefined) {
      result[key] = source[key]
    }
  }
  return result
}

export function mergeChannelConfig(
  existing: OpenClawConfig,
  feishu?: FeishuConfig
): OpenClawConfig {
  if (!feishu) return existing
  return {
    ...existing,
    channels: {
      ...existing.channels,
      feishu,
    },
  }
}

export function mergeModelConfig(
  existing: OpenClawConfig,
  model?: ModelConfig
): OpenClawConfig {
  if (!model) return existing
  return {
    ...existing,
    agents: {
      ...existing.agents,
      defaults: {
        ...existing.agents?.defaults,
        model,
      },
    },
  }
}
```

- [ ] **Step 2: Verify library compiles**

Run: `cd /home/ubuntu/workspace/openclaw_colony/openclaw-colony && npx tsc --noEmit lib/openclaw-config.ts`
Expected: No errors

---

## Task 3: Add Validation Schemas

**Files:**
- Modify: `lib/validations.ts`

- [ ] **Step 1: Add feishuConfigSchema and modelConfigSchema to validations.ts**

Append to end of file:

```ts
export const feishuConfigSchema = z.object({
  enabled: z.boolean().optional(),
  appId: z.string().min(1, 'App ID is required'),
  appSecret: z.string().min(1, 'App Secret is required'),
  encryptKey: z.string().optional(),
  dmPolicy: z.enum(['pairing', 'open', 'disabled']).optional(),
  allowFrom: z.array(z.string()).optional(),
  groups: z.record(z.object({
    requireMention: z.boolean().optional(),
  })).optional(),
})

export type FeishuConfigInput = z.infer<typeof feishuConfigSchema>

export const modelConfigSchema = z.object({
  primary: z.string().min(1, 'Primary model is required'),
  fallbacks: z.array(z.string()).optional(),
})

export type ModelConfigInput = z.infer<typeof modelConfigSchema>

export const openclawConfigUpdateSchema = z.object({
  channels: z.object({
    feishu: feishuConfigSchema.optional(),
  }).optional(),
  agents: z.object({
    defaults: z.object({
      model: modelConfigSchema.optional(),
    }).optional(),
  }).optional(),
})

export type OpenclawConfigUpdateInput = z.infer<typeof openclawConfigUpdateSchema>
```

- [ ] **Step 2: Verify validation schema compiles**

Run: `cd /home/ubuntu/workspace/openclaw_colony/openclaw-colony && npx tsc --noEmit lib/validations.ts`
Expected: No errors

---

## Task 4: Create OpenClaw Config API Route

**Files:**
- Create: `app/api/instances/[id]/openclaw-config/route.ts`

- [ ] **Step 1: Write API route for GET/PUT openclaw-config**

```ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { auth } from '@/lib/auth'
import {
  readOpenClawConfig,
  writeOpenClawConfig,
  mergeChannelConfig,
  mergeModelConfig,
  type OpenClawConfig,
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
    merged = mergeChannelConfig(merged, parsed.data.channels.feishu)
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
```

- [ ] **Step 2: Verify API route compiles**

Run: `cd /home/ubuntu/workspace/openclaw_colony/openclaw-colony && npx tsc --noEmit app/api/instances/\[id\]/openclaw-config/route.ts`
Expected: No errors

---

## Task 5: Write API Unit Tests

**Files:**
- Create: `tests/api/instances/openclaw-config.test.ts`

- [ ] **Step 1: Write test file for openclaw-config API**

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import fs from 'fs'

vi.mock('@/lib/db', () => ({
  prisma: {
    instance: {
      findUnique: vi.fn(),
    },
  },
}))

vi.mock('@/lib/auth', () => ({
  auth: vi.fn().mockResolvedValue({ user: { id: 'user1', role: 'admin' } }),
}))

vi.mock('@/lib/openclaw-config', () => ({
  readOpenClawConfig: vi.fn(),
  writeOpenClawConfig: vi.fn(),
  mergeChannelConfig: vi.fn((existing, feishu) => ({
    ...existing,
    channels: { feishu },
  })),
  mergeModelConfig: vi.fn((existing, model) => ({
    ...existing,
    agents: { defaults: { model } },
  })),
}))

vi.mock('fs', () => ({
  default: {
    existsSync: vi.fn().mockReturnValue(true),
    readFileSync: vi.fn().mockReturnValue('{}'),
    writeFileSync: vi.fn(),
    mkdirSync: vi.fn(),
  },
  existsSync: vi.fn().mockReturnValue(true),
  readFileSync: vi.fn().mockReturnValue('{}'),
  writeFileSync: vi.fn(),
  mkdirSync: vi.fn(),
}))

const { GET, PUT } = await import('@/app/api/instances/[id]/openclaw-config/route')
import { prisma } from '@/lib/db'
import { readOpenClawConfig, writeOpenClawConfig } from '@/lib/openclaw-config'

describe('GET /api/instances/[id]/openclaw-config', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 401 when not authenticated', async () => {
    vi.mocked(prisma.instance.findUnique).mockResolvedValue(null)
    const req = new NextRequest('http://localhost/api/instances/inst1/openclaw-config')
    const res = await GET(req, { params: Promise.resolve({ id: 'inst1' }) })
    expect(res.status).toBe(401)
  })

  it('returns 404 when instance not found', async () => {
    vi.mocked(prisma.instance.findUnique).mockResolvedValue(null)
    const req = new NextRequest('http://localhost/api/instances/inst1/openclaw-config')
    const res = await GET(req, { params: Promise.resolve({ id: 'inst1' }) })
    expect(res.status).toBe(404)
  })

  it('returns config when instance exists', async () => {
    vi.mocked(prisma.instance.findUnique).mockResolvedValue({
      id: 'inst1',
      dataDir: '/data/test',
    } as any)
    vi.mocked(readOpenClawConfig).mockReturnValue({
      channels: { feishu: { appId: 'test', appSecret: 'secret' } },
      agents: { defaults: { model: { primary: 'deepseek/chat', fallbacks: [] } } },
    })

    const req = new NextRequest('http://localhost/api/instances/inst1/openclaw-config')
    const res = await GET(req, { params: Promise.resolve({ id: 'inst1' }) })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.channels).toBeDefined()
    expect(body.agents).toBeDefined()
  })
})

describe('PUT /api/instances/[id]/openclaw-config', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 400 on invalid input', async () => {
    vi.mocked(prisma.instance.findUnique).mockResolvedValue({
      id: 'inst1',
      dataDir: '/data/test',
    } as any)

    const req = new NextRequest('http://localhost/api/instances/inst1/openclaw-config', {
      method: 'PUT',
      body: JSON.stringify({ channels: { feishu: { appId: '' } } }),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await PUT(req, { params: Promise.resolve({ id: 'inst1' }) })
    expect(res.status).toBe(400)
  })

  it('updates feishu config', async () => {
    vi.mocked(prisma.instance.findUnique).mockResolvedValue({
      id: 'inst1',
      dataDir: '/data/test',
    } as any)
    vi.mocked(readOpenClawConfig).mockReturnValue({ channels: {}, agents: {} })
    vi.mocked(writeOpenClawConfig).mockImplementation(() => {})

    const req = new NextRequest('http://localhost/api/instances/inst1/openclaw-config', {
      method: 'PUT',
      body: JSON.stringify({
        channels: { feishu: { appId: 'new-app', appSecret: 'new-secret' } },
      }),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await PUT(req, { params: Promise.resolve({ id: 'inst1' }) })
    expect(res.status).toBe(200)
    expect(writeOpenClawConfig).toHaveBeenCalled()
  })

  it('updates model config', async () => {
    vi.mocked(prisma.instance.findUnique).mockResolvedValue({
      id: 'inst1',
      dataDir: '/data/test',
    } as any)
    vi.mocked(readOpenClawConfig).mockReturnValue({ channels: {}, agents: {} })
    vi.mocked(writeOpenClawConfig).mockImplementation(() => {})

    const req = new NextRequest('http://localhost/api/instances/inst1/openclaw-config', {
      method: 'PUT',
      body: JSON.stringify({
        agents: { defaults: { model: { primary: 'anthropic/claude-sonnet-4-6', fallbacks: ['openai/gpt-4o'] } } },
      }),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await PUT(req, { params: Promise.resolve({ id: 'inst1' }) })
    expect(res.status).toBe(200)
    expect(writeOpenClawConfig).toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run tests to verify they pass**

Run: `cd /home/ubuntu/workspace/openclaw_colony/openclaw-colony && npm test tests/api/instances/openclaw-config.test.ts`
Expected: All tests pass

---

## Task 6: Create Channel Config Form Component

**Files:**
- Create: `components/channel-config-form.tsx`

- [ ] **Step 1: Create channel-config-form.tsx component**

```tsx
'use client'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Plus, X } from 'lucide-react'

interface FeishuConfig {
  enabled: boolean
  appId: string
  appSecret: string
  encryptKey: string
  dmPolicy: 'pairing' | 'open' | 'disabled'
  allowFrom: string[]
  requireMention: boolean
}

interface Props {
  instanceId: string
  initialConfig: FeishuConfig | null
  onSaved: () => void
}

export function ChannelConfigForm({ instanceId, initialConfig, onSaved }: Props) {
  const [config, setConfig] = useState<FeishuConfig>(
    initialConfig ?? {
      enabled: true,
      appId: '',
      appSecret: '',
      encryptKey: '',
      dmPolicy: 'pairing',
      allowFrom: [],
      requireMention: true,
    }
  )
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [newAllowFrom, setNewAllowFrom] = useState('')

  function update<K extends keyof FeishuConfig>(key: K, value: FeishuConfig[K]) {
    setConfig(c => ({ ...c, [key]: value }))
  }

  function addAllowFrom() {
    if (newAllowFrom.trim()) {
      update('allowFrom', [...config.allowFrom, newAllowFrom.trim()])
      setNewAllowFrom('')
    }
  }

  function removeAllowFrom(index: number) {
    update('allowFrom', config.allowFrom.filter((_, i) => i !== index))
  }

  async function handleSave() {
    if (!config.appId || !config.appSecret) {
      setError('App ID and App Secret are required')
      return
    }
    setSaving(true)
    setError('')

    const payload = {
      channels: {
        feishu: {
          enabled: config.enabled,
          appId: config.appId,
          appSecret: config.appSecret,
          encryptKey: config.encryptKey || undefined,
          dmPolicy: config.dmPolicy,
          allowFrom: config.allowFrom.length > 0 ? config.allowFrom : undefined,
          groups: config.requireMention ? { '*': { requireMention: true } } : undefined,
        },
      },
    }

    const res = await fetch(`/api/instances/${instanceId}/openclaw-config`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    if (res.ok) {
      onSaved()
    } else {
      const data = await res.json()
      setError(typeof data.error === 'string' ? data.error : '保存失败')
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">飞书配置</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-2">
            <Checkbox
              id="enabled"
              checked={config.enabled}
              onCheckedChange={v => update('enabled', v === true)}
            />
            <Label htmlFor="enabled">启用飞书渠道</Label>
          </div>

          <div className="space-y-1">
            <Label htmlFor="appId">App ID *</Label>
            <Input
              id="appId"
              value={config.appId}
              onChange={e => update('appId', e.target.value)}
              placeholder="飞书应用 App ID"
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="appSecret">App Secret *</Label>
            <Input
              id="appSecret"
              type="password"
              value={config.appSecret}
              onChange={e => update('appSecret', e.target.value)}
              placeholder="飞书应用 App Secret"
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="encryptKey">Encrypt Key（可选）</Label>
            <Input
              id="encryptKey"
              value={config.encryptKey}
              onChange={e => update('encryptKey', e.target.value)}
              placeholder="消息加密 Key"
            />
          </div>

          <div className="space-y-1">
            <Label>DM Policy</Label>
            <Select
              value={config.dmPolicy}
              onValueChange={v => update('dmPolicy', v as FeishuConfig['dmPolicy'])}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pairing">配对（默认）</SelectItem>
                <SelectItem value="open">开放</SelectItem>
                <SelectItem value="disabled">禁用</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <details className="text-sm">
            <summary className="cursor-pointer text-gray-500 hover:text-gray-700">高级选项</summary>
            <div className="mt-3 space-y-4 pl-2 border-l-2 border-gray-100">
              <div className="space-y-1">
                <Label>Allow From（用户 ID 白名单）</Label>
                <div className="flex gap-2">
                  <Input
                    value={newAllowFrom}
                    onChange={e => setNewAllowFrom(e.target.value)}
                    placeholder="用户 ID"
                  />
                  <Button size="sm" variant="outline" onClick={addAllowFrom}>
                    <Plus className="w-3 h-3" />
                  </Button>
                </div>
                {config.allowFrom.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {config.allowFrom.map((id, i) => (
                      <span
                        key={i}
                        className="inline-flex items-center gap-1 px-2 py-0.5 bg-gray-100 rounded text-xs"
                      >
                        {id}
                        <X
                          className="w-3 h-3 cursor-pointer hover:text-red-500"
                          onClick={() => removeAllowFrom(i)}
                        />
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2">
                <Checkbox
                  id="requireMention"
                  checked={config.requireMention}
                  onCheckedChange={v => update('requireMention', v === true)}
                />
                <Label htmlFor="requireMention">群消息需要 @ 提及</Label>
              </div>
            </div>
          </details>
        </CardContent>
      </Card>

      {error && <p className="text-sm text-red-500">{error}</p>}
      <p className="text-xs text-gray-500">配置将自动热更新，无需重启实例</p>
      <Button onClick={handleSave} disabled={saving} className="w-full">
        {saving ? '保存中...' : '保存配置'}
      </Button>
    </div>
  )
}
```

- [ ] **Step 2: Verify component compiles**

Run: `cd /home/ubuntu/workspace/openclaw_colony/openclaw-colony && npx tsc --noEmit components/channel-config-form.tsx`
Expected: No errors

---

## Task 7: Create Model Config Form Component

**Files:**
- Create: `components/model-config-form.tsx`

- [ ] **Step 1: Create model-config-form.tsx component**

```tsx
'use client'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Plus, X } from 'lucide-react'

interface ModelConfig {
  primary: string
  fallbacks: string[]
}

interface Props {
  instanceId: string
  initialConfig: ModelConfig | null
  onSaved: () => void
}

const MODEL_HINTS = [
  'anthropic/claude-opus-4-7',
  'anthropic/claude-sonnet-4-6',
  'openai/gpt-4o',
  'openai/gpt-4o-mini',
  'deepseek/deepseek-chat',
  'google/gemini-2.0-flash',
  'ollama/llama3',
]

export function ModelConfigForm({ instanceId, initialConfig, onSaved }: Props) {
  const [config, setConfig] = useState<ModelConfig>(
    initialConfig ?? { primary: '', fallbacks: [] }
  )
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [newFallback, setNewFallback] = useState('')

  function update<K extends keyof ModelConfig>(key: K, value: ModelConfig[K]) {
    setConfig(c => ({ ...c, [key]: value }))
  }

  function addFallback() {
    if (newFallback.trim()) {
      update('fallbacks', [...config.fallbacks, newFallback.trim()])
      setNewFallback('')
    }
  }

  function removeFallback(index: number) {
    update('fallbacks', config.fallbacks.filter((_, i) => i !== index))
  }

  async function handleSave() {
    if (!config.primary) {
      setError('主模型不能为空')
      return
    }
    setSaving(true)
    setError('')

    const payload = {
      agents: {
        defaults: {
          model: {
            primary: config.primary,
            fallbacks: config.fallbacks.length > 0 ? config.fallbacks : undefined,
          },
        },
      },
    }

    const res = await fetch(`/api/instances/${instanceId}/openclaw-config`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    if (res.ok) {
      onSaved()
    } else {
      const data = await res.json()
      setError(typeof data.error === 'string' ? data.error : '保存失败')
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">模型配置</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1">
            <Label htmlFor="primary">主模型 *</Label>
            <Input
              id="primary"
              value={config.primary}
              onChange={e => update('primary', e.target.value)}
              placeholder="provider/model-name"
              list="model-hints"
            />
            <datalist id="model-hints">
              {MODEL_HINTS.map(h => <option key={h} value={h} />)}
            </datalist>
            <p className="text-xs text-gray-500">
              格式：provider/model-name，如 anthropic/claude-sonnet-4-6
            </p>
          </div>

          <div className="space-y-1">
            <Label>Fallback 模型列表</Label>
            <p className="text-xs text-gray-500">
              主模型失败时按顺序依次尝试 fallback 模型
            </p>
            <div className="flex gap-2">
              <Input
                value={newFallback}
                onChange={e => setNewFallback(e.target.value)}
                placeholder="provider/model-name"
                list="model-hints"
              />
              <Button size="sm" variant="outline" onClick={addFallback}>
                <Plus className="w-3 h-3" />
              </Button>
            </div>
            {config.fallbacks.length > 0 && (
              <div className="space-y-1 mt-2">
                {config.fallbacks.map((model, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between p-2 bg-gray-50 rounded"
                  >
                    <span className="text-sm">{i + 1}. {model}</span>
                    <X
                      className="w-4 h-4 cursor-pointer hover:text-red-500"
                      onClick={() => removeFallback(i)}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {error && <p className="text-sm text-red-500">{error}</p>}
      <p className="text-xs text-gray-500">配置将自动热更新，无需重启实例</p>
      <Button onClick={handleSave} disabled={saving} className="w-full">
        {saving ? '保存中...' : '保存配置'}
      </Button>
    </div>
  )
}
```

- [ ] **Step 2: Verify component compiles**

Run: `cd /home/ubuntu/workspace/openclaw_colony/openclaw-colony && npx tsc --noEmit components/model-config-form.tsx`
Expected: No errors

---

## Task 8: Modify EditConfigSheet to Add Tabs

**Files:**
- Modify: `components/edit-config-sheet.tsx`

- [ ] **Step 1: Read current EditConfigSheet content**

The file is at `components/edit-config-sheet.tsx`. Read it first.

- [ ] **Step 2: Rewrite EditConfigSheet with Tabs integration**

Replace entire file with:

```tsx
'use client'
import { useEffect, useState } from 'react'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from '@/components/ui/sheet'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ChannelConfigForm } from '@/components/channel-config-form'
import { ModelConfigForm } from '@/components/model-config-form'

interface FeishuConfig {
  enabled: boolean
  appId: string
  appSecret: string
  encryptKey: string
  dmPolicy: 'pairing' | 'open' | 'disabled'
  allowFrom: string[]
  requireMention: boolean
}

interface ModelConfig {
  primary: string
  fallbacks: string[]
}

interface OpenClawConfigData {
  channels: { feishu?: any }
  agents: { defaults?: { model?: ModelConfig } }
}

interface Props {
  instanceId: string
  onClose: () => void
  onSaved: () => void
}

export function EditConfigSheet({ instanceId, onClose, onSaved }: Props) {
  const [tab, setTab] = useState('basic')
  const [basicForm, setBasicForm] = useState({
    provider: '', model: '', apiKey: '', baseUrl: '', cpuLimit: '', memoryLimit: '',
  })
  const [feishuConfig, setFeishuConfig] = useState<FeishuConfig | null>(null)
  const [modelConfig, setModelConfig] = useState<ModelConfig | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    // Fetch basic config
    fetch(`/api/instances/${instanceId}`).then(r => r.json()).then(data => {
      setBasicForm({
        provider: data.provider ?? '',
        model: data.model ?? '',
        apiKey: '',
        baseUrl: data.baseUrl ?? '',
        cpuLimit: String(data.cpuLimit ?? 2),
        memoryLimit: data.memoryLimit ?? '2G',
      })
    })

    // Fetch openclaw config
    fetch(`/api/instances/${instanceId}/openclaw-config`).then(r => r.json()).then(data => {
      const feishu = data.channels?.feishu
      if (feishu) {
        setFeishuConfig({
          enabled: feishu.enabled ?? true,
          appId: feishu.appId ?? '',
          appSecret: feishu.appSecret ?? '',
          encryptKey: feishu.encryptKey ?? '',
          dmPolicy: feishu.dmPolicy ?? 'pairing',
          allowFrom: feishu.allowFrom ?? [],
          requireMention: feishu.groups?.['*']?.requireMention ?? true,
        })
      }

      const model = data.agents?.defaults?.model
      if (model) {
        setModelConfig({
          primary: model.primary ?? '',
          fallbacks: model.fallbacks ?? [],
        })
      }
    })
  }, [instanceId])

  async function handleBasicSave() {
    setSaving(true)
    setError('')
    const payload: Record<string, string | number> = {
      provider: basicForm.provider,
      model: basicForm.model,
      baseUrl: basicForm.baseUrl,
      cpuLimit: parseFloat(basicForm.cpuLimit),
      memoryLimit: basicForm.memoryLimit,
    }
    if (basicForm.apiKey) payload.apiKey = basicForm.apiKey

    const res = await fetch(`/api/instances/${instanceId}/config`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    if (res.ok) {
      onSaved()
      onClose()
    } else {
      const data = await res.json()
      setError(typeof data.error === 'string' ? data.error : '保存失败')
      setSaving(false)
    }
  }

  return (
    <Sheet open onOpenChange={onClose}>
      <SheetContent className="w-[400px] space-y-4">
        <SheetHeader><SheetTitle>编辑配置</SheetTitle></SheetHeader>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="w-full">
            <TabsTrigger value="basic" className="flex-1">基础</TabsTrigger>
            <TabsTrigger value="channel" className="flex-1">渠道</TabsTrigger>
            <TabsTrigger value="model" className="flex-1">模型</TabsTrigger>
          </TabsList>

          <TabsContent value="basic" className="space-y-4 mt-4">
            <p className="text-sm text-amber-600 bg-amber-50 p-2 rounded">
              ⚠️ 此操作会重启实例，数据保留，连接中断约 5s
            </p>
            {[
              { key: 'provider', label: '提供商', type: 'text' },
              { key: 'model', label: '模型名', type: 'text' },
              { key: 'apiKey', label: 'API Key（留空保持不变）', type: 'password' },
              { key: 'baseUrl', label: 'Base URL（可选）', type: 'text' },
              { key: 'cpuLimit', label: 'CPU 上限', type: 'number' },
              { key: 'memoryLimit', label: '内存上限（如 2G）', type: 'text' },
            ].map(({ key, label, type }) => (
              <div key={key} className="space-y-1">
                <Label>{label}</Label>
                <Input
                  type={type}
                  value={(basicForm as any)[key]}
                  onChange={e => setBasicForm(f => ({ ...f, [key]: e.target.value }))}
                />
              </div>
            ))}
            {error && <p className="text-sm text-red-500">{error}</p>}
            <SheetFooter>
              <Button onClick={handleBasicSave} disabled={saving} className="w-full">
                {saving ? '保存并重建中...' : '保存配置'}
              </Button>
            </SheetFooter>
          </TabsContent>

          <TabsContent value="channel" className="mt-4">
            <ChannelConfigForm
              instanceId={instanceId}
              initialConfig={feishuConfig}
              onSaved={() => { onSaved(); onClose(); }}
            />
          </TabsContent>

          <TabsContent value="model" className="mt-4">
            <ModelConfigForm
              instanceId={instanceId}
              initialConfig={modelConfig}
              onSaved={() => { onSaved(); onClose(); }}
            />
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  )
}
```

- [ ] **Step 3: Verify modified component compiles**

Run: `cd /home/ubuntu/workspace/openclaw_colony/openclaw-colony && npx tsc --noEmit components/edit-config-sheet.tsx`
Expected: No errors

---

## Task 9: Run Full Test Suite

- [ ] **Step 1: Run all tests**

Run: `cd /home/ubuntu/workspace/openclaw_colony/openclaw-colony && npm test`
Expected: All tests pass

- [ ] **Step 2: Build project to verify no compilation errors**

Run: `cd /home/ubuntu/workspace/openclaw_colony/openclaw-colony && npm run build`
Expected: Build succeeds

---

## Task 10: Integration and Regression Testing

- [ ] **Step 1: Start development server**

Run: `cd /home/ubuntu/workspace/openclaw_colony/openclaw-colony && npm run dev`
Wait for server to be ready

- [ ] **Step 2: Manual test - Open EditConfigSheet**

1. Navigate to instance list page
2. Click "配置" button on an instance card
3. Verify three tabs appear: 基础、渠道、模型
4. Click each tab to verify content loads

- [ ] **Step 3: Manual test - Channel config (Feishu)**

1. Click "渠道" tab
2. Fill in App ID and App Secret
3. Click save
4. Verify success message appears
5. Check `openclaw.json` file updated in instance dataDir

- [ ] **Step 4: Manual test - Model config**

1. Click "模型" tab
2. Enter primary model
3. Add a fallback model
4. Click save
5. Verify success message appears

- [ ] **Step 5: Regression test - Basic config still works**

1. Click "基础" tab
2. Modify provider or model
3. Click save
4. Verify container restarts (as before)

- [ ] **Step 6: Regression test - Instance operations**

Test existing functionality:
1. Start/Stop/Restart instance buttons work
2. Logs button works
3. Delete instance works
4. Panel button opens OpenClaw UI

---

## Success Criteria Checklist

- [ ] Tabs component exists and works
- [ ] API routes read/write openclaw.json correctly
- [ ] Channel config form saves Feishu settings
- [ ] Model config form saves primary + fallbacks
- [ ] Hot-reload works (no restart needed)
- [ ] Basic config still triggers container restart
- [ ] All existing instance operations unaffected
- [ ] All tests pass
- [ ] Build succeeds