# Image Management Module Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build admin-only image management module for importing Docker images from openclaw/openclaw, activating one for new instances, and tracking operations.

**Architecture:** Prisma models for Image and AuditLog, 5 API routes with Docker Hub integration and in-memory caching, React UI at `/settings/images`, integration with instance creation flow.

**Tech Stack:** Next.js 16, Prisma (SQLite), NextAuth v5, shadcn/ui, Zod v4, Docker Hub Registry API

---

## File Structure

| File | Purpose |
|------|---------|
| `prisma/schema.prisma` | Add Image and AuditLog models, update User |
| `lib/docker-hub.ts` | Docker Hub API client with cache and timeout |
| `lib/validations.ts` | Add image-related Zod schemas |
| `app/api/images/route.ts` | GET (list) and POST (import) endpoints |
| `app/api/images/[id]/route.ts` | DELETE endpoint |
| `app/api/images/[id]/activate/route.ts` | PATCH endpoint for activation |
| `app/api/images/validate/route.ts` | POST endpoint for tag validation |
| `app/(dashboard)/settings/images/page.tsx` | Image list page |
| `components/import-image-dialog.tsx` | Import modal with preview |
| `components/delete-image-dialog.tsx` | Delete confirmation modal |
| `components/image-list-table.tsx` | Table component for images |
| `app/(dashboard)/layout.tsx` | Add "镜像" nav link |
| `app/(dashboard)/instances/new/page.tsx` | Add image dropdown, active image check |
| `tests/lib/docker-hub.test.ts` | Docker Hub API tests |
| `tests/api/images.test.ts` | API route tests |

---

### Task 1: Update Prisma Schema

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Add Image and AuditLog models, update User**

Add to `prisma/schema.prisma` after the `Instance` model:

```prisma
model Image {
  id             String   @id @default(cuid())
  repository     String   @default("openclaw/openclaw")
  tag            String
  digest         String   @unique
  os             String   @default("linux")
  architecture   String   // amd64 or arm64
  compressedSize Int      // bytes
  isActive       Boolean  @default(false)
  pushedAt       DateTime
  importedAt     DateTime @default(now())
  importedBy     String
  importer       User     @relation(fields: [importedBy], references: [id])

  @@index([isActive])
  @@index([pushedAt])
}

model AuditLog {
  id          String   @id @default(cuid())
  userId      String
  user        User     @relation(fields: [userId], references: [id])
  action      String   // import, activate, delete
  resource    String   // "image"
  resourceId  String?  // image id
  metadata    String?  // JSON: { tag, digest }
  createdAt   DateTime @default(now())

  @@index([userId])
  @@index([createdAt])
}
```

Update the `User` model to add relations:

```prisma
model User {
  id           String     @id @default(cuid())
  email        String     @unique
  passwordHash String
  role         Role       @default(operator)
  createdAt    DateTime   @default(now())
  instances    Instance[]
  importedImages Image[]
  auditLogs      AuditLog[]
}
```

- [ ] **Step 2: Run Prisma migration**

Run:
```bash
npx prisma migrate dev --name add_image_and_audit_log
```

Expected: Migration file created, database updated.

- [ ] **Step 3: Regenerate Prisma client**

Run:
```bash
npx prisma generate
```

Expected: Prisma client updated with new models.

- [ ] **Step 4: Commit schema changes**

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat: add Image and AuditLog models for image management

- Image model stores imported Docker images with digest uniqueness
- AuditLog tracks admin operations (import, activate, delete)
- User model gains relations for imported images and audit logs

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

### Task 2: Create Docker Hub API Library

**Files:**
- Create: `lib/docker-hub.ts`
- Test: `tests/lib/docker-hub.test.ts`

- [ ] **Step 1: Write failing tests for Docker Hub client**

Create `tests/lib/docker-hub.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fetchTagInfo, clearTagCache } from '@/lib/docker-hub'

// Mock fetch globally
const mockFetch = vi.fn()
global.fetch = mockFetch

describe('fetchTagInfo', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    clearTagCache()
  })

  it('returns tag info from Docker Hub', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        name: 'latest',
        digest: 'sha256:abc123',
        last_pushed: '2026-05-20T10:00:00Z',
        full_size: 500000000,
        images: [{ os: 'linux', architecture: 'amd64' }],
      }),
    })

    const result = await fetchTagInfo('latest')
    expect(result).toEqual({
      tag: 'latest',
      digest: 'sha256:abc123',
      pushedAt: new Date('2026-05-20T10:00:00Z'),
      compressedSize: 500000000,
      os: 'linux',
      architecture: 'amd64',
    })
  })

  it('returns null on 404', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 404 })
    const result = await fetchTagInfo('nonexistent')
    expect(result).toBeNull()
  })

  it('throws on timeout', async () => {
    mockFetch.mockImplementationOnce(() => 
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Timeout')), 100)
      )
    )
    await expect(fetchTagInfo('latest', 50)).rejects.toThrow('Docker Hub API 超时')
  })

  it('caches result for same tag', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        name: 'v1.0.0',
        digest: 'sha256:cached',
        last_pushed: '2026-05-20T10:00:00Z',
        full_size: 400000000,
        images: [{ os: 'linux', architecture: 'amd64' }],
      }),
    })

    await fetchTagInfo('v1.0.0')
    await fetchTagInfo('v1.0.0')
    
    // Should only call fetch once due to caching
    expect(mockFetch).toHaveBeenCalledTimes(1)
  })

  it('bypasses cache after TTL expires', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        name: 'v1.0.0',
        digest: 'sha256:new',
        last_pushed: '2026-05-20T10:00:00Z',
        full_size: 400000000,
        images: [{ os: 'linux', architecture: 'amd64' }],
      }),
    })

    await fetchTagInfo('v1.0.0')
    // Manually clear cache to simulate TTL expiry
    clearTagCache()
    await fetchTagInfo('v1.0.0')
    
    expect(mockFetch).toHaveBeenCalledTimes(2)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run:
```bash
npm test tests/lib/docker-hub.test.ts
```

Expected: FAIL - module not found.

- [ ] **Step 3: Implement Docker Hub client with caching**

Create `lib/docker-hub.ts`:

```typescript
import { z } from 'zod'

const DOCKER_HUB_API = 'https://hub.docker.com/v2/repositories/openclaw/openclaw/tags'
const TIMEOUT_MS = 5000
const CACHE_TTL_MS = 10 * 60 * 1000 // 10 minutes

// In-memory cache
const tagCache = new Map<string, { data: TagInfo; timestamp: number }>()

