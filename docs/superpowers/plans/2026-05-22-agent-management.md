# Agent Management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enable per-instance agent configuration with multiple named agents, each having distinct model, tools, and channel bindings.

**Architecture:** Extend OpenClaw config schema with `agents.list` and `bindings` arrays. Colony UI edits these in `openclaw.json`, OpenClaw hot-reloads automatically.

**Tech Stack:** Next.js 16, React 19, Zod 4, TypeScript, Base UI components

---

## File Structure

| File | Action | Responsibility |
|------|--------|----------------|
| `lib/openclaw-config.ts` | Modify | Add AgentConfig/BindingConfig interfaces, mergeAgentsConfig helper |
| `lib/validations.ts` | Modify | Add agentSchema, bindingSchema, extend openclawConfigUpdateSchema |
| `app/api/instances/[id]/openclaw-config/route.ts` | Modify | Handle agents + bindings in PUT, validation |
| `components/tool-config-form.tsx` | Create | Reusable form for tools.profile + allow/deny lists |
| `components/agent-edit-form.tsx` | Create | Form for single agent (id, name, emoji, model, tools) |
| `components/agent-bindings-form.tsx` | Create | Form for bindings (assign agents to channels) |
| `components/agent-list.tsx` | Create | List agents with add/edit/delete/set-default |
| `components/edit-config-sheet.tsx` | Modify | Replace Model tab with Agents tab |

---

### Task 1: Extend lib/openclaw-config.ts

**Files:**
- Modify: `lib/openclaw-config.ts`

- [ ] **Step 1: Add AgentConfig and BindingConfig interfaces**

Add after the existing `ModelConfig` interface (around line 17):

```typescript
export interface AgentIdentity {
  name?: string
  theme?: string
  emoji?: string
  avatar?: string
}

export interface AgentTools {
  profile?: 'minimal' | 'coding' | 'messaging' | 'full'
  allow?: string[]
  deny?: string[]
}

export interface AgentConfig {
  id: string
  default?: boolean
  identity?: AgentIdentity
  model?: string | ModelConfig
  tools?: AgentTools
}

export interface BindingMatch {
  channel?: string
  peer?: string
  guildId?: string
  accountId?: string
  teamId?: string
}

export interface BindingConfig {
  agentId: string
  match: BindingMatch
}

export interface AgentsConfig {
  list?: AgentConfig[]
}
```

- [ ] **Step 2: Add mergeAgentsConfig function**

Add after `mergeModelConfig` function (around line 150):

```typescript
export function mergeAgentsConfig(
  existing: OpenClawConfig,
  agents?: AgentsConfig,
  bindings?: BindingConfig[]
): OpenClawConfig {
  const result = { ...existing }
  
  if (agents?.list) {
    result.agents = {
      ...existing.agents,
      list: agents.list,
    }
  }
  
  if (bindings) {
    result.bindings = bindings
  }
  
  return result
}
```

- [ ] **Step 3: Update OpenClawConfig interface**

Update the `OpenClawConfig` interface (around line 19) to include agents.list and bindings:

```typescript
export interface OpenClawConfig {
  channels?: {
    feishu?: FeishuConfig
  }
  agents?: {
    defaults?: {
      model?: ModelConfig
    }
    list?: AgentConfig[]
  }
  bindings?: BindingConfig[]
  gateway?: {
    reload?: {
      mode?: string
    }
  }
}
```

- [ ] **Step 4: Update DEFAULT_CONFIG**

Update the DEFAULT_CONFIG (around line 35) to include agents.list:

```typescript
const DEFAULT_CONFIG: OpenClawConfig = {
  channels: {},
  agents: {
    defaults: {
      model: {
        primary: '',
        fallbacks: [],
      },
    },
    list: [],
  },
  bindings: [],
}
```

- [ ] **Step 5: Update readOpenClawConfig merge**

Update the merge in `readOpenClawConfig` (around line 59) to include bindings:

```typescript
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
      bindings: parsed.bindings ?? DEFAULT_CONFIG.bindings,
    }
  } catch {
    return DEFAULT_CONFIG
  }
}
```

