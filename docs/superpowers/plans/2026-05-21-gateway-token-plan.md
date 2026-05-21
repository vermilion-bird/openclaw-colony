# Gateway Token Feature Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add gateway token support so OpenClaw containers can start successfully with authentication.

**Architecture:** Add `gatewayToken` field to Instance model (plaintext), pass it via `OPENCLAW_GATEWAY_TOKEN` env var to containers. Auto-generate if not provided, allow user customization in UI.

**Tech Stack:** Prisma, Next.js API Routes, Zod validation, Dockerode, React forms

---

## Files to Modify/Create

| File | Purpose |
|------|---------|
| `prisma/schema.prisma` | Add gatewayToken field |
| `lib/docker.ts` | Pass token to container env |
| `lib/validations.ts` | Add gatewayToken to schemas |
| `lib/utils.ts` | Add generateRandomToken helper |
| `app/api/instances/route.ts` | Handle token in POST |
| `app/api/instances/[id]/route.ts` | Return token in GET |
| `app/api/instances/[id]/config/route.ts` | Handle token in PUT |
| `app/(dashboard)/instances/new/page.tsx` | Add token input field |
| `components/edit-config-sheet.tsx` | Add token to basic config |
| `tests/api/instances.test.ts` | Add token tests |

---

### Task 1: Database Migration

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Add gatewayToken field to Instance model**

In `prisma/schema.prisma`, add the field after `dataDir` (line 48):

```prisma
  dataDir       String?
  gatewayToken  String       @default("")
  status        InstanceStatus @default(creating)
```

- [ ] **Step 2: Generate migration**

Run: `npx prisma migrate dev --name add_gateway_token`
Expected: Creates migration file in `prisma/migrations/`

- [ ] **Step 3: Apply migration to container database**

The container needs the new schema. After migration, rebuild/restart the container.

- [ ] **Step 4: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat: add gatewayToken field to Instance model"
```

---

### Task 2: Add Token Generator Helper

**Files:**
- Create: `lib/utils.ts` (if not exists, or modify)

- [ ] **Step 1: Create/modify lib/utils.ts with generateRandomToken**

Create file `lib/utils.ts`:

```typescript
import crypto from 'crypto'