export interface TagInfo {
  tag: string
  digest: string
  pushedAt: Date
  compressedSize: number
  os: string
  architecture: string
}

export function clearTagCache(): void {
  tagCache.clear()
}

export async function fetchTagInfo(tag: string, timeoutMs = TIMEOUT_MS): Promise<TagInfo | null> {
  // Check cache first
  const cached = tagCache.get(tag)
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.data
  }

  const url = `${DOCKER_HUB_API}/${tag}`
  
  try {
    const response = await fetchWithTimeout(url, timeoutMs)
    
    if (!response.ok) {
      if (response.status === 404) return null
      throw new Error(`Docker Hub API 错误: ${response.status}`)
    }

    const data = await response.json()
    
    // Extract first image variant (assume linux/amd64 if multiple)
    const image = data.images?.[0] ?? { os: 'linux', architecture: 'amd64' }
    
    const info: TagInfo = {
      tag: data.name,
      digest: data.digest,
      pushedAt: new Date(data.last_pushed),
      compressedSize: data.full_size,
      os: image.os,
      architecture: image.architecture,
    }

    // Cache the result
    tagCache.set(tag, { data: info, timestamp: Date.now() })
    
    return info
  } catch (err) {
    if (err instanceof Error && err.message.includes('Timeout')) {
      throw new Error('Docker Hub API 超时，请稍后重试')
    }
    throw err
  }
}

async function fetchWithTimeout(url: string, timeoutMs: number): Promise<Response> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

  try {
    // Retry once on failure
    let response = await fetch(url, { signal: controller.signal })
    if (!response.ok && response.status >= 500) {
      response = await fetch(url, { signal: controller.signal })
    }
    return response
  } finally {
    clearTimeout(timeoutId)
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run:
```bash
npm test tests/lib/docker-hub.test.ts
```

Expected: PASS - all tests pass.

- [ ] **Step 5: Commit Docker Hub library**

```bash
git add lib/docker-hub.ts tests/lib/docker-hub.test.ts
git commit -m "feat: add Docker Hub API client with caching

- fetchTagInfo validates tag existence via Docker Hub API
- In-memory cache with 10-minute TTL to avoid rate limits
- Timeout handling with 5s default, 1 retry on server errors

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

### Task 3: Add Image Validation Schemas

**Files:**
- Modify: `lib/validations.ts`

- [ ] **Step 1: Add image-related Zod schemas**

Add to `lib/validations.ts` after `openclawConfigUpdateSchema`:

```typescript
export const importImageSchema = z.object({
  tag: z.string().min(1, 'Tag 不能为空').max(128),
})

export type ImportImageInput = z.infer<typeof importImageSchema>

export const validateTagSchema = z.object({
  tag: z.string().min(1, 'Tag 不能为空').max(128),
})

export type ValidateTagInput = z.infer<typeof validateTagSchema>
```

- [ ] **Step 2: Commit validation schemas**

```bash
git add lib/validations.ts
git commit -m "feat: add image import and validation schemas

- importImageSchema for POST /api/images
- validateTagSchema for POST /api/images/validate

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

### Task 4: Create API Routes - Validate Endpoint

**Files:**
- Create: `app/api/images/validate/route.ts`
- Test: `tests/api/images-validate.test.ts`

- [ ] **Step 1: Write failing test for validate endpoint**

Create `tests/api/images-validate.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/auth', () => ({
  auth: vi.fn(),
}))

vi.mock('@/lib/docker-hub', () => ({
  fetchTagInfo: vi.fn(),
}))

const { POST } = await import('@/app/api/images/validate/route')
import { auth } from '@/lib/auth'
import { fetchTagInfo } from '@/lib/docker-hub'

describe('POST /api/images/validate', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 401 if not authenticated', async () => {
    vi.mocked(auth).mockResolvedValue(null)
    const req = new NextRequest('http://localhost/api/images/validate', {
      method: 'POST',
      body: JSON.stringify({ tag: 'latest' }),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req)
    expect(res.status).toBe(401)
  })

  it('returns 403 if not admin', async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: 'u1', role: 'operator' } } as any)
    const req = new NextRequest('http://localhost/api/images/validate', {
      method: 'POST',
      body: JSON.stringify({ tag: 'latest' }),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req)
    expect(res.status).toBe(403)
  })

  it('returns preview info for valid tag', async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: 'u1', role: 'admin' } } as any)
    vi.mocked(fetchTagInfo).mockResolvedValue({
      tag: 'latest',
      digest: 'sha256:abc123',
      pushedAt: new Date('2026-05-20T10:00:00Z'),
      compressedSize: 500000000,
      os: 'linux',
      architecture: 'amd64',
    })

    const req = new NextRequest('http://localhost/api/images/validate', {
      method: 'POST',
      body: JSON.stringify({ tag: 'latest' }),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.tag).toBe('latest')
    expect(body.digest).toBe('sha256:abc123')
  })

  it('returns 404 for nonexistent tag', async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: 'u1', role: 'admin' } } as any)
    vi.mocked(fetchTagInfo).mockResolvedValue(null)

    const req = new NextRequest('http://localhost/api/images/validate', {
      method: 'POST',
      body: JSON.stringify({ tag: 'nonexistent' }),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req)
    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body.error).toContain('Tag 不存在')
  })

  it('returns 400 for empty tag', async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: 'u1', role: 'admin' } } as any)

    const req = new NextRequest('http://localhost/api/images/validate', {
      method: 'POST',
      body: JSON.stringify({ tag: '' }),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run:
```bash
npm test tests/api/images-validate.test.ts
```

Expected: FAIL - route not found.

- [ ] **Step 3: Create validate route**

Create `app/api/images/validate/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { fetchTagInfo } from '@/lib/docker-hub'
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

  try {
    const info = await fetchTagInfo(parsed.data.tag)
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
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? '查询失败' }, { status: 500 })
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run:
```bash
npm test tests/api/images-validate.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit validate route**

```bash
git add app/api/images/validate/route.ts tests/api/images-validate.test.ts
git commit -m "feat: add /api/images/validate endpoint

- Admin-only endpoint to validate tag via Docker Hub
- Returns preview info or 404 for nonexistent tags
- Handles timeout and error responses

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

### Task 5: Create API Routes - List and Import

**Files:**
- Create: `app/api/images/route.ts`
- Test: `tests/api/images.test.ts`

- [ ] **Step 1: Write failing tests for list and import endpoints**

