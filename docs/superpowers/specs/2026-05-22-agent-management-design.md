# Agent Management Feature Design

**Date:** 2026-05-22
**Branch:** worktree-agent-management

## Summary

Enable per-instance agent configuration in OpenClaw Colony. Each OpenClaw instance can define multiple named agents with distinct models, tools, and channel bindings. Colony provides a UI to edit the `agents.list` and `bindings` arrays in `openclaw.json`, using OpenClaw's native schema for full feature compatibility.

## Requirements

- Define multiple named agents per OpenClaw instance
- Each agent has: `name`, `model`, `tools`, `description` (identity), `channel` (bindings)
- Full OpenClaw native schema compatibility
- Hot-reload without instance restart

## Data Model

### OpenClaw Config Schema

Agent config lives in instance's `{dataDir}/conf/openclaw.json`:

```json5
{
  agents: {
    list: [
      {
        id: "translator",
        default: true,
        identity: { name: "翻译助手", theme: "专业翻译", emoji: "🌐" },
        model: { primary: "anthropic/claude-sonnet-4-6", fallbacks: [] },
        tools: { profile: "minimal", allow: ["web_search"], deny: ["exec"] },
      },
      {
        id: "coder",
        identity: { name: "代码助手", emoji: "💻" },
        model: { primary: "anthropic/claude-opus-4-7" },
        tools: { profile: "coding" },
      },
    ],
  },
  bindings: [
    { agentId: "translator", match: { channel: "feishu", peer: "oc_xxx" } },
    { agentId: "coder", match: { channel: "feishu", guildId: "group_123" } },
  ],
}
```

### Agent Properties

| Property | Type | Description |
|----------|------|-------------|
| `id` | string | Required stable identifier, unique |
| `default` | boolean | Marks default agent (first with `true` wins) |
| `identity.name` | string | Display name |
| `identity.theme` | string | Personality theme |
| `identity.emoji` | string | Single emoji |
| `identity.avatar` | string | Avatar path/URL |
| `model` | string or object | `primary` + optional `fallbacks` array |
| `tools.profile` | string | Base profile: minimal/coding/messaging/full |
| `tools.allow` | array | Additional tools/groups to allow |
| `tools.deny` | array | Tools/groups to deny (wins over allow) |

### Binding Properties

| Property | Type | Description |
|----------|------|-------------|
| `agentId` | string | References agent.id |
| `match.channel` | string | Channel type (e.g., "feishu") |
| `match.peer` | string | Direct message peer ID |
| `match.guildId` | string | Group/guild ID |
| `match.accountId` | string | Account ID (exact or "*" wildcard) |
| `match.teamId` | string | Team ID |

Match precedence: `peer` > `guildId` > `teamId` > `accountId` (exact) > `accountId: "*"`

## UI Components

### Tab Structure

Edit `EditConfigSheet` tabs: `Basic | Channel | Agents`

Remove `Model` tab (replaced by agent-level model config).

### New Components

| Component | File | Purpose |
|-----------|------|---------|
| `AgentList` | `components/agent-list.tsx` | List agents with actions: add/edit/delete/set-default |
| `AgentEditForm` | `components/agent-edit-form.tsx` | Form for single agent config |
| `AgentBindingsForm` | `components/agent-bindings-form.tsx` | Edit bindings: assign agents to channels |
| `ToolConfigForm` | `components/tool-config-form.tsx` | Reusable: profile + allow/deny with autocomplete |

### Agent Edit Form Fields

| Field | Input Type | Notes |
|-------|------------|-------|
| `id` | text | Required, auto-generate optional |
| `name` | text | identity.name |
| `emoji` | text | identity.emoji |
| `model.primary` | text + autocomplete | Provider/model format |
| `model.fallbacks` | list + add/remove | Fallback models |
| `tools.profile` | select | minimal/coding/messaging/full |
| `tools.allow` | list + autocomplete | Tool names/groups |
| `tools.deny` | list + autocomplete | Tool names/groups |

### Tool Autocomplete Options

Tool groups: `group:runtime`, `group:fs`, `group:sessions`, `group:web`, `group:memory`

Individual tools: `exec`, `process`, `read`, `write`, `edit`, `web_search`, `web_fetch`, `browser`, `image`, `tts`, `sessions_list`, etc.

## API Changes

### Endpoint

`PUT /api/instances/[id]/openclaw-config`

### Request Schema Extension

```typescript
// lib/validations.ts
const agentSchema = z.object({
  id: z.string().min(1).regex(/^[\w-]+$/),
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
});

const bindingSchema = z.object({
  agentId: z.string(),
  match: z.object({
    channel: z.string().optional(),
    peer: z.string().optional(),
    guildId: z.string().optional(),
    accountId: z.string().optional(),
    teamId: z.string().optional(),
  }),
});

openclawConfigUpdateSchema.extend({
  agents: z.object({
    list: z.array(agentSchema).optional(),
  }).optional(),
  bindings: z.array(bindingSchema).optional(),
});
```

### lib/openclaw-config.ts Helpers

```typescript
export interface AgentConfig {
  id: string;
  default?: boolean;
  identity?: { name?: string; theme?: string; emoji?: string; avatar?: string };
  model?: string | { primary: string; fallbacks?: string[] };
  tools?: { profile?: string; allow?: string[]; deny?: string[] };
}

export interface BindingConfig {
  agentId: string;
  match: { channel?: string; peer?: string; guildId?: string; accountId?: string; teamId?: string };
}

export function mergeAgentsConfig(
  existing: OpenClawConfig,
  agents?: { list?: AgentConfig[] },
  bindings?: BindingConfig[]
): OpenClawConfig;
```

## Validation

| Rule | Field |
|------|-------|
| Agent id required, unique | `agents.list[*].id` |
| Only one default agent | `agents.list[*].default` |
| Model primary required if model object | `agents.list[*].model.primary` |
| Binding agentId must exist | `bindings[*].agentId` |

## Error Handling

```json
{ "error": "Agent id must be unique", "field": "agents.list[1].id" }
{ "error": "Only one agent can be default", "field": "agents.list[2].default" }
{ "error": "Binding references unknown agent", "field": "bindings[0].agentId" }
```

## Hot-Reload

OpenClaw automatically reloads config when file changes (`gateway.reload.mode: "file"`). No instance restart required.

## Out of Scope

- Agent workspace configuration (per-agent directories)
- Agent sandbox settings
- Per-provider tool restrictions (`tools.byProvider`)
- Per-sender tool restrictions (`tools.toolsBySender`)
- Identity avatar upload (just path/URL input)

## Files to Modify/Create

| File | Action |
|------|--------|
| `lib/openclaw-config.ts` | Extend interfaces, add mergeAgentsConfig |
| `lib/validations.ts` | Add agent/binding schemas |
| `app/api/instances/[id]/openclaw-config/route.ts` | Handle agents + bindings in PUT |
| `components/edit-config-sheet.tsx` | Replace Model tab with Agents tab |
| `components/agent-list.tsx` | Create |
| `components/agent-edit-form.tsx` | Create |
| `components/agent-bindings-form.tsx` | Create |
| `components/tool-config-form.tsx` | Create |