- [ ] **Step 6: Commit**

```bash
git add lib/openclaw-config.ts
git commit -m "feat: add AgentConfig/BindingConfig interfaces and mergeAgentsConfig helper

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

### Task 2: Extend lib/validations.ts

**Files:**
- Modify: `lib/validations.ts`

- [ ] **Step 1: Add agentSchema**

Add after `modelConfigSchema` (around line 71):

```typescript
export const agentSchema = z.object({
  id: z.string().min(1, 'Agent ID is required').regex(/^[\w-]+$/, 'Agent ID must be alphanumeric with dashes'),
  default: z.boolean().optional(),
  identity: z.object({
    name: z.string().optional(),
    theme: z.string().optional(),
    emoji: z.string().optional(),
    avatar: z.string().optional(),
  }).optional(),
  model: z.union([
    z.string(),
    z.object({
      primary: z.string(),
      fallbacks: z.array(z.string()).optional(),
    }),
  ]).optional(),
  tools: z.object({
    profile: z.enum(['minimal', 'coding', 'messaging', 'full']).optional(),
    allow: z.array(z.string()).optional(),
    deny: z.array(z.string()).optional(),
  }).optional(),
})

export type AgentInput = z.infer<typeof agentSchema>
```

- [ ] **Step 2: Add bindingSchema**

Add after `agentSchema`:

```typescript
export const bindingSchema = z.object({
  agentId: z.string().min(1, 'Agent ID is required'),
  match: z.object({
    channel: z.string().optional(),
    peer: z.string().optional(),
    guildId: z.string().optional(),
    accountId: z.string().optional(),
    teamId: z.string().optional(),
  }),
})

export type BindingInput = z.infer<typeof bindingSchema>
```

- [ ] **Step 3: Extend openclawConfigUpdateSchema**

Replace the existing `openclawConfigUpdateSchema` (around line 73) with:

```typescript
export const openclawConfigUpdateSchema = z.object({
  channels: z.object({
    feishu: feishuConfigSchema.optional(),
  }).optional(),
  agents: z.object({
    defaults: z.object({
      model: modelConfigSchema.optional(),
    }).optional(),
    list: z.array(agentSchema).optional(),
  }).optional(),
  bindings: z.array(bindingSchema).optional(),
})

export type OpenclawConfigUpdateInput = z.infer<typeof openclawConfigUpdateSchema>
```

- [ ] **Step 4: Commit**

```bash
git add lib/validations.ts
git commit -m "feat: add agentSchema and bindingSchema validation

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

### Task 3: Update API route for agents + bindings

**Files:**
- Modify: `app/api/instances/[id]/openclaw-config/route.ts`

- [ ] **Step 1: Update imports**

Update the imports (around line 5) to include the new types:

```typescript
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
```

- [ ] **Step 2: Update GET response**

Update the GET response (around line 27) to include agents.list and bindings:

```typescript
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
```

- [ ] **Step 3: Add validation helper for agents**

Add a validation function before the PUT handler:

```typescript
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
```

- [ ] **Step 4: Update PUT handler**

Replace the existing PUT handler with:

```typescript
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
```

- [ ] **Step 5: Commit**

```bash
git add app/api/instances/[id]/openclaw-config/route.ts
git commit -m "feat: handle agents.list and bindings in openclaw-config API

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

### Task 4: Create ToolConfigForm component

**Files:**
- Create: `components/tool-config-form.tsx`

- [ ] **Step 1: Create the component file**

Create `components/tool-config-form.tsx` with:

```typescript
'use client'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Plus, X } from 'lucide-react'

interface ToolConfig {
  profile?: 'minimal' | 'coding' | 'messaging' | 'full'
  allow?: string[]
  deny?: string[]
}

interface Props {
  value: ToolConfig
  onChange: (config: ToolConfig) => void
}

const TOOL_PROFILE_OPTIONS = [
  { value: 'minimal', label: 'Minimal (session_status only)' },
  { value: 'coding', label: 'Coding (fs, runtime, web, sessions)' },
  { value: 'messaging', label: 'Messaging (messaging + sessions)' },
  { value: 'full', label: 'Full (no restriction)' },
]