Create `tests/api/images.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/db', () => ({
  prisma: {
    image: {
      findMany: vi.fn(),
      create: vi.fn(),
      findFirst: vi.fn(),
      count: vi.fn(),
    },
    auditLog: {
      create: vi.fn(),
    },
  },
}))

vi.mock('@/lib/auth', () => ({
  auth: vi.fn(),
}))

vi.mock('@/lib/docker-hub', () => ({
  fetchTagInfo: vi.fn(),
}))

const { GET, POST } = await import('@/app/api/images/route')
import { prisma } from '@/lib/db'
import { auth } from '@/lib/auth'
import { fetchTagInfo } from '@/lib/docker-hub'

describe('GET /api/images', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 401 if not authenticated', async () => {
    vi.mocked(auth).mockResolvedValue(null)
    const req = new NextRequest('http://localhost/api/images')
    const res = await GET(req)
    expect(res.status).toBe(401)
  })

  it('returns 403 if not admin', async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: 'u1', role: 'operator' } } as any)
    const req = new NextRequest('http://localhost/api/images')
    const res = await GET(req)
    expect(res.status).toBe(403)
  })

  it('returns paginated image list', async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: 'u1', role: 'admin' } } as any)
    vi.mocked(prisma.image.findMany).mockResolvedValue([
      { id: 'img1', tag: 'v1.0.0', digest: 'sha256:a', isActive: false, pushedAt: new Date(), importedAt: new Date() } as any,
    ])
    vi.mocked(prisma.image.count).mockResolvedValue(1)

    const req = new NextRequest('http://localhost/api/images?page=1&limit=10')
    const res = await GET(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.images).toHaveLength(1)
    expect(body.total).toBe(1)
  })
})

describe('POST /api/images (import)', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 401 if not authenticated', async () => {
    vi.mocked(auth).mockResolvedValue(null)
    const req = new NextRequest('http://localhost/api/images', {
      method: 'POST',
      body: JSON.stringify({ tag: 'latest' }),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req)
    expect(res.status).toBe(401)
  })

  it('imports image and creates audit log', async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: 'u1', role: 'admin' } } as any)
    vi.mocked(fetchTagInfo).mockResolvedValue({
      tag: 'latest',
      digest: 'sha256:abc123',
      pushedAt: new Date('2026-05-20T10:00:00Z'),
      compressedSize: 500000000,
      os: 'linux',
      architecture: 'amd64',
    })
    vi.mocked(prisma.image.findFirst).mockResolvedValue(null) // No duplicate
    vi.mocked(prisma.image.create).mockResolvedValue({
      id: 'img1',
      repository: 'openclaw/openclaw',
      tag: 'latest',
      digest: 'sha256:abc123',
      os: 'linux',
      architecture: 'amd64',
      compressedSize: 500000000,
      isActive: false,
      pushedAt: new Date('2026-05-20T10:00:00Z'),
      importedAt: new Date(),
      importedBy: 'u1',
    } as any)
    vi.mocked(prisma.auditLog.create).mockResolvedValue({} as any)

    const req = new NextRequest('http://localhost/api/images', {
      method: 'POST',
      body: JSON.stringify({ tag: 'latest' }),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req)
    expect(res.status).toBe(201)
    expect(prisma.image.create).toHaveBeenCalled()
    expect(prisma.auditLog.create).toHaveBeenCalled()
  })

  it('returns 400 if digest already exists', async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: 'u1', role: 'admin' } } as any)
    vi.mocked(fetchTagInfo).mockResolvedValue({
      tag: 'latest',
      digest: 'sha256:duplicate',
      pushedAt: new Date(),
      compressedSize: 500000000,
      os: 'linux',
      architecture: 'amd64',
    })
    vi.mocked(prisma.image.findFirst).mockResolvedValue({ id: 'existing' } as any)

    const req = new NextRequest('http://localhost/api/images', {
      method: 'POST',
      body: JSON.stringify({ tag: 'latest' }),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toContain('该版本已导入')
  })

  it('returns 404 if tag not found on Docker Hub', async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: 'u1', role: 'admin' } } as any)
    vi.mocked(fetchTagInfo).mockResolvedValue(null)

    const req = new NextRequest('http://localhost/api/images', {
      method: 'POST',
      body: JSON.stringify({ tag: 'nonexistent' }),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req)
    expect(res.status).toBe(404)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run:
```bash
npm test tests/api/images.test.ts
```

Expected: FAIL - route not found.

- [ ] **Step 3: Create images route (GET and POST)**

Create `app/api/images/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { auth } from '@/lib/auth'
import { fetchTagInfo } from '@/lib/docker-hub'
import { importImageSchema } from '@/lib/validations'

