# Gateway Token Feature Design

**Date**: 2026-05-21
**Status**: Draft

## Problem

OpenClaw containers require authentication (`OPENCLAW_GATEWAY_TOKEN` or `OPENCLAW_GATEWAY_PASSWORD`) to start the gateway. Currently, Colony creates instances without passing any token, causing containers to immediately crash with:

```
Refusing to bind gateway to auto without auth.
Set OPENCLAW_GATEWAY_TOKEN or OPENCLAW_GATEWAY_PASSWORD
```

## Solution

Add gateway token support to instance creation and configuration. The system auto-generates tokens by default, but users can view and customize them.

## Requirements Summary

| Requirement | Decision |
|-------------|----------|
| Token source | System auto-generates by default |
| Storage | Plaintext in database (not encrypted) |
| Visibility | User can view in config editor |
| Modification | User can customize; triggers container restart |

## Technical Design

### 1. Database Schema

Add new field to `Instance` model:

```prisma
model Instance {
  // ... existing fields
  gatewayToken  String  @default("")  // Empty = auto-generate
}
```

Migration required: `prisma migrate dev --name add_gateway_token`

### 2. Backend Changes

#### lib/docker.ts - Container Creation

Modify `createOpenClawContainer` to pass gateway token:

```typescript
export interface CreateContainerOptions {
  // ... existing fields
  gatewayToken: string  // Required: the actual token to use
}

export async function createOpenClawContainer(opts: CreateContainerOptions) {
  const env: string[] = [
    // ... existing env vars
    `OPENCLAW_GATEWAY_TOKEN=${opts.gatewayToken}`,
  ]
  // ... rest of container creation
}
```

#### lib/validations.ts - Schema Update

Add optional `gatewayToken` to `createInstanceSchema`:

```typescript
export const createInstanceSchema = z.object({
  // ... existing fields
  gatewayToken: z.string().min(8).max(64).optional(),
})
```

Add optional `gatewayToken` to `updateConfigSchema`:

```typescript
export const updateConfigSchema = z.object({
  // ... existing fields
  gatewayToken: z.string().min(8).max(64).optional(),
})
```

#### app/api/instances/route.ts - POST Handler

```typescript
// Generate token if not provided
const gatewayToken = data.gatewayToken || generateRandomToken(32)

const instance = await prisma.instance.create({
  data: {
    // ... existing fields
    gatewayToken,
  },
})

// Pass to container creation
const container = await createOpenClawContainer({
  ...data,
  gatewayToken,
})
```

#### app/api/instances/[id]/config/route.ts - PUT Handler

When `gatewayToken` is in update payload:
- Update database
- Recreate container with new token (same as current apiKey/provider update behavior)

#### app/api/instances/[id]/route.ts - GET Handler

Return `gatewayToken` in response (user can view).

### 3. Helper Function

Add token generator in `lib/utils.ts` or inline:

```typescript
function generateRandomToken(length: number): string {
  return crypto.randomBytes(length).toString('hex').slice(0, length)
}
```

### 4. Frontend Changes

#### app/(dashboard)/instances/new/page.tsx

Add gateway token input in advanced options section:

```tsx
<div className="space-y-1">
  <Label htmlFor="gatewayToken">Gateway Token（留空自动生成）</Label>
  <Input
    id="gatewayToken"
    value={form.gatewayToken}
    onChange={e => set('gatewayToken', e.target.value)}
    placeholder="系统自动生成 32 位随机 token"
  />
</div>
```

#### components/edit-config-sheet.tsx

Add gateway token field in basic config tab:

```tsx
<div className="space-y-1">
  <Label>Gateway Token</Label>
  <Input
    type="text"
    value={basicForm.gatewayToken}
    onChange={e => setBasicForm(f => ({ ...f, gatewayToken: e.target.value }))}
  />
</div>
```

Fetch current token in useEffect:
```typescript
gatewayToken: data.gatewayToken ?? '',
```

### 5. Token in Existing Instances

For existing instances without `gatewayToken` (empty string):
- On next config update or container restart, auto-generate and persist token
- No immediate migration action required (lazy migration)

When basic config is saved (provider, model, apiKey, gatewayToken changes):
- Container is destroyed and recreated
- New token (if modified) is passed via environment variable
- All existing OpenClaw config files preserved via volume mounts

## Implementation Order

1. Database migration (add `gatewayToken` field)
2. `lib/docker.ts` - Add token to container env
3. `lib/validations.ts` - Add schema fields
4. `app/api/instances/route.ts` - Handle token in POST
5. `app/api/instances/[id]/route.ts` - Return token in GET
6. `app/api/instances/[id]/config/route.ts` - Handle token in PUT
7. `app/(dashboard)/instances/new/page.tsx` - Add input field
8. `components/edit-config-sheet.tsx` - Add input field
9. Tests

## Testing Plan

1. Create instance without gatewayToken → auto-generated, container starts successfully
2. Create instance with custom gatewayToken → uses provided token, container starts
3. Edit config, view current token → displays correctly
4. Edit config, modify token → container restarts with new token
5. Access OpenClaw panel via `/api/instances/[id]/token` → auth works with stored token