const TOOL_HINTS = [
  'group:runtime', 'group:fs', 'group:sessions', 'group:web', 'group:memory',
  'exec', 'process', 'code_execution',
  'read', 'write', 'edit', 'apply_patch',
  'web_search', 'web_fetch', 'x_search',
  'browser', 'image', 'image_generate', 'tts',
  'sessions_list', 'sessions_history',
]

export function ToolConfigForm({ value, onChange }: Props) {
  const [newAllow, setNewAllow] = useState('')
  const [newDeny, setNewDeny] = useState('')

  function update<K extends keyof ToolConfig>(key: K, val: ToolConfig[K]) {
    onChange({ ...value, [key]: val })
  }

  function addAllow() {
    if (newAllow.trim()) {
      update('allow', [...(value.allow ?? []), newAllow.trim()])
      setNewAllow('')
    }
  }

  function removeAllow(index: number) {
    update('allow', value.allow?.filter((_, i) => i !== index) ?? [])
  }

  function addDeny() {
    if (newDeny.trim()) {
      update('deny', [...(value.deny ?? []), newDeny.trim()])
      setNewDeny('')
    }
  }

  function removeDeny(index: number) {
    update('deny', value.deny?.filter((_, i) => i !== index) ?? [])
  }

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <Label>工具权限级别</Label>
        <Select
          value={value.profile ?? 'coding'}
          onValueChange={v => update('profile', v as ToolConfig['profile'])}
        >
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {TOOL_PROFILE_OPTIONS.map(opt => (
              <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-gray-500">Profile 作为基础权限，allow/deny 可叠加调整</p>
      </div>

      <div className="space-y-1">
        <Label>额外允许的工具</Label>
        <div className="flex gap-2">
          <Input
            value={newAllow}
            onChange={e => setNewAllow(e.target.value)}
            placeholder="工具名或组名"
            list="tool-hints"
          />
          <Button size="sm" variant="outline" onClick={addAllow}>
            <Plus className="w-3 h-3" />
          </Button>
        </div>
        <datalist id="tool-hints">
          {TOOL_HINTS.map(h => <option key={h} value={h} />)}
        </datalist>
        {value.allow && value.allow.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {value.allow.map((tool, i) => (
              <span
                key={i}
                className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-100 text-green-700 rounded text-xs"
              >
                {tool}
                <X
                  className="w-3 h-3 cursor-pointer hover:text-red-500"
                  onClick={() => removeAllow(i)}
                />
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="space-y-1">
        <Label>禁止的工具</Label>
        <p className="text-xs text-gray-500">deny 优先级高于 allow，可禁用特定工具</p>
        <div className="flex gap-2">
          <Input
            value={newDeny}
            onChange={e => setNewDeny(e.target.value)}
            placeholder="工具名或组名"
            list="tool-hints"
          />
          <Button size="sm" variant="outline" onClick={addDeny}>
            <Plus className="w-3 h-3" />
          </Button>
        </div>
        {value.deny && value.deny.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {value.deny.map((tool, i) => (
              <span
                key={i}
                className="inline-flex items-center gap-1 px-2 py-0.5 bg-red-100 text-red-700 rounded text-xs"
              >
                {tool}
                <X
                  className="w-3 h-3 cursor-pointer"
                  onClick={() => removeDeny(i)}
                />
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add components/tool-config-form.tsx
git commit -m "feat: add ToolConfigForm component for agent tools config

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

### Task 5: Create AgentEditForm component

**Files:**
- Create: `components/agent-edit-form.tsx`

- [ ] **Step 1: Create the component file**

Create `components/agent-edit-form.tsx` with:

```typescript
'use client'
import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { ToolConfigForm } from '@/components/tool-config-form'
import { Plus, X, Pencil, Trash2 } from 'lucide-react'

interface AgentConfig {
  id: string
  default?: boolean
  identity?: { name?: string; theme?: string; emoji?: string; avatar?: string }
  model?: { primary: string; fallbacks?: string[] }
  tools?: { profile?: string; allow?: string[]; deny?: string[] }
}

interface Props {
  instanceId: string
  initialAgent: AgentConfig | null
  existingIds: string[]
  onSave: (agent: AgentConfig) => void
  onCancel: () => void
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

function generateId(): string {
  return 'agent-' + Math.random().toString(36).substring(2, 8)
}

export function AgentEditForm({ instanceId, initialAgent, existingIds, onSave, onCancel }: Props) {
  const [agent, setAgent] = useState<AgentConfig>(
    initialAgent ?? { id: generateId(), default: false, identity: {}, model: { primary: '' }, tools: {} }
  )
  const [newFallback, setNewFallback] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const isEdit = initialAgent !== null

  function update<K extends keyof AgentConfig>(key: K, value: AgentConfig[K]) {
    setAgent(a => ({ ...a, [key]: value }))
  }

  function updateIdentity<K extends keyof NonNullable<AgentConfig['identity']>>(key: K, value: string) {
    setAgent(a => ({
      ...a,
      identity: { ...a.identity, [key]: value },
    }))
  }

  function addFallback() {
    if (newFallback.trim()) {
      const fallbacks = agent.model?.fallbacks ?? []
      update('model', { ...agent.model!, fallbacks: [...fallbacks, newFallback.trim()] })
      setNewFallback('')
    }
  }

  function removeFallback(index: number) {
    const fallbacks = agent.model?.fallbacks ?? []
    update('model', { ...agent.model!, fallbacks: fallbacks.filter((_, i) => i !== index) })
  }

  function handleSave() {
    setError('')
    
    if (!agent.id) {
      setError('Agent ID 不能为空')
      return
    }
    
    if (!isEdit && existingIds.includes(agent.id)) {
      setError('Agent ID 已存在')
      return
    }
    
    if (!agent.model?.primary) {
      setError('主模型不能为空')
      return
    }
    
    setSaving(true)
    onSave(agent)
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">{isEdit ? '编辑 Agent' : '新建 Agent'}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1">
            <Label htmlFor="id">Agent ID *</Label>
            <Input
              id="id"
              value={agent.id}
              onChange={e => update('id', e.target.value)}
              placeholder="唯一标识符"
              disabled={isEdit}
            />
            <p className="text-xs text-gray-500">创建后不可修改，建议使用英文标识</p>
          </div>

          <div className="flex items-center gap-2">
            <Checkbox
              id="default"
              checked={agent.default ?? false}
              onCheckedChange={v => update('default', v === true)}
            />
            <Label htmlFor="default">设为默认 Agent</Label>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label htmlFor="name">显示名称</Label>
              <Input
                id="name"
                value={agent.identity?.name ?? ''}
                onChange={e => updateIdentity('name', e.target.value)}
                placeholder="如：翻译助手"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="emoji">Emoji</Label>
              <Input
                id="emoji"
                value={agent.identity?.emoji ?? ''}
                onChange={e => updateIdentity('emoji', e.target.value)}
                placeholder="如：🌐"
              />
            </div>
          </div>

          <div className="space-y-1">
            <Label htmlFor="primary">主模型 *</Label>
            <Input
              id="primary"
              value={agent.model?.primary ?? ''}
              onChange={e => update('model', { ...agent.model!, primary: e.target.value })}
              placeholder="provider/model-name"
              list="model-hints"
            />
            <datalist id="model-hints">
              {MODEL_HINTS.map(h => <option key={h} value={h} />)}
            </datalist>
          </div>

          <div className="space-y-1">
            <Label>Fallback 模型</Label>
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
            {agent.model?.fallbacks && agent.model.fallbacks.length > 0 && (
              <div className="space-y-1 mt-2">
                {agent.model.fallbacks.map((model, i) => (
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

          <ToolConfigForm
            value={agent.tools ?? {}}
            onChange={tools => update('tools', tools)}
          />
        </CardContent>
      </Card>

      {error && <p className="text-sm text-red-500">{error}</p>}
      <div className="flex gap-2">
        <Button variant="outline" onClick={onCancel} className="flex-1">
          取消
        </Button>
        <Button onClick={handleSave} disabled={saving} className="flex-1">
          {saving ? '保存中...' : '保存'}
        </Button>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add components/agent-edit-form.tsx
git commit -m "feat: add AgentEditForm component for agent configuration

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

### Task 6: Create AgentBindingsForm component

**Files:**
- Create: `components/agent-bindings-form.tsx`

- [ ] **Step 1: Create the component file**

Create `components/agent-bindings-form.tsx` with:

```typescript
'use client'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Plus, X } from 'lucide-react'

interface BindingConfig {
  agentId: string
  match: {
    channel?: string
    peer?: string
    guildId?: string
    accountId?: string
    teamId?: string
  }
}

interface Props {
  value: BindingConfig[]
  onChange: (bindings: BindingConfig[]) => void
  agentOptions: { id: string; name?: string }[]
}

const CHANNEL_OPTIONS = [
  { value: 'feishu', label: '飞书' },
  { value: 'discord', label: 'Discord' },
  { value: 'telegram', label: 'Telegram' },
  { value: 'whatsapp', label: 'WhatsApp' },
]

export function AgentBindingsForm({ value, onChange, agentOptions }: Props) {
  const [newBinding, setNewBinding] = useState<BindingConfig>({
    agentId: '',
    match: { channel: 'feishu' },
  })

  function addBinding() {
    if (!newBinding.agentId) return
    onChange([...value, newBinding])
    setNewBinding({ agentId: '', match: { channel: 'feishu' } })
  }

  function removeBinding(index: number) {
    onChange(value.filter((_, i) => i !== index))
  }

  function updateNewBinding<K extends keyof BindingConfig>(key: K, val: BindingConfig[K]) {
    setNewBinding(b => ({ ...b, [key]: val }))
  }

  function updateNewMatch<K extends keyof BindingConfig['match']>(key: K, val: string) {
    setNewBinding(b => ({
      ...b,
      match: { ...b.match, [key]: val },
    }))
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">渠道绑定</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-xs text-gray-500">
            将特定渠道（群聊/私聊）绑定到 Agent。匹配优先级：peer > guildId > teamId > accountId
          </p>

          {value.length > 0 && (
            <div className="space-y-2">
              {value.map((binding, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between p-2 bg-gray-50 rounded"
                >
                  <div className="text-sm">
                    <span className="font-medium">{binding.agentId}</span>
                    <span className="text-gray-500 mx-1">→</span>
                    {binding.match.channel && <span>{binding.match.channel}</span>}
                    {binding.match.peer && <span className="text-blue-600"> (peer: {binding.match.peer})</span>}
                    {binding.match.guildId && <span className="text-blue-600"> (group: {binding.match.guildId})</span>}
                    {binding.match.accountId && <span className="text-blue-600"> (account: {binding.match.accountId})</span>}
                  </div>
                  <X
                    className="w-4 h-4 cursor-pointer hover:text-red-500"
                    onClick={() => removeBinding(i)}
                  />
                </div>
              ))}
            </div>
          )}

          <div className="space-y-2 border-t pt-4">
            <Label>添加新绑定</Label>
            
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-xs">Agent</Label>
                <Select
                  value={newBinding.agentId}
                  onValueChange={v => updateNewBinding('agentId', v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="选择 Agent" />
                  </SelectTrigger>
                  <SelectContent>
                    {agentOptions.map(a => (
                      <SelectItem key={a.id} value={a.id}>
                        {a.name ?? a.id}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-1">
                <Label className="text-xs">渠道类型</Label>
                <Select
                  value={newBinding.match.channel ?? 'feishu'}
                  onValueChange={v => updateNewMatch('channel', v)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CHANNEL_OPTIONS.map(c => (
                      <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <details className="text-sm">
              <summary className="cursor-pointer text-gray-500 hover:text-gray-700">匹配条件</summary>
              <div className="mt-2 space-y-2 pl-2 border-l-2 border-gray-100">
                <div className="space-y-1">
                  <Label className="text-xs">Peer ID（私聊）</Label>
                  <Input
                    value={newBinding.match.peer ?? ''}
                    onChange={e => updateNewMatch('peer', e.target.value)}
                    placeholder="如：oc_xxx"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Guild ID（群聊）</Label>
                  <Input
                    value={newBinding.match.guildId ?? ''}
                    onChange={e => updateNewMatch('guildId', e.target.value)}
                    placeholder="如：group_xxx"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Account ID</Label>
                  <Input
                    value={newBinding.match.accountId ?? ''}
                    onChange={e => updateNewMatch('accountId', e.target.value)}
                    placeholder="如：account_xxx 或 *"
                  />
                </div>
              </div>
            </details>

            <Button size="sm" variant="outline" onClick={addBinding} disabled={!newBinding.agentId}>
              <Plus className="w-3 h-3 mr-1" />添加绑定
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add components/agent-bindings-form.tsx
git commit -m "feat: add AgentBindingsForm component for channel bindings

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

### Task 7: Create AgentList component

**Files:**
- Create: `components/agent-list.tsx`

- [ ] **Step 1: Create the component file**

Create `components/agent-list.tsx` with:

```typescript
'use client'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { AgentEditForm } from '@/components/agent-edit-form'
import { AgentBindingsForm } from '@/components/agent-bindings-form'
import { Plus, Pencil, Trash2, Star, Link } from 'lucide-react'

interface AgentConfig {
  id: string
  default?: boolean
  identity?: { name?: string; theme?: string; emoji?: string; avatar?: string }
  model?: { primary: string; fallbacks?: string[] }
  tools?: { profile?: string; allow?: string[]; deny?: string[] }
}

interface BindingConfig {
  agentId: string
  match: { channel?: string; peer?: string; guildId?: string; accountId?: string; teamId?: string }
}

interface Props {
  instanceId: string
  agents: AgentConfig[]
  bindings: BindingConfig[]
  onSaved: () => void
}

export function AgentList({ instanceId, agents, bindings, onSaved }: Props) {
  const [editAgent, setEditAgent] = useState<AgentConfig | null>(null)
  const [showAdd, setShowAdd] = useState(false)
  const [showBindings, setShowBindings] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [localBindings, setLocalBindings] = useState<BindingConfig[]>(bindings)

  async function saveAgents(newAgents: AgentConfig[]) {
    setSaving(true)
    setError('')
    
    const res = await fetch(`/api/instances/${instanceId}/openclaw-config`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ agents: { list: newAgents } }),
    })
    
    if (res.ok) {
      onSaved()
      setEditAgent(null)
      setShowAdd(false)
    } else {
      const data = await res.json()
      setError(typeof data.error === 'string' ? data.error : '保存失败')
    }
    setSaving(false)
  }

  async function saveBindings() {
    setSaving(true)
    setError('')
    
    const res = await fetch(`/api/instances/${instanceId}/openclaw-config`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bindings: localBindings }),
    })
    
    if (res.ok) {
      onSaved()
      setShowBindings(false)
    } else {
      const data = await res.json()
      setError(typeof data.error === 'string' ? data.error : '保存失败')
    }
    setSaving(false)
  }

  function handleAddAgent(agent: AgentConfig) {
    saveAgents([...agents, agent])
  }

  function handleEditAgent(agent: AgentConfig) {
    saveAgents(agents.map(a => a.id === agent.id ? agent : a))
  }

  function handleDeleteAgent(id: string) {
    saveAgents(agents.filter(a => a.id !== id))
  }

  function handleSetDefault(id: string) {
    saveAgents(agents.map(a => ({ ...a, default: a.id === id })))
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center justify-between">
            Agent 列表
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => setShowBindings(true)}>
                <Link className="w-3 h-3 mr-1" />绑定
              </Button>
              <Button size="sm" onClick={() => setShowAdd(true)}>
                <Plus className="w-3 h-3 mr-1" />新建
              </Button>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {agents.length === 0 ? (
            <p className="text-center py-4 text-gray-400">暂无 Agent，点击新建添加</p>
          ) : (
            <div className="space-y-2">
              {agents.map(agent => (
                <div
                  key={agent.id}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded"
                >
                  <div className="flex items-center gap-2">
                    {agent.identity?.emoji && <span className="text-lg">{agent.identity.emoji}</span>}
                    <div>
                      <div className="font-medium">
                        {agent.identity?.name ?? agent.id}
                        {agent.default && <Star className="w-3 h-3 text-yellow-500 ml-1 inline" />}
                      </div>
                      <div className="text-xs text-gray-500">{agent.model?.primary}</div>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    {!agent.default && (
                      <Button size="sm" variant="ghost" onClick={() => handleSetDefault(agent.id)}>
                        <Star className="w-3 h-3" />
                      </Button>
                    )}
                    <Button size="sm" variant="ghost" onClick={() => setEditAgent(agent)}>
                      <Pencil className="w-3 h-3" />
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => handleDeleteAgent(agent.id)}>
                      <Trash2 className="w-3 h-3 text-red-500" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {error && <p className="text-sm text-red-500">{error}</p>}
      <p className="text-xs text-gray-500">配置将自动热更新，无需重启实例</p>

      {/* Add Agent Dialog */}
      {showAdd && (
        <Dialog open onOpenChange={() => setShowAdd(false)}>
          <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto">
            <DialogHeader><DialogTitle>新建 Agent</DialogTitle></DialogHeader>
            <AgentEditForm
              instanceId={instanceId}
              initialAgent={null}
              existingIds={agents.map(a => a.id)}
              onSave={handleAddAgent}
              onCancel={() => setShowAdd(false)}
            />
          </DialogContent>
        </Dialog>
      )}

      {/* Edit Agent Dialog */}
      {editAgent && (
        <Dialog open onOpenChange={() => setEditAgent(null)}>
          <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto">
            <DialogHeader><DialogTitle>编辑 Agent</DialogTitle></DialogHeader>
            <AgentEditForm
              instanceId={instanceId}
              initialAgent={editAgent}
              existingIds={agents.map(a => a.id)}
              onSave={handleEditAgent}
              onCancel={() => setEditAgent(null)}
            />
          </DialogContent>
        </Dialog>
      )}

      {/* Bindings Dialog */}
      {showBindings && (
        <Dialog open onOpenChange={() => setShowBindings(false)}>
          <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto">
            <DialogHeader><DialogTitle>渠道绑定</DialogTitle></DialogHeader>
            <AgentBindingsForm
              value={localBindings}
              onChange={setLocalBindings}
              agentOptions={agents.map(a => ({ id: a.id, name: a.identity?.name }))}
            />
            {error && <p className="text-sm text-red-500">{error}</p>}
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setShowBindings(false)} className="flex-1">
                取消
              </Button>
              <Button onClick={saveBindings} disabled={saving} className="flex-1">
                {saving ? '保存中...' : '保存绑定'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add components/agent-list.tsx
git commit -m "feat: add AgentList component with add/edit/delete/bindings

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

### Task 8: Update EditConfigSheet to use AgentList

**Files:**
- Modify: `components/edit-config-sheet.tsx`

- [ ] **Step 1: Update imports**

Replace the imports (line 1-10) with:

```typescript
'use client'
import { useEffect, useState } from 'react'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from '@/components/ui/sheet'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ChannelConfigForm } from '@/components/channel-config-form'
import { AgentList } from '@/components/agent-list'
```

- [ ] **Step 2: Update state interfaces**

Replace the interfaces (line 11-29) with:

```typescript
interface FeishuConfig {
  enabled: boolean
  appId: string
  appSecret: string
  encryptKey: string
  dmPolicy: 'pairing' | 'open' | 'disabled'
  allowFrom: string[]
  requireMention: boolean
}

interface AgentConfig {
  id: string
  default?: boolean
  identity?: { name?: string; theme?: string; emoji?: string; avatar?: string }
  model?: { primary: string; fallbacks?: string[] }
  tools?: { profile?: string; allow?: string[]; deny?: string[] }
}

interface BindingConfig {
  agentId: string
  match: { channel?: string; peer?: string; guildId?: string; accountId?: string; teamId?: string }
}

interface OpenClawConfigData {
  channels: { feishu?: any }
  agents: { 
    defaults?: { model?: { primary: string; fallbacks: string[] } }
    list?: AgentConfig[]
  }
  bindings?: BindingConfig[]
}
```

- [ ] **Step 3: Update state and useEffect**

Replace the state and useEffect (line 38-85) with:

```typescript
export function EditConfigSheet({ instanceId, onClose, onSaved }: Props) {
  const [tab, setTab] = useState('basic')
  const [basicForm, setBasicForm] = useState({
    provider: '', model: '', apiKey: '', baseUrl: '', cpuLimit: '', memoryLimit: '',
    gatewayToken: '',
  })
  const [feishuConfig, setFeishuConfig] = useState<FeishuConfig | null>(null)
  const [agents, setAgents] = useState<AgentConfig[]>([])
  const [bindings, setBindings] = useState<BindingConfig[]>([])
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
        gatewayToken: data.gatewayToken ?? '',
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

      setAgents(data.agents?.list ?? [])
      setBindings(data.bindings ?? [])
    })
  }, [instanceId])
```

- [ ] **Step 4: Update Tabs UI**

Replace the Tabs section (line 120-172) with:

```typescript
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="w-full">
            <TabsTrigger value="basic" className="flex-1">基础</TabsTrigger>
            <TabsTrigger value="channel" className="flex-1">渠道</TabsTrigger>
            <TabsTrigger value="agents" className="flex-1">Agents</TabsTrigger>
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
              { key: 'gatewayToken', label: 'Gateway Token（留空保持不变）', type: 'text' },
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

          <TabsContent value="agents" className="mt-4">
            <AgentList
              instanceId={instanceId}
              agents={agents}
              bindings={bindings}
              onSaved={() => {
                // Refresh config after save
                fetch(`/api/instances/${instanceId}/openclaw-config`).then(r => r.json()).then(data => {
                  setAgents(data.agents?.list ?? [])
                  setBindings(data.bindings ?? [])
                })
                onSaved()
              }}
            />
          </TabsContent>
        </Tabs>
```

- [ ] **Step 5: Commit**

```bash
git add components/edit-config-sheet.tsx
git commit -m "feat: replace Model tab with Agents tab in EditConfigSheet

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

### Task 9: Final integration commit

- [ ] **Step 1: Run build to check for errors**

Run: `npm run build` (in Docker environment)
Expected: Build succeeds

If build fails, fix errors and commit fixes.

- [ ] **Step 2: Squash or create final commit**

```bash
git add -A
git status
git commit -m "feat: add agent management feature for OpenClaw instances

- Add AgentConfig/BindingConfig interfaces and mergeAgentsConfig helper
- Add agent/binding validation schemas
- Handle agents.list and bindings in openclaw-config API
- Create ToolConfigForm, AgentEditForm, AgentBindingsForm, AgentList components
- Replace Model tab with Agents tab in EditConfigSheet

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Self-Review Checklist

**1. Spec coverage:**
- ✅ Task 1-5 covers data model interfaces and helpers
- ✅ Task 2 covers validation schemas
- ✅ Task 3 covers API endpoint updates
- ✅ Task 4-7 covers UI components (ToolConfigForm, AgentEditForm, AgentBindingsForm, AgentList)
- ✅ Task 8 covers EditConfigSheet integration

**2. Placeholder scan:**
- ✅ All code blocks contain complete implementation
- ✅ No TBD/TODO in any task
- ✅ All steps have exact commands and expected output

**3. Type consistency:**
- ✅ AgentConfig interface used consistently across all files
- ✅ BindingConfig interface used consistently
- ✅ ToolConfig matches AgentConfig.tools type
- ✅ Validation schemas match interface definitions