function requireAdmin(session: any) {
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if ((session.user as any).role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  return null
}

export async function GET(req: NextRequest) {
  const session = await auth()
  const authErr = requireAdmin(session)
  if (authErr) return authErr

  const { searchParams } = new URL(req.url)
  const page = parseInt(searchParams.get('page') ?? '1')
  const limit = parseInt(searchParams.get('limit') ?? '10')
  const skip = (page - 1) * limit

  const images = await prisma.image.findMany({
    orderBy: { pushedAt: 'desc' },
    skip,
    take: limit,
  })

  const total = await prisma.image.count()

  return NextResponse.json({ images, total, page, limit })
}

export async function POST(req: NextRequest) {
  const session = await auth()
  const authErr = requireAdmin(session)
  if (authErr) return authErr

  const body = await req.json()
  const parsed = importImageSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const tag = parsed.data.tag

  // Fetch tag info from Docker Hub
  const info = await fetchTagInfo(tag)
  if (!info) {
    return NextResponse.json({ error: 'Tag 不存在，请前往 Docker Hub 确认版本号' }, { status: 404 })
  }

  // Check for duplicate digest
  const existing = await prisma.image.findFirst({
    where: { digest: info.digest },
  })

  if (existing) {
    return NextResponse.json({ error: '该版本已导入（digest 相同）' }, { status: 400 })
  }

  // Special handling for latest: check if digest matches existing latest
  if (tag === 'latest') {
    const existingLatest = await prisma.image.findFirst({
      where: { tag: 'latest' },
    })
    if (existingLatest && existingLatest.digest === info.digest) {
      return NextResponse.json({ error: '当前 latest 版本已是最新' }, { status: 400 })
    }
  }

  // Create image record
  const image = await prisma.image.create({
    data: {
      repository: 'openclaw/openclaw',
      tag: info.tag,
      digest: info.digest,
      os: info.os,
      architecture: info.architecture,
      compressedSize: info.compressedSize,
      pushedAt: info.pushedAt,
      importedBy: session!.user!.id!,
    },
  })

  // Create audit log
  await prisma.auditLog.create({
    data: {
      userId: session!.user!.id!,
      action: 'import',
      resource: 'image',
      resourceId: image.id,
      metadata: JSON.stringify({ tag: info.tag, digest: info.digest }),
    },
  })

  return NextResponse.json(image, { status: 201 })
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run:
```bash
npm test tests/api/images.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit images route**

```bash
git add app/api/images/route.ts tests/api/images.test.ts
git commit -m "feat: add /api/images GET and POST endpoints

- GET: paginated list sorted by pushedAt desc
- POST: import image with Docker Hub validation
- Duplicate digest check, special latest handling
- Audit log on successful import

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

### Task 6: Create API Routes - Activate Endpoint

**Files:**
- Create: `app/api/images/[id]/activate/route.ts`
- Test: `tests/api/images-activate.test.ts`

- [ ] **Step 1: Write failing test for activate endpoint**

Create `tests/api/images-activate.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/db', () => ({
  prisma: {
    image: {
      findUnique: vi.fn(),
      updateMany: vi.fn(),
      update: vi.fn(),
    },
    auditLog: {
      create: vi.fn(),
    },
    $transaction: vi.fn((fn: any) => fn(prisma)),
  },
}))

vi.mock('@/lib/auth', () => ({
  auth: vi.fn(),
}))

const { PATCH } = await import('@/app/api/images/[id]/activate/route')
import { prisma } from '@/lib/db'
import { auth } from '@/lib/auth'

describe('PATCH /api/images/[id]/activate', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 401 if not authenticated', async () => {
    vi.mocked(auth).mockResolvedValue(null)
    const req = new NextRequest('http://localhost/api/images/img1/activate', { method: 'PATCH' })
    const res = await PATCH(req, { params: Promise.resolve({ id: 'img1' }) })
    expect(res.status).toBe(401)
  })

  it('returns 404 if image not found', async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: 'u1', role: 'admin' } } as any)
    vi.mocked(prisma.image.findUnique).mockResolvedValue(null)

    const req = new NextRequest('http://localhost/api/images/img1/activate', { method: 'PATCH' })
    const res = await PATCH(req, { params: Promise.resolve({ id: 'img1' }) })
    expect(res.status).toBe(404)
  })

  it('activates image and creates audit log', async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: 'u1', role: 'admin' } } as any)
    vi.mocked(prisma.image.findUnique).mockResolvedValue({
      id: 'img1',
      tag: 'v1.0.0',
      digest: 'sha256:abc',
      isActive: false,
    } as any)
    vi.mocked(prisma.image.updateMany).mockResolvedValue({ count: 2 })
    vi.mocked(prisma.image.update).mockResolvedValue({
      id: 'img1',
      isActive: true,
    } as any)
    vi.mocked(prisma.auditLog.create).mockResolvedValue({} as any)

    const req = new NextRequest('http://localhost/api/images/img1/activate', { method: 'PATCH' })
    const res = await PATCH(req, { params: Promise.resolve({ id: 'img1' }) })
    expect(res.status).toBe(200)
    expect(prisma.image.updateMany).toHaveBeenCalledWith({ where: {}, data: { isActive: false } })
    expect(prisma.image.update).toHaveBeenCalledWith({ where: { id: 'img1' }, data: { isActive: true } })
    expect(prisma.auditLog.create).toHaveBeenCalled()
  })

  it('is idempotent for already active image', async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: 'u1', role: 'admin' } } as any)
    vi.mocked(prisma.image.findUnique).mockResolvedValue({
      id: 'img1',
      tag: 'v1.0.0',
      digest: 'sha256:abc',
      isActive: true,
    } as any)
    vi.mocked(prisma.image.updateMany).mockResolvedValue({ count: 1 })
    vi.mocked(prisma.image.update).mockResolvedValue({
      id: 'img1',
      isActive: true,
    } as any)

    const req = new NextRequest('http://localhost/api/images/img1/activate', { method: 'PATCH' })
    const res = await PATCH(req, { params: Promise.resolve({ id: 'img1' }) })
    expect(res.status).toBe(200)
    // Still updates all to false then this to true (idempotent)
    expect(prisma.image.updateMany).toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run:
```bash
npm test tests/api/images-activate.test.ts
```

Expected: FAIL - route not found.

- [ ] **Step 3: Create activate route**

Create `app/api/images/[id]/activate/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { auth } from '@/lib/auth'

function requireAdmin(session: any) {
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if ((session.user as any).role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  return null
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  const authErr = requireAdmin(session)
  if (authErr) return authErr

  const { id } = await params

  const image = await prisma.image.findUnique({ where: { id } })
  if (!image) {
    return NextResponse.json({ error: '镜像不存在' }, { status: 404 })
  }

  // Use transaction to ensure atomicity and prevent race conditions
  await prisma.$transaction(async (tx) => {
    // Deactivate all images first
    await tx.image.updateMany({
      where: {},
      data: { isActive: false },
    })
    // Activate target image
    await tx.image.update({
      where: { id },
      data: { isActive: true },
    })
  })

  // Create audit log
  await prisma.auditLog.create({
    data: {
      userId: session!.user!.id!,
      action: 'activate',
      resource: 'image',
      resourceId: id,
      metadata: JSON.stringify({ tag: image.tag, digest: image.digest }),
    },
  })

  return NextResponse.json({ ...image, isActive: true })
}
```

- [ ] **Step 4: Run test to verify it passes**

Run:
```bash
npm test tests/api/images-activate.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit activate route**

```bash
git add app/api/images/[id]/activate/route.ts tests/api/images-activate.test.ts
git commit -m "feat: add /api/images/[id]/activate endpoint

- Transaction-based activation to prevent race conditions
- First deactivates all, then activates target (idempotent)
- Audit log on successful activation

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

### Task 7: Create API Routes - Delete Endpoint

**Files:**
- Create: `app/api/images/[id]/route.ts`
- Test: `tests/api/images-delete.test.ts`

- [ ] **Step 1: Write failing test for delete endpoint**

Create `tests/api/images-delete.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/db', () => ({
  prisma: {
    image: {
      findUnique: vi.fn(),
      delete: vi.fn(),
    },
    auditLog: {
      create: vi.fn(),
    },
  },
}))

vi.mock('@/lib/auth', () => ({
  auth: vi.fn(),
}))

