---
name: openclaw-json-visual-config
description: Add visual configuration UI for openclaw.json channels, agents, and models in the instance list page
---

# OpenClaw.json Visual Configuration Design

## Summary

Add visual configuration capability for `openclaw.json` within the existing `EditConfigSheet` component on the instance list page. Support Feishu channel configuration and model primary/fallback settings with hot-reload capability (no container restart required).

## Scope

- **Channels**: Feishu (single account, extensible to multi-account)
- **Agents/Models**: Primary model + fallback chain (extensible to multi-agent and bindings)
- **Excluded**: hooks, cron, session, messages, plugins, discovery, skills (future phases)

## Architecture

### UI Structure

Add Tabs to existing `EditConfigSheet`:

```
EditConfigSheet (400px width)
├── Tab: Basic Config (existing)
│   ├── Provider, Model, API Key, Base URL
│   ├── CPU/Memory limits
│   └── Save button (requires container restart)
│
├── Tab: Channel Config
│   ├── Channel type selector (currently: Feishu only)
│   ├── Feishu form:
│   │   ├── Enable toggle
│   │   ├── App ID (required)
│   │   ├── App Secret (required, password field)
│   │   ├── Encrypt Key (optional)
│   │   ├── DM Policy dropdown: pairing/open/disabled
│   │   └── Advanced (collapsed):
│   │       ├── Allow From (tag input for user IDs)
│   │       └── Group require mention toggle
│   └── Save button (hot-reload, no restart)
│
└── Tab: Model Config
    ├── Primary model (text input)
    ├── Fallback models list (add/remove buttons)
    ├── Placeholder for agents.list/bindings (hidden)
    └── Save button (hot-reload, no restart)
```

### API Design

#### GET `/api/instances/[id]/openclaw-config`

Read instance's `openclaw.json` file and return channels/agents config.

**Response:**
```json
{
  "channels": {
    "feishu": {
      "enabled": true,
      "appId": "...",
      "appSecret": "...",
      "encryptKey": "",
      "dmPolicy": "pairing",
      "allowFrom": [],
      "groups": { "*": { "requireMention": true } }
    }
  },
  "agents": {
    "defaults": {
      "model": {
        "primary": "anthropic/claude-sonnet-4-6",
        "fallbacks": []
      }
    }
  }
}
```

#### PUT `/api/instances/[id]/openclaw-config`

Update `openclaw.json` with partial updates (only passed sections are updated).

**Request body:**
```json
{
  "channels": { "feishu": { ... } },
  "agents": { "defaults": { "model": { ... } } }
}
```

**Behavior:**
1. Read existing `openclaw.json` from instance's dataDir
2. Merge partial updates (preserve other sections like gateway, meta)
3. Write back to file
4. Trigger hot-reload via OpenClaw's reload mechanism
5. Return updated config

### Data Storage

**Location:** Each instance's `dataDir/conf/openclaw.json`

**Host path mapping:**
- Container: `/home/node/.openclaw/openclaw.json`
- Host: `DATA_ROOT/{instanceName}/conf/openclaw.json`

**No database changes** — direct file read/write for simplicity and consistency with OpenClaw's native config.

### Hot-Reload Mechanism

OpenClaw supports config hot-reload via file watch mode. When `gateway.reload.mode` is set to `"file"` (or `"hybrid"`), OpenClaw automatically detects changes to `openclaw.json` and reloads config without restart.

**Implementation:**
- When writing config for first time, ensure `gateway.reload` is configured (may already exist in default config)
- If missing, add: `{ "gateway": { "reload": { "mode": "file" } } }`
- File write triggers automatic reload by OpenClaw gateway
- No explicit API call needed

## Feishu Channel Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `enabled` | boolean | No | Enable/disable channel (default: true if configured) |
| `appId` | string | Yes | Feishu app App ID |
| `appSecret` | string | Yes | Feishu app App Secret |
| `encryptKey` | string | No | Encryption key for message decryption |
| `dmPolicy` | enum | No | DM policy: `pairing` (default), `open`, `disabled` |
| `allowFrom` | string[] | No | Whitelist of allowed user IDs |
| `groups` | object | No | Group config with `requireMention` setting |

**Extensibility:** Data structure uses `accounts` object to support future multi-account:
```json
{
  "feishu": {
    "accounts": {
      "default": { "appId": "...", "appSecret": "..." }
    }
  }
}
```
Current UI writes to `feishu` directly; future multi-account UI will use `accounts` object.

## Model Config Fields

| Field | Type | Description |
|-------|------|-------------|
| `primary` | string | Primary model (format: `provider/model-name`) |
| `fallbacks` | string[] | Fallback models in order |

**Model format examples:**
- `anthropic/claude-opus-4-7`
- `openai/gpt-4o`
- `deepseek/deepseek-chat`
- `ollama/llama3`

**Extensibility:** Current UI only edits `agents.defaults.model`. Data structure preserves `agents.list` and `bindings` for future multi-agent UI.

## Components

### EditConfigSheet (modified)

- Add `TabsList`, `TabsTrigger`, `TabsContent` from shadcn/ui
- State management: track active tab
- Separate save handlers per tab (basic: restart, others: hot-reload)

### ChannelConfigForm (new)

- Channel type selector (extensible dropdown)
- FeishuConfigFields sub-component
- Validation: required fields check before save

### ModelConfigForm (new)

- Primary model input with provider hints
- Fallback list with add/remove buttons
- Drag-to reorder fallbacks (optional enhancement)

## Validation

### Feishu Config

- `appId`: required, non-empty string
- `appSecret`: required, non-empty string
- `encryptKey`: optional string
- `dmPolicy`: one of `pairing`, `open`, `disabled`

### Model Config

- `primary`: required, format `provider/model-name`
- `fallbacks`: array of valid model strings

## Error Handling

- File not found: Return empty default structure for GET
- Invalid JSON: Return 500 with error message
- Permission denied: Return 500 with error message
- Hot-reload failure: Return 200 with warning (config saved but reload pending)

## Testing Requirements

### Unit Tests

- API route tests for GET/PUT `/api/instances/[id]/openclaw-config`
- File read/write mock tests
- Validation schema tests

### Integration Tests

- Full flow: read config → modify → save → verify file updated
- Hot-reload trigger verification

### Regression Tests

- Existing instance operations (start/stop/restart/logs/delete) must work unchanged
- Basic config save (container restart) must work unchanged

## Success Criteria

1. User can configure Feishu channel via UI without editing JSON manually
2. User can set primary model and fallback chain via UI
3. Changes apply immediately without container restart
4. Existing instance operations continue to work
5. Config persists across container restarts

## Implementation Order

1. Add API routes for openclaw-config
2. Create ChannelConfigForm component
3. Create ModelConfigForm component
4. Modify EditConfigSheet to add Tabs
5. Add validation schemas
6. Write unit tests
7. Integration testing
8. Regression testing

## References

- OpenClaw config docs: https://docs.openclaw.ai/gateway/configuration
- Feishu channel docs: https://docs.openclaw.ai/channels/feishu
- Agents config docs: https://docs.openclaw.ai/gateway/config-agents