export function generateRandomToken(length: number): string {
  return crypto.randomBytes(Math.ceil(length / 2)).toString('hex').slice(0, length)
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/utils.ts
git commit -m "feat: add generateRandomToken helper"
```

---

### Task 3: Update Docker Container Creation

**Files:**
- Modify: `lib/docker.ts:23-24, 37-46, 54-58`

- [ ] **Step 1: Add gatewayToken to CreateContainerOptions interface**

In `lib/docker.ts`, modify the interface (lines 23-24):

```typescript
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
  hostDataDir?: string
  gatewayToken: string  // NEW: required token for OpenClaw auth
}
```

- [ ] **Step 2: Add OPENCLAW_GATEWAY_TOKEN to container env**

In `createOpenClawContainer` function (lines 37-46), modify the env array:

```typescript
export async function createOpenClawContainer(opts: CreateContainerOptions) {
  const docker = getDockerClient()
  const env: string[] = [
    `PROVIDER=${opts.provider}`,
    `MODEL=${opts.model}`,
    `API_KEY=${opts.apiKey}`,
    `OPENCLAW_GATEWAY_TOKEN=${opts.gatewayToken}`,  // NEW
  ]
  if (opts.baseUrl) env.push(`BASE_URL=${opts.baseUrl}`)
  if (opts.allowedOrigin) env.push(`ALLOWED_ORIGIN=${opts.allowedOrigin}`)
```

- [ ] **Step 3: Commit**

```bash
git add lib/docker.ts
git commit -m "feat: pass gatewayToken to OpenClaw container"
```

---

### Task 4: Update Validation Schemas

**Files:**
- Modify: `lib/validations.ts:12-25, 29-38`

- [ ] **Step 1: Add gatewayToken to createInstanceSchema**

In `lib/validations.ts`, add to `createInstanceSchema` (after `dataDir` line 24):

```typescript
export const createInstanceSchema = z.object({
  name: z.string().regex(/^[a-z0-9-]+$/, 'Only lowercase letters, numbers, and hyphens'),
  imageTag: z.string().min(1).optional(),
  port: z.number().int().min(1024).max(65535),
  provider: z.string().min(1),
  model: z.string().min(1),
  apiKey: z.string().min(1),
  baseUrl: optionalUrl,
  bindAddress: z.enum(['127.0.0.1', '0.0.0.0']).default('127.0.0.1'),
  allowedOrigin: optionalUrl,
  cpuLimit: z.number().positive().default(2),
  memoryLimit: z.string().regex(/^\d+[GgMmKk]?$/).default('2G'),
  dataDir: z.string().optional(),
  gatewayToken: z.string().min(8).max(64).optional(),  // NEW
})
```

- [ ] **Step 2: Add gatewayToken to updateConfigSchema**

In `updateConfigSchema` (after `imageTag` line 37):

```typescript
export const updateConfigSchema = z.object({
  provider: z.string().min(1).optional(),
  model: z.string().min(1).optional(),
  apiKey: z.string().min(1).optional(),
  baseUrl: optionalUrl,
  allowedOrigin: optionalUrl,
  cpuLimit: z.number().positive().optional(),
  memoryLimit: z.string().regex(/^\d+[GgMmKk]?$/).optional(),
  imageTag: z.string().optional(),
  gatewayToken: z.string().min(8).max(64).optional(),  // NEW
})
```

- [ ] **Step 3: Commit**

```bash
git add lib/validations.ts
git commit -m "feat: add gatewayToken to validation schemas"
```

---

### Task 5: Handle Token in Instance POST

**Files:**
- Modify: `app/api/instances/route.ts:5-6, 50-59, 93-101`

- [ ] **Step 1: Import generateRandomToken**

Add import at top of file (line 5):

```typescript
import { generateRandomToken } from '@/lib/utils'
```

- [ ] **Step 2: Generate token if not provided**

In POST handler, after `const data = parsed.data` (around line 50), add:

```typescript
  const data = parsed.data

  // Generate gatewayToken if not provided
  const gatewayToken = data.gatewayToken || generateRandomToken(32)
```

- [ ] **Step 3: Include gatewayToken in instance creation**

In `prisma.instance.create` (lines 74-91), add gatewayToken:

```typescript
  const instance = await prisma.instance.create({
    data: {
      name: data.name,
      imageTag: data.imageTag!,
      port: data.port,
      provider: data.provider,
      model: data.model,
      apiKey: encrypt(data.apiKey),
      baseUrl: data.baseUrl || null,
      bindAddress: data.bindAddress,
      allowedOrigin: data.allowedOrigin || null,
      cpuLimit: data.cpuLimit,
      memoryLimit: data.memoryLimit,
      dataDir,
      gatewayToken,  // NEW
      status: 'creating' as const,
      createdBy: session!.user!.id!,
    },
  })
```

- [ ] **Step 4: Pass gatewayToken to container creation**

In `createOpenClawContainer` call (lines 93-100):

```typescript
    const container = await createOpenClawContainer({
      ...data,
      imageTag: data.imageTag!,
      apiKey: data.apiKey,
      dataDir,
      hostDataDir,
      gatewayToken,  // NEW
    })
```

- [ ] **Step 5: Return gatewayToken in response**

Modify the success response (line 106):

```typescript
    return NextResponse.json({ ...instance, containerId: container.id, status: 'running', apiKey: undefined }, { status: 201 })
```

(The gatewayToken is already in instance, so it will be returned)

- [ ] **Step 6: Commit**

```bash
git add app/api/instances/route.ts
git commit -m "feat: handle gatewayToken in instance creation"
```

---

### Task 6: Return Token in Instance GET

**Files:**
- Modify: `app/api/instances/[id]/route.ts:22`

- [ ] **Step 1: Return gatewayToken in GET response**

The current GET handler returns `{ ...instance, apiKey: undefined }`. The gatewayToken is included in instance, so no modification needed for the field itself. However, verify it's being returned properly.

Current line 22:
```typescript
  return NextResponse.json({ ...instance, status: liveStatus, apiKey: undefined })
```

This already includes gatewayToken from instance. No change needed.

- [ ] **Step 2: Skip commit (no change required)**

---

### Task 7: Handle Token in Config PUT

**Files:**
- Modify: `app/api/instances/[id]/config/route.ts:22-35, 42, 44-58`

- [ ] **Step 1: Import generateRandomToken**

Add import at top:

```typescript
import { generateRandomToken } from '@/lib/utils'
```

- [ ] **Step 2: Handle gatewayToken in merged config**

In the `merged` object (lines 22-35), add gatewayToken handling:

```typescript
  const patch = parsed.data
  const merged = {
    name: instance.name,
    imageTag: patch.imageTag ?? instance.imageTag,
    port: instance.port,
    provider: patch.provider ?? instance.provider,
    model: patch.model ?? instance.model,
    apiKey: patch.apiKey ?? decrypt(instance.apiKey),
    baseUrl: patch.baseUrl !== undefined ? (patch.baseUrl || undefined) : (instance.baseUrl ?? undefined),
    allowedOrigin: patch.allowedOrigin !== undefined ? (patch.allowedOrigin || undefined) : (instance.allowedOrigin ?? undefined),
    bindAddress: instance.bindAddress,
    cpuLimit: patch.cpuLimit ?? instance.cpuLimit,
    memoryLimit: patch.memoryLimit ?? instance.memoryLimit,
    dataDir: instance.dataDir ?? '',
    gatewayToken: patch.gatewayToken || instance.gatewayToken || generateRandomToken(32),  // NEW
  }
```

- [ ] **Step 3: Pass gatewayToken to container creation**

In `createOpenClawContainer` call (line 42):

```typescript
  const container = await createOpenClawContainer(merged)
```

(merged already includes gatewayToken)

- [ ] **Step 4: Update gatewayToken in database**

In `prisma.instance.update` (lines 44-58), add gatewayToken:

```typescript
  const updated = await prisma.instance.update({
    where: { id },
    data: {
      containerId: container.id,
      imageTag: merged.imageTag,
      provider: merged.provider,
      model: merged.model,
      apiKey: encrypt(merged.apiKey),
      baseUrl: merged.baseUrl ?? null,
      allowedOrigin: merged.allowedOrigin ?? null,
      cpuLimit: merged.cpuLimit,
      memoryLimit: merged.memoryLimit,
      gatewayToken: merged.gatewayToken,  // NEW
      status: 'running' as const,
    },
  })
```

- [ ] **Step 5: Commit**

```bash
git add app/api/instances/[id]/config/route.ts
git commit -m "feat: handle gatewayToken in config update"
```

---

### Task 8: Add Token Input to New Instance Form

**Files:**
- Modify: `app/(dashboard)/instances/new/page.tsx:21-25, 55-61, 155-211`

- [ ] **Step 1: Add gatewayToken to form state**

In the form state (lines 21-25):

```typescript
  const [form, setForm] = useState({
    name: '', imageTag: '', port: '18789',
    provider: 'deepseek', model: '', apiKey: '', baseUrl: '',
    bindAddress: '127.0.0.1', allowedOrigin: '', cpuLimit: '2', memoryLimit: '2G',
    gatewayToken: '',  // NEW
  })
```

- [ ] **Step 2: Include gatewayToken in payload**

In handleSubmit payload (lines 55-61):

```typescript
    const payload = {
      ...form,
      port: parseInt(form.port),
      cpuLimit: parseFloat(form.cpuLimit),
      baseUrl: form.baseUrl || undefined,
      allowedOrigin: form.allowedOrigin || undefined,
      gatewayToken: form.gatewayToken || undefined,  // NEW (empty string = auto-generate)
    }
```

- [ ] **Step 3: Add gatewayToken input field in advanced options**

In the advanced options section (after allowedOrigin, around line 211):

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

- [ ] **Step 4: Commit**

```bash
git add app/(dashboard)/instances/new/page.tsx
git commit -m "feat: add gatewayToken input to new instance form"
```

---

### Task 9: Add Token to Edit Config Sheet

**Files:**
- Modify: `components/edit-config-sheet.tsx:39-41, 49-57, 85-95, 128-145`

- [ ] **Step 1: Add gatewayToken to basicForm state**

In basicForm state (lines 39-41):

```typescript
  const [basicForm, setBasicForm] = useState({
    provider: '', model: '', apiKey: '', baseUrl: '', cpuLimit: '', memoryLimit: '',
    gatewayToken: '',  // NEW
  })
```

- [ ] **Step 2: Fetch gatewayToken in useEffect**

In the useEffect fetch handler (lines 49-57):

```typescript
    fetch(`/api/instances/${instanceId}`).then(r => r.json()).then(data => {
      setBasicForm({
        provider: data.provider ?? '',
        model: data.model ?? '',
        apiKey: '',
        baseUrl: data.baseUrl ?? '',
        cpuLimit: String(data.cpuLimit ?? 2),
        memoryLimit: data.memoryLimit ?? '2G',
        gatewayToken: data.gatewayToken ?? '',  // NEW
      })
    })
```

- [ ] **Step 3: Include gatewayToken in save payload**

In handleBasicSave (lines 85-95):

```typescript
    const payload: Record<string, string | number> = {
      provider: basicForm.provider,
      model: basicForm.model,
      baseUrl: basicForm.baseUrl,
      cpuLimit: parseFloat(basicForm.cpuLimit),
      memoryLimit: basicForm.memoryLimit,
    }
    if (basicForm.apiKey) payload.apiKey = basicForm.apiKey
    if (basicForm.gatewayToken) payload.gatewayToken = basicForm.gatewayToken  // NEW
```

- [ ] **Step 4: Add gatewayToken input in basic config tab**

In the basic config fields array (around lines 128-145), add:

```tsx
            {[
              { key: 'provider', label: '提供商', type: 'text' },
              { key: 'model', label: '模型名', type: 'text' },
              { key: 'apiKey', label: 'API Key（留空保持不变）', type: 'password' },
              { key: 'baseUrl', label: 'Base URL（可选）', type: 'text' },
              { key: 'cpuLimit', label: 'CPU 上限', type: 'number' },
              { key: 'memoryLimit', label: '内存上限（如 2G）', type: 'text' },
              { key: 'gatewayToken', label: 'Gateway Token（留空保持不变）', type: 'text' },  // NEW
            ].map(({ key, label, type }) => (
```

- [ ] **Step 5: Commit**

```bash
git add components/edit-config-sheet.tsx
git commit -m "feat: add gatewayToken to edit config sheet"
```

---

### Task 10: Test and Verify

**Files:**
- Run tests, verify container starts

- [ ] **Step 1: Run existing tests**

Run: `npm test`
Expected: All tests pass

- [ ] **Step 2: Rebuild container with new code**

Run: `docker compose down && docker compose build && docker compose up -d`

- [ ] **Step 3: Connect to nginx network**

Run: `docker network connect ai-8tb-cc_frontend openclaw-colony-openclaw-colony-1`

- [ ] **Step 4: Test instance creation via API**

Inside container, run the test script to create an instance and verify container starts:

```bash
docker exec openclaw-colony-openclaw-colony-1 node -e '
const http = require("http");
let cookies = {};

function request(method, path, body) {
  return new Promise((resolve, reject) => {
    const opts = { hostname: "localhost", port: 3000, path, method, headers: { "Content-Type": "application/json" } };
    const cookieStr = Object.entries(cookies).map(([k,v])=>k+"="+v).join("; ");
    if (cookieStr) opts.headers.Cookie = cookieStr;
    const req = http.request(opts, (res) => {
      (res.headers["set-cookie"]||[]).forEach(c => { const m = c.match(/^([^=]+)=([^;]+)/); if (m) cookies[m[1]] = m[2]; });
      let data = ""; res.on("data", c => data += c); res.on("end", () => resolve({ status: res.statusCode, data }));
    });
    req.on("error", reject); if (body) req.write(JSON.stringify(body)); req.end();
  });
}

(async () => {
  const csrf = JSON.parse(await request("GET", "/api/auth/csrf").then(r=>r.data));
  await request("POST", "/api/auth/callback/credentials", {email:"test@test.com",password:"test12345678",csrfToken:csrf.csrfToken});
  
  const create = await request("POST", "/api/instances", {
    name: "gateway-test",
    imageTag: "ghcr.io/openclaw/openclaw:2026.5.18",
    port: 8090,
    provider: "deepseek",
    model: "deepseek-chat",
    apiKey: "sk-test-key",
    bindAddress: "127.0.0.1",
    cpuLimit: 2,
    memoryLimit: "2G"
  });
  console.log("Create Status:", create.status);
  console.log("Response:", create.data);
})();
'
```

Expected: Status 201, response includes gatewayToken, container status should be "running" not "Restarting"

- [ ] **Step 5: Verify container is running**

Run: `docker ps --filter "name=gateway-test"`
Expected: STATUS shows "Up" not "Restarting"

- [ ] **Step 6: Final commit**

```bash
git add -A
git commit -m "feat: complete gateway token feature implementation"
```

---

## Self-Review Checklist

**Spec coverage:**
- ✅ Database schema with gatewayToken field (Task 1)
- ✅ Container env with OPENCLAW_GATEWAY_TOKEN (Task 3)
- ✅ Validation schemas (Task 4)
- ✅ POST handler generates/uses token (Task 5)
- ✅ GET returns token (Task 6 - verified no change needed)
- ✅ PUT updates token (Task 7)
- ✅ New instance form input (Task 8)
- ✅ Edit config sheet input (Task 9)
- ✅ Testing (Task 10)

**Placeholder scan:** No TBD/TODO placeholders found.

**Type consistency:** `gatewayToken` consistently used as `string` type across all files.