const { DELETE } = await import('@/app/api/images/[id]/route')
import { prisma } from '@/lib/db'
import { auth } from '@/lib/auth'

describe('DELETE /api/images/[id]', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 401 if not authenticated', async () => {
    vi.mocked(auth).mockResolvedValue(null)
    const req = new NextRequest('http://localhost/api/images/img1', { method: 'DELETE' })
    const res = await DELETE(req, { params: Promise.resolve({ id: 'img1' }) })
    expect(res.status).toBe(401)
  })

  it('returns 404 if image not found', async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: 'u1', role: 'admin' } } as any)
    vi.mocked(prisma.image.findUnique).mockResolvedValue(null)

    const req = new NextRequest('http://localhost/api/images/img1', { method: 'DELETE' })
    const res = await DELETE(req, { params: Promise.resolve({ id: 'img1' }) })
    expect(res.status).toBe(404)
  })

  it('deletes image and creates audit log', async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: 'u1', role: 'admin' } } as any)
    vi.mocked(prisma.image.findUnique).mockResolvedValue({
      id: 'img1',
      tag: 'v1.0.0',
      digest: 'sha256:abc',
      isActive: false,
    } as any)
    vi.mocked(prisma.image.delete).mockResolvedValue({} as any)
    vi.mocked(prisma.auditLog.create).mockResolvedValue({} as any)

    const req = new NextRequest('http://localhost/api/images/img1', { method: 'DELETE' })
    const res = await DELETE(req, { params: Promise.resolve({ id: 'img1' }) })
    expect(res.status).toBe(200)
    expect(prisma.image.delete).toHaveBeenCalledWith({ where: { id: 'img1' } })
    expect(prisma.auditLog.create).toHaveBeenCalled()
  })

  it('returns warning when deleting active image', async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: 'u1', role: 'admin' } } as any)
    vi.mocked(prisma.image.findUnique).mockResolvedValue({
      id: 'img1',
      tag: 'v1.0.0',
      digest: 'sha256:abc',
      isActive: true,
    } as any)
    vi.mocked(prisma.image.delete).mockResolvedValue({} as any)
    vi.mocked(prisma.auditLog.create).mockResolvedValue({} as any)

    const req = new NextRequest('http://localhost/api/images/img1', { method: 'DELETE' })
    const res = await DELETE(req, { params: Promise.resolve({ id: 'img1' }) })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.warning).toBe(true)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run:
```bash
npm test tests/api/images-delete.test.ts
```

Expected: FAIL - route not found.

- [ ] **Step 3: Create delete route**

Create `app/api/images/[id]/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { auth } from '@/lib/auth'

function requireAdmin(session: any) {
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if ((session.user as any).role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  return null
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  const authErr = requireAdmin(session)
  if (authErr) return authErr

  const { id } = await params

  const image = await prisma.image.findUnique({ where: { id } })
  if (!image) {
    return NextResponse.json({ error: '镜像不存在' }, { status: 404 })
  }

  const wasActive = image.isActive

  // Delete image record (platform only, not remote)
  await prisma.image.delete({ where: { id } })

  // Create audit log
  await prisma.auditLog.create({
    data: {
      userId: session!.user!.id!,
      action: 'delete',
      resource: 'image',
      resourceId: id,
      metadata: JSON.stringify({ tag: image.tag, digest: image.digest, wasActive }),
    },
  })

  return NextResponse.json({
    success: true,
    warning: wasActive, // Indicates active image was deleted
  })
}
```

- [ ] **Step 4: Run test to verify it passes**

Run:
```bash
npm test tests/api/images-delete.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit delete route**

```bash
git add app/api/images/[id]/route.ts tests/api/images-delete.test.ts
git commit -m "feat: add /api/images/[id] DELETE endpoint

- Deletes image from platform records only
- Returns warning flag if deleted image was active
- Audit log tracks deletion with wasActive metadata

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

### Task 8: Create Image List Table Component

**Files:**
- Create: `components/image-list-table.tsx`

- [ ] **Step 1: Create image list table component**

Create `components/image-list-table.tsx`:

```typescript
'use client'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Trash2, CheckCircle } from 'lucide-react'

export interface ImageRow {
  id: string
  tag: string
  digest: string
  os: string
  architecture: string
  compressedSize: number
  isActive: boolean
  pushedAt: string
  importedAt: string
}

interface Props {
  images: ImageRow[]
  onActivate: (id: string) => void
  onDelete: (id: string) => void
  loading?: boolean
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`
}

function formatDigest(digest: string): string {
  // Show first 12 characters after sha256:
  return digest.replace('sha256:', '').slice(0, 12)
}

export function ImageListTable({ images, onActivate, onDelete, loading }: Props) {
  if (loading) {
    return <div className="text-center py-8 text-gray-400">加载中...</div>
  }

  if (images.length === 0) {
    return (
      <div className="text-center py-16 text-gray-400">
        <p className="text-lg">暂无镜像</p>
        <p className="mt-2">点击右上角「导入镜像」添加 openclaw 版本</p>
      </div>
    )
  }

  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="text-left text-gray-500 border-b">
          <th className="pb-2 font-medium">Tag</th>
          <th className="pb-2 font-medium">Digest</th>
          <th className="pb-2 font-medium">架构</th>
          <th className="pb-2 font-medium">大小</th>
          <th className="pb-2 font-medium">推送时间</th>
          <th className="pb-2 font-medium">状态</th>
          <th className="pb-2 font-medium">操作</th>
        </tr>
      </thead>
      <tbody>
        {images.map(img => (
          <tr key={img.id} className="border-b last:border-0 hover:bg-gray-50">
            <td className="py-3 font-medium">{img.tag}</td>
            <td className="py-3 text-gray-500 font-mono">{formatDigest(img.digest)}</td>
            <td className="py-3">{img.os}/{img.architecture}</td>
            <td className="py-3">{formatSize(img.compressedSize)}</td>
            <td className="py-3 text-gray-500">
              {new Date(img.pushedAt).toLocaleDateString()}
            </td>
            <td className="py-3">
              {img.isActive ? (
                <Badge className="bg-green-100 text-green-700 border-green-200">生效</Badge>
              ) : (
                <Badge variant="secondary">未生效</Badge>
              )}
            </td>
            <td className="py-3">
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={img.isActive}
                  onClick={() => onActivate(img.id)}
                  className="h-7"
                >
                  <CheckCircle className="w-4 h-4 mr-1" />
                  设为生效
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 text-red-500 hover:text-red-600"
                  onClick={() => onDelete(img.id)}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
```

- [ ] **Step 2: Commit image list component**

```bash
git add components/image-list-table.tsx
git commit -m "feat: add ImageListTable component

- Table display with formatted size and truncated digest
- Active/inactive badge styling
- Activate button (disabled if active) and delete button
- Empty state message

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

### Task 9: Create Import Image Dialog

**Files:**
- Create: `components/import-image-dialog.tsx`

- [ ] **Step 1: Create import dialog component**

Create `components/import-image-dialog.tsx`:

```typescript
'use client'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Card, CardContent } from '@/components/ui/card'
import { ExternalLink, Loader2 } from 'lucide-react'

interface Props {
  open: boolean
  onClose: () => void
  onImported: () => void
}

interface PreviewInfo {
  tag: string
  digest: string
  os: string
  architecture: string
  compressedSize: number
  pushedAt: string
}

function formatSize(bytes: number): string {
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`
}

export function ImportImageDialog({ open, onClose, onImported }: Props) {
  const [tag, setTag] = useState('')
  const [preview, setPreview] = useState<PreviewInfo | null>(null)
  const [error, setError] = useState('')
  const [validating, setValidating] = useState(false)
  const [importing, setImporting] = useState(false)

  async function handleValidate() {
    if (!tag.trim()) return
    setError('')
    setPreview(null)
    setValidating(true)

    try {
      const res = await fetch('/api/images/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tag: tag.trim() }),
      })
      const data = await res.json()

      if (!res.ok) {
        setError(data.error || '查询失败')
      } else {
        setPreview(data)
      }
    } catch {
      setError('网络错误，请稍后重试')
    } finally {
      setValidating(false)
    }
  }

  async function handleImport() {
    if (!preview) return
    setError('')
    setImporting(true)

    try {
      const res = await fetch('/api/images', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tag: preview.tag }),
      })
      const data = await res.json()

      if (!res.ok) {
        setError(data.error || '导入失败')
      } else {
        setTag('')
        setPreview(null)
        onImported()
        onClose()
      }
    } catch {
      setError('网络错误，请稍后重试')
    } finally {
      setImporting(false)
    }
  }

  function handleClose() {
    setTag('')
    setPreview(null)
    setError('')
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>导入镜像</DialogTitle>
          <DialogDescription>
            输入 Docker Hub openclaw/openclaw 仓库的 Tag 版本号
            <a
              href="https://hub.docker.com/r/openclaw/openclaw/tags"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 ml-1 text-blue-600 hover:underline"
            >
              <ExternalLink className="w-3 h-3" />
              查看所有可用 Tag
            </a>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="tag">Tag</Label>
            <Input
              id="tag"
              value={tag}
              onChange={e => setTag(e.target.value)}
              placeholder="如 latest、v1.2.0"
            />
          </div>

          <Button
            onClick={handleValidate}
            disabled={!tag.trim() || validating}
            variant="outline"
            className="w-full"
          >
            {validating && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
            查询
          </Button>

          {error && <p className="text-sm text-red-500">{error}</p>}

          {preview && (
            <Card className="bg-gray-50">
              <CardContent className="pt-4 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Tag:</span>
                  <span className="font-medium">{preview.tag}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Digest:</span>
                  <span className="font-mono">{preview.digest.replace('sha256:', '').slice(0, 12)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">架构:</span>
                  <span>{preview.os}/{preview.architecture}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">大小:</span>
                  <span>{formatSize(preview.compressedSize)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">推送时间:</span>
                  <span>{new Date(preview.pushedAt).toLocaleDateString()}</span>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>取消</Button>
          <Button
            onClick={handleImport}
            disabled={!preview || importing}
          >
            {importing && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
            确认导入
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
```

- [ ] **Step 2: Commit import dialog component**

```bash
git add components/import-image-dialog.tsx
git commit -m "feat: add ImportImageDialog component

- Two-step flow: validate tag first, then confirm import
- Preview card shows digest, size, architecture
- Links to Docker Hub for tag reference
- Error handling for validation and import failures

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

### Task 10: Create Delete Image Dialog

**Files:**
- Create: `components/delete-image-dialog.tsx`

- [ ] **Step 1: Create delete dialog component**

Create `components/delete-image-dialog.tsx`:

```typescript
'use client'
import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { AlertTriangle, Loader2 } from 'lucide-react'

interface Props {
  imageId: string | null
  isActive: boolean
  onClose: () => void
  onDeleted: () => void
}

export function DeleteImageDialog({ imageId, isActive, onClose, onDeleted }: Props) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [confirmStep, setConfirmStep] = useState(0) // 0: initial, 1: second confirm for active

  useEffect(() => {
    if (imageId) {
      setConfirmStep(0)
      setError('')
    }
  }, [imageId])

  async function handleDelete() {
    if (!imageId) return

    // For active images, require second confirmation
    if (isActive && confirmStep === 0) {
      setConfirmStep(1)
      return
    }

    setLoading(true)
    setError('')

    try {
      const res = await fetch(`/api/images/${imageId}`, { method: 'DELETE' })
      const data = await res.json()

      if (!res.ok) {
        setError(data.error || '删除失败')
      } else {
        onDeleted()
        onClose()
      }
    } catch {
      setError('网络错误，请稍后重试')
    } finally {
      setLoading(false)
      setConfirmStep(0)
    }
  }

  function handleClose() {
    setConfirmStep(0)
    setError('')
    onClose()
  }

  if (!imageId) return null

  return (
    <Dialog open={imageId !== null} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isActive && <AlertTriangle className="w-5 h-5 text-red-500" />}
            删除镜像
          </DialogTitle>
          <DialogDescription>
            {isActive && confirmStep === 0
              ? '该镜像当前生效，删除后将无生效镜像，新建 OpenClaw 可能失败，请谨慎操作'
              : '删除后数据将无法恢复'}
          </DialogDescription>
        </DialogHeader>

        {isActive && confirmStep === 0 && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
            <p className="font-medium">风险警告</p>
            <p className="mt-1">该镜像当前生效，删除后将无生效镜像，新建 OpenClaw 可能失败，请谨慎操作</p>
          </div>
        )}

        {error && <p className="text-sm text-red-500">{error}</p>}

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            取消
          </Button>
          <Button
            variant={isActive && confirmStep === 0 ? 'destructive' : 'default'}
            onClick={handleDelete}
            disabled={loading}
          >
            {loading && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
            {isActive && confirmStep === 0 ? '确认删除（需二次确认）' : '确认删除'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
```

- [ ] **Step 2: Commit delete dialog component**

```bash
git add components/delete-image-dialog.tsx
git commit -m "feat: add DeleteImageDialog component

- Single confirmation for normal images
- Two-step confirmation for active images with red warning
- Risk warning banner for active image deletion

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

### Task 11: Create Image Management Page

**Files:**
- Create: `app/(dashboard)/settings/images/page.tsx`

- [ ] **Step 1: Create images page**

Create `app/(dashboard)/settings/images/page.tsx`:

```typescript
'use client'
import { useEffect, useState, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Plus } from 'lucide-react'
import { ImageListTable, ImageRow } from '@/components/image-list-table'
import { ImportImageDialog } from '@/components/import-image-dialog'
import { DeleteImageDialog } from '@/components/delete-image-dialog'
import { toast } from 'sonner'

export default function ImagesPage() {
  const { data: session } = useSession()
  const router = useRouter()
  const [images, setImages] = useState<ImageRow[]>([])
  const [loading, setLoading] = useState(true)
  const [importOpen, setImportOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; isActive: boolean } | null>(null)

  const fetchImages = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/images')
      if (res.ok) {
        const data = await res.json()
        setImages(data.images)
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (session && (session.user as any)?.role !== 'admin') {
      router.replace('/')
    }
    if (session) {
      fetchImages()
    }
  }, [session, router, fetchImages])

  async function handleActivate(id: string) {
    const res = await fetch(`/api/images/${id}/activate`, { method: 'PATCH' })
    if (res.ok) {
      toast.success('已设置为生效镜像')
      fetchImages()
    } else {
      const data = await res.json()
      toast.error(data.error || '设置失败')
    }
  }

  function handleDeleteClick(id: string) {
    const image = images.find(img => img.id === id)
    if (image) {
      setDeleteTarget({ id, isActive: image.isActive })
    }
  }

  if (!session) return null

  return (
    <div className="max-w-4xl space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">镜像管理</h2>
        <Button size="sm" onClick={() => setImportOpen(true)}>
          <Plus className="w-4 h-4 mr-1" />
          导入镜像
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">已导入镜像</CardTitle>
        </CardHeader>
        <CardContent>
          <ImageListTable
            images={images}
            loading={loading}
            onActivate={handleActivate}
            onDelete={handleDeleteClick}
          />
        </CardContent>
      </Card>

      <ImportImageDialog
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onImported={fetchImages}
      />

      <DeleteImageDialog
        imageId={deleteTarget?.id}
        isActive={deleteTarget?.isActive ?? false}
        onClose={() => setDeleteTarget(null)}
        onDeleted={() => {
          toast.success('镜像已删除')
          fetchImages()
        }}
      />
    </div>
  )
}
```

- [ ] **Step 2: Commit images page**

```bash
git add app/(dashboard)/settings/images/page.tsx
git commit -m "feat: add /settings/images page for image management

- Admin-only page with image list table
- Import and delete dialogs
- Toast notifications for actions

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

### Task 12: Update Dashboard Navigation

**Files:**
- Modify: `app/(dashboard)/layout.tsx`

- [ ] **Step 1: Add images nav link to dashboard layout**

Modify `app/(dashboard)/layout.tsx` - update the navigation section:

```typescript
          <nav className="flex gap-4 text-sm">
            <Link href="/instances" className="text-gray-600 hover:text-gray-900">实例</Link>
            {(session.user as any).role === 'admin' && (
              <>
                <Link href="/settings/images" className="text-gray-600 hover:text-gray-900">镜像</Link>
                <Link href="/settings/users" className="text-gray-600 hover:text-gray-900">用户</Link>
              </>
            )}
          </nav>
```

- [ ] **Step 2: Commit navigation update**

```bash
git add app/(dashboard)/layout.tsx
git commit -m "feat: add images nav link in dashboard layout

- Admin-only '镜像' link for image management page

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

### Task 13: Update Instance Creation with Active Image

**Files:**
- Modify: `app/(dashboard)/instances/new/page.tsx`
- Modify: `app/api/instances/route.ts`

- [ ] **Step 1: Update instance creation page to fetch active image**

Modify `app/(dashboard)/instances/new/page.tsx`:

```typescript
'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { PROVIDERS } from '@/lib/validations'
import { AlertTriangle } from 'lucide-react'

interface ActiveImage {
  repository: string
  tag: string
}

export default function NewInstancePage() {
  const router = useRouter()
  const [activeImage, setActiveImage] = useState<ActiveImage | null>(null)
  const [noActiveImage, setNoActiveImage] = useState(false)
  const [form, setForm] = useState({
    name: '', imageTag: '', port: '18789',
    provider: 'deepseek', model: '', apiKey: '', baseUrl: '',
    bindAddress: '127.0.0.1', allowedOrigin: '', cpuLimit: '2', memoryLimit: '2G',
  })
  const [error, setError] = useState('')
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    // Fetch active image on mount
    fetch('/api/images?limit=1')
      .then(res => res.json())
      .then(data => {
        const active = data.images?.find((img: any) => img.isActive)
        if (active) {
          setActiveImage({ repository: active.repository, tag: active.tag })
          setForm(f => ({ ...f, imageTag: `${active.repository}:${active.tag}` }))
        } else {
          setNoActiveImage(true)
        }
      })
      .catch(() => setNoActiveImage(true))
  }, [])

  function set(key: string, val: string) { setForm(f => ({ ...f, [key]: val })) }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (noActiveImage && !form.imageTag) {
      setError('请先在镜像管理中设置生效镜像')
      return
    }
    setCreating(true)
    setError('')
    const payload = {
      ...form,
      port: parseInt(form.port),
      cpuLimit: parseFloat(form.cpuLimit),
      baseUrl: form.baseUrl || undefined,
      allowedOrigin: form.allowedOrigin || undefined,
    }
    const res = await fetch('/api/instances', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    if (res.ok) {
      router.push('/')
    } else {
      const data = await res.json()
      setError(typeof data.error === 'string' ? data.error : '创建失败，请检查输入')
      setCreating(false)
    }
  }

  return (
    <div className="max-w-xl mx-auto">
      {noActiveImage && (
        <div className="mb-4 bg-yellow-50 border border-yellow-200 rounded-lg p-3 flex items-start gap-2">
          <AlertTriangle className="w-5 h-5 text-yellow-600 mt-0.5" />
          <div className="text-sm">
            <p className="font-medium text-yellow-700">无生效镜像</p>
            <p className="text-yellow-600">请先在镜像管理中设置生效镜像，或手动填写镜像 Tag</p>
          </div>
        </div>
      )}
      <Card>
        <CardHeader><CardTitle>新建 OpenClaw 实例</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label htmlFor="name">实例名（小写字母/数字/横杠）</Label>
                <Input
                  id="name"
                  value={form.name}
                  onChange={e => set('name', e.target.value)}
                  placeholder="my-instance"
                  pattern="[a-z0-9-]+"
                  required
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="port">端口</Label>
                <Input
                  id="port"
                  type="number"
                  value={form.port}
                  onChange={e => set('port', e.target.value)}
                  min={1024}
                  max={65535}
                  required
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label>提供商</Label>
              <Select value={form.provider} onValueChange={v => set('provider', v ?? '')}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PROVIDERS.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label htmlFor="model">模型名</Label>
                <Input
                  id="model"
                  value={form.model}
                  onChange={e => set('model', e.target.value)}
                  placeholder="deepseek-chat"
                  required
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="apiKey">API Key</Label>
                <Input
                  id="apiKey"
                  type="password"
                  value={form.apiKey}
                  onChange={e => set('apiKey', e.target.value)}
                  required
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label htmlFor="baseUrl">Base URL（可选，用于 Ollama 等）</Label>
              <Input
                id="baseUrl"
                value={form.baseUrl}
                onChange={e => set('baseUrl', e.target.value)}
                placeholder="http://localhost:11434"
              />
            </div>
            <details className="text-sm">
              <summary className="cursor-pointer text-gray-500 hover:text-gray-700">高级选项</summary>
              <div className="mt-3 space-y-4 pl-2 border-l-2 border-gray-100">
                <div className="space-y-1">
                  <Label htmlFor="imageTag">镜像 Tag</Label>
                  <Input 
                    id="imageTag" 
                    value={form.imageTag} 
                    onChange={e => set('imageTag', e.target.value)} 
                    placeholder={activeImage ? `${activeImage.repository}:${activeImage.tag}` : 'openclaw/openclaw:latest'}
                  />
                  {activeImage && (
                    <p className="text-xs text-gray-400">当前生效镜像: {activeImage.repository}:{activeImage.tag}</p>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <Label htmlFor="cpuLimit">CPU 上限</Label>
                    <Input
                      id="cpuLimit"
                      type="number"
                      step="0.5"
                      value={form.cpuLimit}
                      onChange={e => set('cpuLimit', e.target.value)}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="memoryLimit">内存上限</Label>
                    <Input
                      id="memoryLimit"
                      value={form.memoryLimit}
                      onChange={e => set('memoryLimit', e.target.value)}
                      placeholder="2G"
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <Label>绑定地址</Label>
                  <Select value={form.bindAddress} onValueChange={v => set('bindAddress', v ?? '')}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="127.0.0.1">127.0.0.1（仅本机）</SelectItem>
                      <SelectItem value="0.0.0.0">0.0.0.0（局域网）</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="allowedOrigin">外部访问地址（可选 HTTPS URL）</Label>
                  <Input
                    id="allowedOrigin"
                    value={form.allowedOrigin}
                    onChange={e => set('allowedOrigin', e.target.value)}
                    placeholder="https://my-domain.com"
                  />
                </div>
              </div>
            </details>
            {error && <p className="text-sm text-red-500">{error}</p>}
            <div className="flex gap-3 pt-2">
              <Button type="button" variant="outline" onClick={() => router.back()}>取消</Button>
              <Button type="submit" disabled={creating} className="flex-1">
                {creating ? '创建中...' : '创建实例'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
```

- [ ] **Step 2: Update instance API to check for active image**

Modify `app/api/instances/route.ts` - add active image check before creating:

Add import at top:
```typescript
import { prisma } from '@/lib/db'
```

Add check before creating instance (after `const parsed = createInstanceSchema.safeParse(body)`):

```typescript
  // Check if imageTag is provided or active image exists
  if (!parsed.data.imageTag || parsed.data.imageTag === '1panel/openclaw:2026.5.7') {
    const activeImage = await prisma.image.findFirst({ where: { isActive: true } })
    if (!activeImage && !parsed.data.imageTag) {
      return NextResponse.json({ error: '请先在镜像管理中设置生效镜像' }, { status: 400 })
    }
    // Use active image if not explicitly provided
    if (activeImage && !parsed.data.imageTag) {
      parsed.data.imageTag = `${activeImage.repository}:${activeImage.tag}`
    }
  }
```

Update the `createInstanceSchema` in `lib/validations.ts` to make `imageTag` optional with no default:

```typescript
  imageTag: z.string().min(1).optional(),
```

- [ ] **Step 3: Commit instance creation integration**

```bash
git add app/(dashboard)/instances/new/page.tsx app/api/instances/route.ts lib/validations.ts
git commit -m "feat: integrate active image with instance creation

- New instance page fetches and uses active image by default
- Warning banner when no active image is set
- Instance API checks for active image before creation
- imageTag field is now optional in validation schema

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

### Task 14: Run Full Test Suite

- [ ] **Step 1: Run all tests to verify integration**

Run:
```bash
npm test
```

Expected: All tests pass.

- [ ] **Step 2: Fix any failing tests**

If tests fail, fix the issues and re-run.

---

### Task 15: Manual Functional Testing

- [ ] **Step 1: Start development server**

Run:
```bash
npm run dev
```

- [ ] **Step 2: Test image management flow**

1. Login as admin
2. Navigate to "镜像" page
3. Import an image tag (e.g., "latest")
4. Verify it appears in the list
5. Set as active image
6. Delete the image and verify warning

- [ ] **Step 3: Test instance creation integration**

1. Create new instance
2. Verify active image is used as default
3. Test creating instance with no active image (warning)

- [ ] **Step 4: Verify all API endpoints work**

- GET /api/images - list images
- POST /api/images - import image
- PATCH /api/images/[id]/activate - set active
- DELETE /api/images/[id] - delete image
- POST /api/images/validate - validate tag

---

### Task 16: Final Commit and Summary

- [ ] **Step 1: Run final test suite**

```bash
npm test
```

- [ ] **Step 2: Create summary commit if needed**

```bash
git status
git add -A
git commit -m "feat: complete image management module

- Image and AuditLog models for tracking imported images
- Docker Hub API integration with caching
- 5 API endpoints for CRUD operations
- UI components for list, import, delete dialogs
- Integration with instance creation flow
- Navigation update with admin-only '镜像' link

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```