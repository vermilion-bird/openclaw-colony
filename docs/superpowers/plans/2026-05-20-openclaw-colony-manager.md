# OpenClaw Colony Manager Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Next.js web app that manages multiple OpenClaw AI gateway instances via Docker, supporting create/delete/start/stop/configure operations with multi-user auth.

**Architecture:** Single Next.js 14 App Router container; API Routes call dockerode SDK via mounted `/var/run/docker.sock`; Prisma + SQLite stores instance metadata; NextAuth.js Credentials handles JWT-based multi-user auth with admin/operator roles.

**Tech Stack:** Next.js 14 (App Router), TypeScript, dockerode, Prisma (SQLite), NextAuth.js, Tailwind CSS, shadcn/ui, Zod, bcryptjs, Vitest

---

## File Map

| File | Responsibility |
|------|---------------|
| `openclaw-colony/prisma/schema.prisma` | DB schema: User, Instance, InstanceStatus enum |
| `openclaw-colony/lib/db.ts` | Prisma client singleton |
| `openclaw-colony/lib/crypto.ts` | AES-256-GCM encrypt/decrypt for API keys |
| `openclaw-colony/lib/docker.ts` | dockerode wrapper: create/start/stop/restart/remove/logs/stats |
| `openclaw-colony/lib/auth.ts` | NextAuth.js config (Credentials provider, JWT callbacks) |
| `openclaw-colony/lib/validations.ts` | Zod schemas for all API inputs |
| `openclaw-colony/middleware.ts` | Route protection: redirect unauthenticated users to /login |
| `openclaw-colony/app/(auth)/login/page.tsx` | Login form page |
| `openclaw-colony/app/(auth)/setup/page.tsx` | First-run admin account creation |
| `openclaw-colony/app/(dashboard)/layout.tsx` | Authenticated shell with nav sidebar |
| `openclaw-colony/app/(dashboard)/page.tsx` | Instance dashboard (card grid, auto-refresh) |
| `openclaw-colony/app/(dashboard)/instances/new/page.tsx` | Create instance form |
| `openclaw-colony/app/(dashboard)/instances/[id]/page.tsx` | Instance detail: stats chart, config, logs |
| `openclaw-colony/app/(dashboard)/settings/users/page.tsx` | User management (admin only) |
| `openclaw-colony/app/api/auth/[...nextauth]/route.ts` | NextAuth endpoint |
| `openclaw-colony/app/api/instances/route.ts` | GET list, POST create |
| `openclaw-colony/app/api/instances/[id]/route.ts` | GET detail, DELETE |
| `openclaw-colony/app/api/instances/[id]/start/route.ts` | POST start |
| `openclaw-colony/app/api/instances/[id]/stop/route.ts` | POST stop |
| `openclaw-colony/app/api/instances/[id]/restart/route.ts` | POST restart |
| `openclaw-colony/app/api/instances/[id]/config/route.ts` | PUT update config (triggers container recreation) |
| `openclaw-colony/app/api/instances/[id]/logs/route.ts` | GET SSE log stream |
| `openclaw-colony/app/api/instances/[id]/stats/route.ts` | GET resource snapshot |
| `openclaw-colony/app/api/instances/[id]/token/route.ts` | GET OpenClaw auth token |
| `openclaw-colony/app/api/setup/route.ts` | POST create first admin (blocked after first user exists) |
| `openclaw-colony/app/api/users/route.ts` | GET list, POST create (admin) |
| `openclaw-colony/app/api/users/[id]/route.ts` | PUT role, DELETE (admin) |
| `openclaw-colony/components/instance-card.tsx` | Card with status badge, mini metrics, action buttons |
| `openclaw-colony/components/instance-form.tsx` | Controlled form for create/edit instance |
| `openclaw-colony/components/log-viewer.tsx` | SSE-connected log dialog with auto-scroll |
| `openclaw-colony/components/stats-chart.tsx` | Recharts line chart for CPU/memory history |
| `openclaw-colony/components/delete-instance-dialog.tsx` | Confirm dialog with "delete data" checkbox |
| `openclaw-colony/components/edit-config-sheet.tsx` | Slide-in sheet for editing instance env vars |
| `openclaw-colony/Dockerfile` | Multi-stage Next.js standalone build |
| `openclaw-colony/docker-compose.yml` | Colony Manager service with docker.sock mount |
| `openclaw-colony/.env.example` | Template for required env vars |

---

## Task 1: Project Scaffold

**Files:**
- Create: `openclaw-colony/package.json`
- Create: `openclaw-colony/tsconfig.json`
- Create: `openclaw-colony/next.config.ts`
- Create: `openclaw-colony/tailwind.config.ts`
- Create: `openclaw-colony/vitest.config.ts`
- Create: `openclaw-colony/.env.example`
- Create: `openclaw-colony/.env.local`

- [ ] **Step 1: Initialize Next.js project**

```bash
cd /Users/caidongzhu/Developer/work/bv_openclaw_colony
npx create-next-app@latest openclaw-colony \
  --typescript \
  --tailwind \
  --app \
  --src-dir=false \
  --import-alias="@/*" \
  --no-eslint
cd openclaw-colony
```

- [ ] **Step 2: Install dependencies**

```bash
npm install \
  next-auth@beta \
  @auth/prisma-adapter \
  @prisma/client \
  prisma \
  dockerode \
  bcryptjs \
  zod \
  recharts \
  lucide-react \
  clsx \
  tailwind-merge

npm install -D \
  @types/dockerode \
  @types/bcryptjs \
  vitest \
  @vitejs/plugin-react \
  @vitest/coverage-v8 \
  happy-dom
```

- [ ] **Step 3: Install shadcn/ui**

```bash
npx shadcn@latest init --defaults
npx shadcn@latest add button card badge input label select sheet dialog checkbox toast
```

- [ ] **Step 4: Create `vitest.config.ts`**

```typescript
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'happy-dom',
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
  },
  resolve: {
    alias: { '@': path.resolve(__dirname, '.') },
  },
})
```

- [ ] **Step 5: Create `vitest.setup.ts`**

```typescript
import { vi } from 'vitest'
// Silence Next.js internals in tests
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  redirect: vi.fn(),
}))
```

- [ ] **Step 6: Create `.env.example`**

```bash
cat > .env.example << 'EOF'
# NextAuth
NEXTAUTH_SECRET=change-me-to-a-random-32-char-string
NEXTAUTH_URL=http://localhost:3000

# Database
DATABASE_URL=file:./data/colony.db

# Encryption key for stored API keys (32 bytes hex = 64 hex chars)
ENCRYPTION_KEY=change-me-to-64-hex-chars

# Docker data root on the HOST machine (mounted into the container)
DATA_ROOT=/app/data/instances

# Host IP used to generate OpenClaw panel links
HOST_IP=127.0.0.1
EOF
```

- [ ] **Step 7: Create `.env.local` for local dev**

```bash
cp .env.example .env.local
# Then edit to set:
# NEXTAUTH_SECRET=$(openssl rand -base64 32)
# ENCRYPTION_KEY=$(openssl rand -hex 32)
# DATA_ROOT=./data/instances
```

- [ ] **Step 8: Update `next.config.ts` for standalone output**

```typescript
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  output: 'standalone',
}

export default nextConfig
```

- [ ] **Step 9: Run dev server to verify scaffold**

```bash
npm run dev
```
Expected: Server running on http://localhost:3000 with default Next.js page.

- [ ] **Step 10: Commit**

```bash
git add openclaw-colony
git commit -m "feat(colony): initialize Next.js project scaffold"
```

---

## Task 2: Prisma Schema & Database

**Files:**
- Create: `openclaw-colony/prisma/schema.prisma`
- Create: `openclaw-colony/lib/db.ts`
- Test: `openclaw-colony/tests/lib/db.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// tests/lib/db.test.ts
import { describe, it, expect } from 'vitest'
import { prisma } from '@/lib/db'

describe('prisma singleton', () => {
  it('exports a PrismaClient instance', () => {
    expect(prisma).toBeDefined()
    expect(typeof prisma.user.findMany).toBe('function')
    expect(typeof prisma.instance.findMany).toBe('function')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run tests/lib/db.test.ts
```
Expected: FAIL — cannot find module `@/lib/db`

- [ ] **Step 3: Write `prisma/schema.prisma`**

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "sqlite"
  url      = env("DATABASE_URL")
}

enum Role {
  admin
  operator
}

enum InstanceStatus {
  creating
  running
  stopped
  unhealthy
  error
}

model User {
  id           String    @id @default(cuid())
  email        String    @unique
  passwordHash String
  role         Role      @default(operator)
  createdAt    DateTime  @default(now())
  instances    Instance[]
}

model Instance {
  id            String         @id @default(cuid())
  name          String         @unique
  containerId   String?
  imageTag      String         @default("1panel/openclaw:2026.5.7")
  port          Int            @unique
  provider      String
  model         String
  apiKey        String
  baseUrl       String?
  bindAddress   String         @default("127.0.0.1")
  allowedOrigin String?
  cpuLimit      Float          @default(2.0)
  memoryLimit   String         @default("2G")
  dataDir       String?
  status        InstanceStatus @default(creating)
  createdAt     DateTime       @default(now())
  createdBy     String
  creator       User           @relation(fields: [createdBy], references: [id])
}
```

- [ ] **Step 4: Run migration**

```bash
mkdir -p data
npx prisma migrate dev --name init
```
Expected: Migration applied, `prisma/migrations/` created.

- [ ] **Step 5: Generate Prisma client**

```bash
npx prisma generate
```

- [ ] **Step 6: Write `lib/db.ts`**

```typescript
import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient }

export const prisma = globalForPrisma.prisma ?? new PrismaClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
```

- [ ] **Step 7: Run test to verify it passes**

```bash
npx vitest run tests/lib/db.test.ts
```
Expected: PASS

- [ ] **Step 8: Commit**

```bash
git add prisma/ lib/db.ts tests/lib/db.test.ts data/.gitkeep
git commit -m "feat(colony): add Prisma schema and DB singleton"
```

---

## Task 3: Crypto Library

**Files:**
- Create: `openclaw-colony/lib/crypto.ts`
- Test: `openclaw-colony/tests/lib/crypto.test.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
// tests/lib/crypto.test.ts
import { describe, it, expect, beforeAll } from 'vitest'

// Set env before importing the module
beforeAll(() => {
  process.env.ENCRYPTION_KEY = 'a'.repeat(64) // 64 hex chars = 32 bytes
})

const { encrypt, decrypt } = await import('@/lib/crypto')

describe('crypto', () => {
  it('encrypts and decrypts a string', () => {
    const plain = 'sk-my-secret-api-key'
    const ciphertext = encrypt(plain)
    expect(ciphertext).not.toBe(plain)
    expect(decrypt(ciphertext)).toBe(plain)
  })

  it('produces different ciphertext each call (random IV)', () => {
    const plain = 'same-input'
    expect(encrypt(plain)).not.toBe(encrypt(plain))
  })

  it('throws on wrong key for decrypt', () => {
    const ciphertext = encrypt('hello')
    process.env.ENCRYPTION_KEY = 'b'.repeat(64)
    expect(() => decrypt(ciphertext)).toThrow()
    process.env.ENCRYPTION_KEY = 'a'.repeat(64)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run tests/lib/crypto.test.ts
```
Expected: FAIL — cannot find module `@/lib/crypto`

- [ ] **Step 3: Write `lib/crypto.ts`**

```typescript
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto'

function getKey(): Buffer {
  const hex = process.env.ENCRYPTION_KEY
  if (!hex || hex.length !== 64) throw new Error('ENCRYPTION_KEY must be 64 hex chars')
  return Buffer.from(hex, 'hex')
}

export function encrypt(plaintext: string): string {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', getKey(), iv)
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return Buffer.concat([iv, tag, encrypted]).toString('base64')
}

export function decrypt(ciphertext: string): string {
  const buf = Buffer.from(ciphertext, 'base64')
  const iv = buf.subarray(0, 12)
  const tag = buf.subarray(12, 28)
  const encrypted = buf.subarray(28)
  const decipher = createDecipheriv('aes-256-gcm', getKey(), iv)
  decipher.setAuthTag(tag)
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8')
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run tests/lib/crypto.test.ts
```
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add lib/crypto.ts tests/lib/crypto.test.ts
git commit -m "feat(colony): add AES-256-GCM crypto utils"
```

---

## Task 4: Docker Wrapper Library

**Files:**
- Create: `openclaw-colony/lib/docker.ts`
- Test: `openclaw-colony/tests/lib/docker.test.ts`

- [ ] **Step 1: Write failing tests (unit — mock dockerode)**

```typescript
// tests/lib/docker.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock dockerode before importing docker.ts
vi.mock('dockerode', () => {
  const mockContainer = {
    start: vi.fn().mockResolvedValue(undefined),
    stop: vi.fn().mockResolvedValue(undefined),
    restart: vi.fn().mockResolvedValue(undefined),
    remove: vi.fn().mockResolvedValue(undefined),
    inspect: vi.fn().mockResolvedValue({ State: { Status: 'running' } }),
    stats: vi.fn().mockResolvedValue({
      cpu_stats: { cpu_usage: { total_usage: 2000000000 }, system_cpu_usage: 10000000000, online_cpus: 4 },
      precpu_stats: { cpu_usage: { total_usage: 1000000000 }, system_cpu_usage: 9000000000 },
      memory_stats: { usage: 524288000, limit: 2147483648 },
    }),
  }
  return {
    default: vi.fn().mockImplementation(() => ({
      createContainer: vi.fn().mockResolvedValue({ id: 'abc123', ...mockContainer }),
      getContainer: vi.fn().mockReturnValue(mockContainer),
      ping: vi.fn().mockResolvedValue('OK'),
    })),
  }
})

const { getDockerClient, createOpenClawContainer, startContainer, stopContainer, getContainerStats } = await import('@/lib/docker')

describe('docker wrapper', () => {
  it('getDockerClient returns dockerode instance', () => {
    expect(getDockerClient()).toBeDefined()
  })

  it('createOpenClawContainer calls docker.createContainer with correct spec', async () => {
    const docker = getDockerClient()
    const result = await createOpenClawContainer({
      name: 'test-instance',
      imageTag: '1panel/openclaw:2026.5.7',
      port: 18789,
      provider: 'deepseek',
      model: 'deepseek-chat',
      apiKey: 'sk-test',
      baseUrl: undefined,
      bindAddress: '127.0.0.1',
      allowedOrigin: undefined,
      cpuLimit: 2,
      memoryLimit: '2G',
      dataDir: '/data/instances/test-instance',
    })
    expect(docker.createContainer).toHaveBeenCalled()
    expect(result.id).toBe('abc123')
  })

  it('startContainer calls container.start', async () => {
    const docker = getDockerClient()
    await startContainer('abc123')
    expect(docker.getContainer('abc123').start).toHaveBeenCalled()
  })

  it('stopContainer calls container.stop with timeout', async () => {
    const docker = getDockerClient()
    await stopContainer('abc123')
    expect(docker.getContainer('abc123').stop).toHaveBeenCalled()
  })

  it('getContainerStats returns cpu and memory percentages', async () => {
    const stats = await getContainerStats('abc123')
    expect(stats.cpuPercent).toBeTypeOf('number')
    expect(stats.memUsedMb).toBeTypeOf('number')
    expect(stats.memLimitMb).toBeTypeOf('number')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run tests/lib/docker.test.ts
```
Expected: FAIL — cannot find module `@/lib/docker`

- [ ] **Step 3: Write `lib/docker.ts`**

```typescript
import Dockerode from 'dockerode'

let _docker: Dockerode | null = null

export function getDockerClient(): Dockerode {
  if (!_docker) _docker = new Dockerode({ socketPath: '/var/run/docker.sock' })
  return _docker
}

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
}

function parseMemoryBytes(mem: string): number {
  const match = mem.match(/^(\d+(?:\.\d+)?)\s*([GgMmKk]?)$/)
  if (!match) throw new Error(`Invalid memory format: ${mem}`)
  const num = parseFloat(match[1])
  const unit = match[2].toUpperCase()
  if (unit === 'G') return Math.floor(num * 1024 * 1024 * 1024)
  if (unit === 'M') return Math.floor(num * 1024 * 1024)
  if (unit === 'K') return Math.floor(num * 1024)
  return Math.floor(num)
}

export async function createOpenClawContainer(opts: CreateContainerOptions) {
  const docker = getDockerClient()
  const env: string[] = [
    `PROVIDER=${opts.provider}`,
    `MODEL=${opts.model}`,
    `API_KEY=${opts.apiKey}`,
  ]
  if (opts.baseUrl) env.push(`BASE_URL=${opts.baseUrl}`)
  if (opts.allowedOrigin) env.push(`ALLOWED_ORIGIN=${opts.allowedOrigin}`)

  const container = await docker.createContainer({
    name: `openclaw-${opts.name}`,
    Image: opts.imageTag,
    Env: env,
    Labels: { 'openclaw.managed': 'true', 'openclaw.instance': opts.name },
    HostConfig: {
      PortBindings: { '18789/tcp': [{ HostIp: opts.bindAddress, HostPort: String(opts.port) }] },
      Binds: [
        `${opts.dataDir}/conf:/home/node/.openclaw`,
        `${opts.dataDir}/workspace:/home/node/.openclaw/workspace`,
        `/etc/localtime:/etc/localtime:ro`,
      ],
      NanoCpus: Math.floor(opts.cpuLimit * 1e9),
      Memory: parseMemoryBytes(opts.memoryLimit),
      RestartPolicy: { Name: 'unless-stopped' },
    },
  })
  return container
}

export async function startContainer(containerId: string): Promise<void> {
  await getDockerClient().getContainer(containerId).start()
}

export async function stopContainer(containerId: string): Promise<void> {
  await getDockerClient().getContainer(containerId).stop({ t: 30 })
}

export async function restartContainer(containerId: string): Promise<void> {
  await getDockerClient().getContainer(containerId).restart({ t: 30 })
}

export async function removeContainer(containerId: string): Promise<void> {
  await getDockerClient().getContainer(containerId).remove({ force: true })
}

export async function getContainerStatus(containerId: string): Promise<string> {
  const info = await getDockerClient().getContainer(containerId).inspect()
  return info.State.Status // running | exited | created | restarting | ...
}

export interface ContainerStats {
  cpuPercent: number
  memUsedMb: number
  memLimitMb: number
}

export async function getContainerStats(containerId: string): Promise<ContainerStats> {
  const raw = await getDockerClient().getContainer(containerId).stats({ stream: false }) as any
  const cpuDelta = raw.cpu_stats.cpu_usage.total_usage - raw.precpu_stats.cpu_usage.total_usage
  const sysDelta = raw.cpu_stats.system_cpu_usage - raw.precpu_stats.system_cpu_usage
  const cpus = raw.cpu_stats.online_cpus ?? 1
  const cpuPercent = sysDelta > 0 ? (cpuDelta / sysDelta) * cpus * 100 : 0
  return {
    cpuPercent: Math.round(cpuPercent * 10) / 10,
    memUsedMb: Math.round(raw.memory_stats.usage / 1024 / 1024),
    memLimitMb: Math.round(raw.memory_stats.limit / 1024 / 1024),
  }
}

export async function pingDocker(): Promise<boolean> {
  try {
    await getDockerClient().ping()
    return true
  } catch {
    return false
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run tests/lib/docker.test.ts
```
Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add lib/docker.ts tests/lib/docker.test.ts
git commit -m "feat(colony): add dockerode wrapper with container lifecycle ops"
```

---

## Task 5: Auth System

**Files:**
- Create: `openclaw-colony/lib/auth.ts`
- Create: `openclaw-colony/middleware.ts`
- Create: `openclaw-colony/app/api/auth/[...nextauth]/route.ts`
- Create: `openclaw-colony/app/api/setup/route.ts`
- Create: `openclaw-colony/app/(auth)/login/page.tsx`
- Create: `openclaw-colony/app/(auth)/setup/page.tsx`
- Test: `openclaw-colony/tests/api/setup.test.ts`

- [ ] **Step 1: Write failing test for setup API**

```typescript
// tests/api/setup.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/db', () => ({
  prisma: {
    user: {
      count: vi.fn(),
      create: vi.fn(),
    },
  },
}))

const { POST } = await import('@/app/api/setup/route')
import { prisma } from '@/lib/db'

describe('POST /api/setup', () => {
  beforeEach(() => vi.clearAllMocks())

  it('creates first admin when no users exist', async () => {
    vi.mocked(prisma.user.count).mockResolvedValue(0)
    vi.mocked(prisma.user.create).mockResolvedValue({ id: '1', email: 'admin@test.com', role: 'admin' } as any)

    const req = new NextRequest('http://localhost/api/setup', {
      method: 'POST',
      body: JSON.stringify({ email: 'admin@test.com', password: 'password123' }),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req)
    expect(res.status).toBe(201)
  })

  it('returns 409 if users already exist', async () => {
    vi.mocked(prisma.user.count).mockResolvedValue(1)
    const req = new NextRequest('http://localhost/api/setup', {
      method: 'POST',
      body: JSON.stringify({ email: 'admin@test.com', password: 'password123' }),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req)
    expect(res.status).toBe(409)
  })

  it('returns 400 on invalid input', async () => {
    vi.mocked(prisma.user.count).mockResolvedValue(0)
    const req = new NextRequest('http://localhost/api/setup', {
      method: 'POST',
      body: JSON.stringify({ email: 'not-an-email', password: '123' }),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run tests/api/setup.test.ts
```
Expected: FAIL

- [ ] **Step 3: Write `lib/auth.ts`**

```typescript
import NextAuth from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import { prisma } from '@/lib/db'
import bcrypt from 'bcryptjs'
import type { NextAuthConfig } from 'next-auth'

export const authConfig: NextAuthConfig = {
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null
        const user = await prisma.user.findUnique({ where: { email: String(credentials.email) } })
        if (!user) return null
        const valid = await bcrypt.compare(String(credentials.password), user.passwordHash)
        if (!valid) return null
        return { id: user.id, email: user.email, role: user.role }
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.id = user.id
        token.role = (user as any).role
      }
      return token
    },
    session({ session, token }) {
      session.user.id = token.id as string
      session.user.role = token.role as string
      return session
    },
  },
  pages: { signIn: '/login' },
  session: { strategy: 'jwt', maxAge: 7 * 24 * 60 * 60 },
}

export const { handlers, auth, signIn, signOut } = NextAuth(authConfig)
```

- [ ] **Step 4: Write `app/api/auth/[...nextauth]/route.ts`**

```typescript
import { handlers } from '@/lib/auth'
export const { GET, POST } = handlers
```

- [ ] **Step 5: Write `app/api/setup/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import bcrypt from 'bcryptjs'
import { z } from 'zod'

const setupSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
})

export async function POST(req: NextRequest) {
  const count = await prisma.user.count()
  if (count > 0) return NextResponse.json({ error: 'Setup already complete' }, { status: 409 })

  const body = await req.json()
  const parsed = setupSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const passwordHash = await bcrypt.hash(parsed.data.password, 12)
  const user = await prisma.user.create({
    data: { email: parsed.data.email, passwordHash, role: 'admin' },
  })
  return NextResponse.json({ id: user.id, email: user.email }, { status: 201 })
}
```

- [ ] **Step 6: Write `middleware.ts`**

```typescript
import { auth } from '@/lib/auth'
import { NextResponse } from 'next/server'

export default auth(async (req) => {
  const { pathname } = req.nextUrl

  // Always allow auth and setup routes
  if (pathname.startsWith('/login') || pathname.startsWith('/api/auth') || pathname.startsWith('/api/setup')) {
    return NextResponse.next()
  }

  // Redirect to setup if no users exist
  const res = await fetch(new URL('/api/setup', req.url), { method: 'HEAD' }).catch(() => null)

  if (!req.auth) {
    const url = req.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  return NextResponse.next()
})

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
```

- [ ] **Step 7: Write `app/(auth)/login/page.tsx`**

```tsx
'use client'
import { useState } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const result = await signIn('credentials', { email, password, redirect: false })
    if (result?.error) {
      setError('邮箱或密码错误')
      setLoading(false)
    } else {
      router.push('/')
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-center">OpenClaw Colony</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1">
              <Label htmlFor="email">邮箱</Label>
              <Input id="email" type="email" value={email} onChange={e => setEmail(e.target.value)} required />
            </div>
            <div className="space-y-1">
              <Label htmlFor="password">密码</Label>
              <Input id="password" type="password" value={password} onChange={e => setPassword(e.target.value)} required />
            </div>
            {error && <p className="text-sm text-red-500">{error}</p>}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? '登录中...' : '登录'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
```

- [ ] **Step 8: Write `app/(auth)/setup/page.tsx`**

```tsx
'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'

export default function SetupPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    const res = await fetch('/api/setup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    })
    if (res.ok) {
      router.push('/login')
    } else {
      const data = await res.json()
      setError(data.error ?? '创建失败')
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>初始化 Colony</CardTitle>
          <CardDescription>创建管理员账号</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1">
              <Label htmlFor="email">管理员邮箱</Label>
              <Input id="email" type="email" value={email} onChange={e => setEmail(e.target.value)} required />
            </div>
            <div className="space-y-1">
              <Label htmlFor="password">密码（至少8位）</Label>
              <Input id="password" type="password" value={password} onChange={e => setPassword(e.target.value)} required minLength={8} />
            </div>
            {error && <p className="text-sm text-red-500">{error}</p>}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? '创建中...' : '创建管理员账号'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
```

- [ ] **Step 9: Run test to verify it passes**

```bash
npx vitest run tests/api/setup.test.ts
```
Expected: PASS (3 tests)

- [ ] **Step 10: Commit**

```bash
git add lib/auth.ts middleware.ts app/api/auth app/api/setup app/\(auth\) tests/api/setup.test.ts
git commit -m "feat(colony): add NextAuth credentials auth, setup endpoint, login UI"
```

---

## Task 6: Zod Validation Schemas

**Files:**
- Create: `openclaw-colony/lib/validations.ts`
- Test: `openclaw-colony/tests/lib/validations.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// tests/lib/validations.test.ts
import { describe, it, expect } from 'vitest'
import { createInstanceSchema, updateConfigSchema, createUserSchema } from '@/lib/validations'

describe('createInstanceSchema', () => {
  it('accepts a valid instance payload', () => {
    const result = createInstanceSchema.safeParse({
      name: 'my-instance',
      imageTag: '1panel/openclaw:2026.5.7',
      port: 18789,
      provider: 'deepseek',
      model: 'deepseek-chat',
      apiKey: 'sk-test',
      bindAddress: '127.0.0.1',
      cpuLimit: 2,
      memoryLimit: '2G',
    })
    expect(result.success).toBe(true)
  })

  it('rejects a name with uppercase letters', () => {
    const result = createInstanceSchema.safeParse({ name: 'MyInstance', port: 18789, provider: 'deepseek', model: 'deepseek-chat', apiKey: 'sk-test' })
    expect(result.success).toBe(false)
  })

  it('rejects port below 1024', () => {
    const result = createInstanceSchema.safeParse({ name: 'ok', port: 80, provider: 'deepseek', model: 'x', apiKey: 'y' })
    expect(result.success).toBe(false)
  })
})

describe('updateConfigSchema', () => {
  it('accepts partial config update', () => {
    const result = updateConfigSchema.safeParse({ model: 'gpt-4o', apiKey: 'sk-new' })
    expect(result.success).toBe(true)
  })
})

describe('createUserSchema', () => {
  it('rejects short password', () => {
    const result = createUserSchema.safeParse({ email: 'a@b.com', password: 'short', role: 'operator' })
    expect(result.success).toBe(false)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run tests/lib/validations.test.ts
```
Expected: FAIL

- [ ] **Step 3: Write `lib/validations.ts`**

```typescript
import { z } from 'zod'

export const PROVIDERS = ['deepseek', 'openai', 'anthropic', 'gemini', 'ollama', 'openrouter', 'vllm', 'minimax', 'groq', 'cohere', 'mistral', 'perplexity', 'together', 'custom'] as const

export const createInstanceSchema = z.object({
  name: z.string().regex(/^[a-z0-9-]+$/, 'Only lowercase letters, numbers, and hyphens'),
  imageTag: z.string().default('1panel/openclaw:2026.5.7'),
  port: z.number().int().min(1024).max(65535),
  provider: z.string().min(1),
  model: z.string().min(1),
  apiKey: z.string().min(1),
  baseUrl: z.string().url().optional().or(z.literal('')),
  bindAddress: z.enum(['127.0.0.1', '0.0.0.0']).default('127.0.0.1'),
  allowedOrigin: z.string().url().optional().or(z.literal('')),
  cpuLimit: z.number().positive().default(2),
  memoryLimit: z.string().regex(/^\d+[GgMmKk]?$/).default('2G'),
  dataDir: z.string().optional(),
})

export type CreateInstanceInput = z.infer<typeof createInstanceSchema>

export const updateConfigSchema = z.object({
  provider: z.string().min(1).optional(),
  model: z.string().min(1).optional(),
  apiKey: z.string().min(1).optional(),
  baseUrl: z.string().url().optional().or(z.literal('')),
  allowedOrigin: z.string().url().optional().or(z.literal('')),
  cpuLimit: z.number().positive().optional(),
  memoryLimit: z.string().regex(/^\d+[GgMmKk]?$/).optional(),
  imageTag: z.string().optional(),
})

export type UpdateConfigInput = z.infer<typeof updateConfigSchema>

export const createUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  role: z.enum(['admin', 'operator']).default('operator'),
})
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run tests/lib/validations.test.ts
```
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add lib/validations.ts tests/lib/validations.test.ts
git commit -m "feat(colony): add Zod validation schemas for instances and users"
```

---

## Task 7: Instances API — List & Create

**Files:**
- Create: `openclaw-colony/app/api/instances/route.ts`
- Test: `openclaw-colony/tests/api/instances.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// tests/api/instances.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/db', () => ({
  prisma: {
    instance: {
      findMany: vi.fn().mockResolvedValue([]),
      create: vi.fn(),
      update: vi.fn(),
      findUnique: vi.fn(),
    },
  },
}))

vi.mock('@/lib/docker', () => ({
  createOpenClawContainer: vi.fn().mockResolvedValue({ id: 'container-abc' }),
  startContainer: vi.fn().mockResolvedValue(undefined),
  getContainerStatus: vi.fn().mockResolvedValue('running'),
  pingDocker: vi.fn().mockResolvedValue(true),
}))

vi.mock('@/lib/crypto', () => ({
  encrypt: vi.fn((s: string) => `enc:${s}`),
  decrypt: vi.fn((s: string) => s.replace('enc:', '')),
}))

vi.mock('@/lib/auth', () => ({
  auth: vi.fn().mockResolvedValue({ user: { id: 'user1', role: 'admin' } }),
}))

const { GET, POST } = await import('@/app/api/instances/route')
import { prisma } from '@/lib/db'

describe('GET /api/instances', () => {
  it('returns empty array when no instances', async () => {
    const req = new NextRequest('http://localhost/api/instances')
    const res = await GET(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toEqual([])
  })
})

describe('POST /api/instances', () => {
  beforeEach(() => vi.clearAllMocks())

  it('creates instance and returns 201', async () => {
    vi.mocked(prisma.instance.create).mockResolvedValue({
      id: 'inst1', name: 'test', containerId: 'container-abc', port: 18789, status: 'running',
    } as any)
    vi.mocked(prisma.instance.update).mockResolvedValue({} as any)

    const req = new NextRequest('http://localhost/api/instances', {
      method: 'POST',
      body: JSON.stringify({
        name: 'test', port: 18789, provider: 'deepseek',
        model: 'deepseek-chat', apiKey: 'sk-test',
      }),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req)
    expect(res.status).toBe(201)
  })

  it('returns 400 on invalid payload', async () => {
    const req = new NextRequest('http://localhost/api/instances', {
      method: 'POST',
      body: JSON.stringify({ name: 'INVALID NAME', port: 80 }),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run tests/api/instances.test.ts
```
Expected: FAIL

- [ ] **Step 3: Write `app/api/instances/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { auth } from '@/lib/auth'
import { encrypt } from '@/lib/crypto'
import { createOpenClawContainer, startContainer, getContainerStatus } from '@/lib/docker'
import { createInstanceSchema } from '@/lib/validations'
import path from 'path'
import fs from 'fs'

function requireAuth(session: any) {
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  return null
}

export async function GET(req: NextRequest) {
  const session = await auth()
  const authErr = requireAuth(session)
  if (authErr) return authErr

  const instances = await prisma.instance.findMany({ orderBy: { createdAt: 'desc' } })

  // Enrich with live Docker status
  const enriched = await Promise.all(
    instances.map(async (inst) => {
      let liveStatus = inst.status
      if (inst.containerId) {
        try {
          const dockerStatus = await getContainerStatus(inst.containerId)
          liveStatus = dockerStatus === 'running' ? 'running' : dockerStatus === 'exited' ? 'stopped' : 'unhealthy'
        } catch {
          liveStatus = 'error'
        }
      }
      return { ...inst, status: liveStatus, apiKey: undefined }
    }),
  )
  return NextResponse.json(enriched)
}

export async function POST(req: NextRequest) {
  const session = await auth()
  const authErr = requireAuth(session)
  if (authErr) return authErr

  const body = await req.json()
  const parsed = createInstanceSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const data = parsed.data
  const dataRoot = process.env.DATA_ROOT ?? './data/instances'
  const dataDir = data.dataDir ?? path.join(dataRoot, data.name)

  // Ensure data directories exist
  fs.mkdirSync(path.join(dataDir, 'conf'), { recursive: true })
  fs.mkdirSync(path.join(dataDir, 'workspace'), { recursive: true })

  const instance = await prisma.instance.create({
    data: {
      name: data.name,
      imageTag: data.imageTag,
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
      status: 'creating',
      createdBy: session!.user!.id!,
    },
  })

  try {
    const container = await createOpenClawContainer({ ...data, apiKey: data.apiKey, dataDir })
    await startContainer(container.id)
    await prisma.instance.update({
      where: { id: instance.id },
      data: { containerId: container.id, status: 'running' },
    })
    return NextResponse.json({ ...instance, containerId: container.id, status: 'running', apiKey: undefined }, { status: 201 })
  } catch (err: any) {
    await prisma.instance.update({ where: { id: instance.id }, data: { status: 'error' } })
    return NextResponse.json({ error: err.message ?? 'Failed to create container' }, { status: 500 })
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run tests/api/instances.test.ts
```
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add app/api/instances/route.ts tests/api/instances.test.ts
git commit -m "feat(colony): add instances list and create API"
```

---

## Task 8: Instance Actions API (get, delete, start, stop, restart, config)

**Files:**
- Create: `openclaw-colony/app/api/instances/[id]/route.ts`
- Create: `openclaw-colony/app/api/instances/[id]/start/route.ts`
- Create: `openclaw-colony/app/api/instances/[id]/stop/route.ts`
- Create: `openclaw-colony/app/api/instances/[id]/restart/route.ts`
- Create: `openclaw-colony/app/api/instances/[id]/config/route.ts`
- Test: `openclaw-colony/tests/api/instance-actions.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// tests/api/instance-actions.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const mockInstance = {
  id: 'inst1', name: 'test', containerId: 'ctr1', port: 18789,
  provider: 'deepseek', model: 'deepseek-chat', apiKey: 'enc:sk-test',
  imageTag: '1panel/openclaw:2026.5.7', bindAddress: '127.0.0.1',
  cpuLimit: 2, memoryLimit: '2G', dataDir: '/data/test', status: 'running',
  baseUrl: null, allowedOrigin: null, createdBy: 'user1', createdAt: new Date(),
}

vi.mock('@/lib/db', () => ({
  prisma: {
    instance: {
      findUnique: vi.fn().mockResolvedValue(mockInstance),
      delete: vi.fn().mockResolvedValue(mockInstance),
      update: vi.fn().mockResolvedValue(mockInstance),
    },
  },
}))
vi.mock('@/lib/docker', () => ({
  startContainer: vi.fn().mockResolvedValue(undefined),
  stopContainer: vi.fn().mockResolvedValue(undefined),
  restartContainer: vi.fn().mockResolvedValue(undefined),
  removeContainer: vi.fn().mockResolvedValue(undefined),
  createOpenClawContainer: vi.fn().mockResolvedValue({ id: 'new-ctr' }),
  getContainerStatus: vi.fn().mockResolvedValue('running'),
}))
vi.mock('@/lib/crypto', () => ({
  encrypt: vi.fn((s: string) => `enc:${s}`),
  decrypt: vi.fn((s: string) => s.replace('enc:', '')),
}))
vi.mock('@/lib/auth', () => ({
  auth: vi.fn().mockResolvedValue({ user: { id: 'user1', role: 'admin' } }),
}))

describe('DELETE /api/instances/:id', () => {
  it('removes instance', async () => {
    const { DELETE } = await import('@/app/api/instances/[id]/route')
    const req = new NextRequest('http://localhost/api/instances/inst1', { method: 'DELETE' })
    const res = await DELETE(req, { params: Promise.resolve({ id: 'inst1' }) })
    expect(res.status).toBe(200)
  })
})

describe('POST /api/instances/:id/start', () => {
  it('starts the instance', async () => {
    const { POST } = await import('@/app/api/instances/[id]/start/route')
    const req = new NextRequest('http://localhost/api/instances/inst1/start', { method: 'POST' })
    const res = await POST(req, { params: Promise.resolve({ id: 'inst1' }) })
    expect(res.status).toBe(200)
  })
})

describe('POST /api/instances/:id/stop', () => {
  it('stops the instance', async () => {
    const { POST } = await import('@/app/api/instances/[id]/stop/route')
    const req = new NextRequest('http://localhost/api/instances/inst1/stop', { method: 'POST' })
    const res = await POST(req, { params: Promise.resolve({ id: 'inst1' }) })
    expect(res.status).toBe(200)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run tests/api/instance-actions.test.ts
```
Expected: FAIL

- [ ] **Step 3: Write `app/api/instances/[id]/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { auth } from '@/lib/auth'
import { removeContainer, stopContainer, getContainerStatus } from '@/lib/docker'
import { decrypt } from '@/lib/crypto'
import fs from 'fs'

type Params = { params: Promise<{ id: string }> }

export async function GET(req: NextRequest, { params }: Params) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params
  const instance = await prisma.instance.findUnique({ where: { id } })
  if (!instance) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  let liveStatus = instance.status
  if (instance.containerId) {
    try {
      const s = await getContainerStatus(instance.containerId)
      liveStatus = s === 'running' ? 'running' : 'stopped'
    } catch { liveStatus = 'error' }
  }
  return NextResponse.json({ ...instance, status: liveStatus, apiKey: undefined })
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const session = await auth()
  if (!session?.user || (session.user as any).role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  const { id } = await params
  const instance = await prisma.instance.findUnique({ where: { id } })
  if (!instance) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  if (instance.containerId) {
    try { await stopContainer(instance.containerId) } catch {}
    try { await removeContainer(instance.containerId) } catch {}
  }

  const url = new URL(req.url)
  const deleteData = url.searchParams.get('deleteData') === 'true'
  if (deleteData && instance.dataDir) {
    fs.rmSync(instance.dataDir, { recursive: true, force: true })
  }

  await prisma.instance.delete({ where: { id } })
  return NextResponse.json({ success: true })
}
```

- [ ] **Step 4: Write `app/api/instances/[id]/start/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { auth } from '@/lib/auth'
import { startContainer } from '@/lib/docker'

type Params = { params: Promise<{ id: string }> }

export async function POST(req: NextRequest, { params }: Params) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params
  const instance = await prisma.instance.findUnique({ where: { id } })
  if (!instance?.containerId) return NextResponse.json({ error: 'Not found or no container' }, { status: 404 })
  await startContainer(instance.containerId)
  await prisma.instance.update({ where: { id }, data: { status: 'running' } })
  return NextResponse.json({ status: 'running' })
}
```

- [ ] **Step 5: Write `app/api/instances/[id]/stop/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { auth } from '@/lib/auth'
import { stopContainer } from '@/lib/docker'

type Params = { params: Promise<{ id: string }> }

export async function POST(req: NextRequest, { params }: Params) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params
  const instance = await prisma.instance.findUnique({ where: { id } })
  if (!instance?.containerId) return NextResponse.json({ error: 'Not found or no container' }, { status: 404 })
  await stopContainer(instance.containerId)
  await prisma.instance.update({ where: { id }, data: { status: 'stopped' } })
  return NextResponse.json({ status: 'stopped' })
}
```

- [ ] **Step 6: Write `app/api/instances/[id]/restart/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { auth } from '@/lib/auth'
import { restartContainer } from '@/lib/docker'

type Params = { params: Promise<{ id: string }> }

export async function POST(req: NextRequest, { params }: Params) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params
  const instance = await prisma.instance.findUnique({ where: { id } })
  if (!instance?.containerId) return NextResponse.json({ error: 'Not found or no container' }, { status: 404 })
  await restartContainer(instance.containerId)
  return NextResponse.json({ status: 'running' })
}
```

- [ ] **Step 7: Write `app/api/instances/[id]/config/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { auth } from '@/lib/auth'
import { encrypt, decrypt } from '@/lib/crypto'
import { stopContainer, removeContainer, createOpenClawContainer, startContainer } from '@/lib/docker'
import { updateConfigSchema } from '@/lib/validations'

type Params = { params: Promise<{ id: string }> }

export async function PUT(req: NextRequest, { params }: Params) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params
  const instance = await prisma.instance.findUnique({ where: { id } })
  if (!instance) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body = await req.json()
  const parsed = updateConfigSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

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
  }

  if (instance.containerId) {
    try { await stopContainer(instance.containerId) } catch {}
    try { await removeContainer(instance.containerId) } catch {}
  }

  const container = await createOpenClawContainer(merged)
  await startContainer(container.id)
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
      status: 'running',
    },
  })
  return NextResponse.json({ ...updated, apiKey: undefined })
}
```

- [ ] **Step 8: Run test to verify it passes**

```bash
npx vitest run tests/api/instance-actions.test.ts
```
Expected: PASS

- [ ] **Step 9: Commit**

```bash
git add app/api/instances/\[id\] tests/api/instance-actions.test.ts
git commit -m "feat(colony): add instance get/delete/start/stop/restart/config APIs"
```

---

## Task 9: Instance Info APIs (logs SSE, stats, token)

**Files:**
- Create: `openclaw-colony/app/api/instances/[id]/logs/route.ts`
- Create: `openclaw-colony/app/api/instances/[id]/stats/route.ts`
- Create: `openclaw-colony/app/api/instances/[id]/token/route.ts`
- Test: `openclaw-colony/tests/api/instance-info.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// tests/api/instance-info.test.ts
import { describe, it, expect, vi } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/auth', () => ({
  auth: vi.fn().mockResolvedValue({ user: { id: 'user1', role: 'admin' } }),
}))
vi.mock('@/lib/db', () => ({
  prisma: {
    instance: {
      findUnique: vi.fn().mockResolvedValue({
        id: 'inst1', containerId: 'ctr1', dataDir: '/tmp/test-inst', name: 'test',
        port: 18789, status: 'running',
      }),
    },
  },
}))
vi.mock('@/lib/docker', () => ({
  getContainerStats: vi.fn().mockResolvedValue({ cpuPercent: 5.2, memUsedMb: 256, memLimitMb: 2048 }),
}))

describe('GET /api/instances/:id/stats', () => {
  it('returns cpu and memory stats', async () => {
    const { GET } = await import('@/app/api/instances/[id]/stats/route')
    const req = new NextRequest('http://localhost/api/instances/inst1/stats')
    const res = await GET(req, { params: Promise.resolve({ id: 'inst1' }) })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.cpuPercent).toBe(5.2)
    expect(body.memUsedMb).toBe(256)
  })
})

describe('GET /api/instances/:id/token', () => {
  it('returns 404 when openclaw.json does not exist', async () => {
    const { GET } = await import('@/app/api/instances/[id]/token/route')
    const req = new NextRequest('http://localhost/api/instances/inst1/token')
    const res = await GET(req, { params: Promise.resolve({ id: 'inst1' }) })
    // /tmp/test-inst/conf/openclaw.json doesn't exist
    expect(res.status).toBe(404)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run tests/api/instance-info.test.ts
```
Expected: FAIL

- [ ] **Step 3: Write `app/api/instances/[id]/logs/route.ts`**

```typescript
import { NextRequest } from 'next/server'
import { prisma } from '@/lib/db'
import { auth } from '@/lib/auth'
import { getDockerClient } from '@/lib/docker'

type Params = { params: Promise<{ id: string }> }

export async function GET(req: NextRequest, { params }: Params) {
  const session = await auth()
  if (!session?.user) return new Response('Unauthorized', { status: 401 })
  const { id } = await params
  const instance = await prisma.instance.findUnique({ where: { id } })
  if (!instance?.containerId) return new Response('Not found', { status: 404 })

  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      try {
        const docker = getDockerClient()
        const container = docker.getContainer(instance.containerId!)
        const logStream = await container.logs({
          follow: true, stdout: true, stderr: true, tail: 200,
        }) as NodeJS.ReadableStream
        logStream.on('data', (chunk: Buffer) => {
          // Docker multiplexes stdout/stderr: first 8 bytes are header
          const text = chunk.length > 8 ? chunk.subarray(8).toString('utf8') : chunk.toString('utf8')
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(text)}\n\n`))
        })
        logStream.on('end', () => controller.close())
        logStream.on('error', () => controller.close())
        req.signal.addEventListener('abort', () => { logStream.destroy(); controller.close() })
      } catch (err: any) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(`Error: ${err.message}`)}\n\n`))
        controller.close()
      }
    },
  })
  return new Response(stream, {
    headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' },
  })
}
```

- [ ] **Step 4: Write `app/api/instances/[id]/stats/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { auth } from '@/lib/auth'
import { getContainerStats } from '@/lib/docker'

type Params = { params: Promise<{ id: string }> }

export async function GET(req: NextRequest, { params }: Params) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params
  const instance = await prisma.instance.findUnique({ where: { id } })
  if (!instance?.containerId) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  try {
    const stats = await getContainerStats(instance.containerId)
    return NextResponse.json({ ...stats, timestamp: Date.now() })
  } catch {
    return NextResponse.json({ cpuPercent: 0, memUsedMb: 0, memLimitMb: 0, timestamp: Date.now() })
  }
}
```

- [ ] **Step 5: Write `app/api/instances/[id]/token/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { auth } from '@/lib/auth'
import fs from 'fs'
import path from 'path'

type Params = { params: Promise<{ id: string }> }

export async function GET(req: NextRequest, { params }: Params) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params
  const instance = await prisma.instance.findUnique({ where: { id } })
  if (!instance) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const tokenFile = path.join(instance.dataDir ?? '', 'conf', 'openclaw.json')
  if (!fs.existsSync(tokenFile)) {
    return NextResponse.json({ error: '实例尚未完成初始化' }, { status: 404 })
  }

  const config = JSON.parse(fs.readFileSync(tokenFile, 'utf-8'))
  const token = config?.token ?? config?.gateway?.token
  if (!token) return NextResponse.json({ error: 'Token not found in config' }, { status: 404 })

  const hostIp = process.env.HOST_IP ?? '127.0.0.1'
  const url = `http://${hostIp}:${instance.port}?token=${token}`
  return NextResponse.json({ url, token })
}
```

- [ ] **Step 6: Run test to verify it passes**

```bash
npx vitest run tests/api/instance-info.test.ts
```
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add app/api/instances/\[id\]/logs app/api/instances/\[id\]/stats app/api/instances/\[id\]/token tests/api/instance-info.test.ts
git commit -m "feat(colony): add instance logs SSE, stats, and token APIs"
```

---

## Task 10: Users API

**Files:**
- Create: `openclaw-colony/app/api/users/route.ts`
- Create: `openclaw-colony/app/api/users/[id]/route.ts`
- Test: `openclaw-colony/tests/api/users.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// tests/api/users.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/auth', () => ({
  auth: vi.fn().mockResolvedValue({ user: { id: 'admin1', role: 'admin' } }),
}))
vi.mock('@/lib/db', () => ({
  prisma: {
    user: {
      findMany: vi.fn().mockResolvedValue([{ id: 'admin1', email: 'a@b.com', role: 'admin', createdAt: new Date() }]),
      create: vi.fn().mockResolvedValue({ id: 'u2', email: 'b@c.com', role: 'operator', createdAt: new Date() }),
      count: vi.fn().mockResolvedValue(2),
      findUnique: vi.fn().mockResolvedValue({ id: 'u2', email: 'b@c.com', role: 'operator' }),
      update: vi.fn().mockResolvedValue({ id: 'u2', role: 'admin' }),
      delete: vi.fn().mockResolvedValue({ id: 'u2' }),
    },
  },
}))

describe('GET /api/users', () => {
  it('returns user list for admin', async () => {
    const { GET } = await import('@/app/api/users/route')
    const req = new NextRequest('http://localhost/api/users')
    const res = await GET(req)
    expect(res.status).toBe(200)
  })
})

describe('POST /api/users', () => {
  beforeEach(() => vi.clearAllMocks())
  it('creates a new user', async () => {
    const { POST } = await import('@/app/api/users/route')
    const req = new NextRequest('http://localhost/api/users', {
      method: 'POST',
      body: JSON.stringify({ email: 'b@c.com', password: 'password123', role: 'operator' }),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req)
    expect(res.status).toBe(201)
  })
})

describe('DELETE /api/users/:id', () => {
  it('deletes a non-admin user', async () => {
    const { DELETE } = await import('@/app/api/users/[id]/route')
    const req = new NextRequest('http://localhost/api/users/u2', { method: 'DELETE' })
    const res = await DELETE(req, { params: Promise.resolve({ id: 'u2' }) })
    expect(res.status).toBe(200)
  })

  it('blocks deleting the last admin', async () => {
    const { prisma } = await import('@/lib/db')
    vi.mocked(prisma.user.count).mockResolvedValue(1)
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ id: 'admin1', role: 'admin' } as any)
    const { DELETE } = await import('@/app/api/users/[id]/route')
    const req = new NextRequest('http://localhost/api/users/admin1', { method: 'DELETE' })
    const res = await DELETE(req, { params: Promise.resolve({ id: 'admin1' }) })
    expect(res.status).toBe(409)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run tests/api/users.test.ts
```
Expected: FAIL

- [ ] **Step 3: Write `app/api/users/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { auth } from '@/lib/auth'
import bcrypt from 'bcryptjs'
import { createUserSchema } from '@/lib/validations'

function requireAdmin(session: any) {
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if ((session.user as any).role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  return null
}

export async function GET(req: NextRequest) {
  const session = await auth()
  const err = requireAdmin(session)
  if (err) return err
  const users = await prisma.user.findMany({ orderBy: { createdAt: 'asc' }, select: { id: true, email: true, role: true, createdAt: true } })
  return NextResponse.json(users)
}

export async function POST(req: NextRequest) {
  const session = await auth()
  const err = requireAdmin(session)
  if (err) return err

  const body = await req.json()
  const parsed = createUserSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const passwordHash = await bcrypt.hash(parsed.data.password, 12)
  const user = await prisma.user.create({
    data: { email: parsed.data.email, passwordHash, role: parsed.data.role },
    select: { id: true, email: true, role: true, createdAt: true },
  })
  return NextResponse.json(user, { status: 201 })
}
```

- [ ] **Step 4: Write `app/api/users/[id]/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { auth } from '@/lib/auth'
import { z } from 'zod'

type Params = { params: Promise<{ id: string }> }

function requireAdmin(session: any) {
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if ((session.user as any).role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  return null
}

export async function PUT(req: NextRequest, { params }: Params) {
  const session = await auth()
  const err = requireAdmin(session)
  if (err) return err

  const { id } = await params
  const body = await req.json()
  const parsed = z.object({ role: z.enum(['admin', 'operator']) }).safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Invalid role' }, { status: 400 })

  const user = await prisma.user.update({
    where: { id },
    data: { role: parsed.data.role },
    select: { id: true, email: true, role: true },
  })
  return NextResponse.json(user)
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const session = await auth()
  const err = requireAdmin(session)
  if (err) return err

  const { id } = await params
  const target = await prisma.user.findUnique({ where: { id } })
  if (!target) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  if (target.role === 'admin') {
    const adminCount = await prisma.user.count({ where: { role: 'admin' } })
    if (adminCount <= 1) return NextResponse.json({ error: '不能删除唯一的 admin' }, { status: 409 })
  }

  await prisma.user.delete({ where: { id } })
  return NextResponse.json({ success: true })
}
```

- [ ] **Step 5: Run test to verify it passes**

```bash
npx vitest run tests/api/users.test.ts
```
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add app/api/users tests/api/users.test.ts
git commit -m "feat(colony): add users CRUD API (admin only)"
```

---

## Task 11: Dashboard Layout & Instance Card Component

**Files:**
- Create: `openclaw-colony/app/(dashboard)/layout.tsx`
- Create: `openclaw-colony/components/instance-card.tsx`
- Create: `openclaw-colony/app/(dashboard)/page.tsx`

- [ ] **Step 1: Write `app/(dashboard)/layout.tsx`**

```tsx
import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { signOut } from '@/lib/auth'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()
  if (!session?.user) redirect('/login')

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <h1 className="font-semibold text-lg">OpenClaw Colony</h1>
          <nav className="flex gap-4 text-sm">
            <Link href="/" className="text-gray-600 hover:text-gray-900">实例</Link>
            {(session.user as any).role === 'admin' && (
              <Link href="/settings/users" className="text-gray-600 hover:text-gray-900">用户</Link>
            )}
          </nav>
        </div>
        <div className="flex items-center gap-3 text-sm text-gray-500">
          <span>{session.user.email}</span>
          <form action={async () => { 'use server'; await signOut({ redirectTo: '/login' }) }}>
            <Button type="submit" variant="ghost" size="sm">退出</Button>
          </form>
        </div>
      </header>
      <main className="p-6">{children}</main>
    </div>
  )
}
```

- [ ] **Step 2: Write `components/instance-card.tsx`**

```tsx
'use client'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Play, Square, RotateCcw, FileText, Settings, ExternalLink, Trash2 } from 'lucide-react'

export interface InstanceCardData {
  id: string
  name: string
  status: string
  port: number
  provider: string
  model: string
  cpuPercent?: number
  memUsedMb?: number
  memLimitMb?: number
}

interface Props {
  instance: InstanceCardData
  isAdmin: boolean
  onStart: (id: string) => void
  onStop: (id: string) => void
  onRestart: (id: string) => void
  onLogs: (id: string) => void
  onConfig: (id: string) => void
  onOpenPanel: (id: string) => void
  onDelete: (id: string) => void
}

const statusColors: Record<string, string> = {
  running: 'bg-green-100 text-green-700',
  stopped: 'bg-gray-100 text-gray-600',
  creating: 'bg-blue-100 text-blue-700',
  unhealthy: 'bg-yellow-100 text-yellow-700',
  error: 'bg-red-100 text-red-700',
}

const statusLabels: Record<string, string> = {
  running: '运行中', stopped: '已停止', creating: '创建中',
  unhealthy: '异常', error: '错误',
}

export function InstanceCard({ instance, isAdmin, onStart, onStop, onRestart, onLogs, onConfig, onOpenPanel, onDelete }: Props) {
  const isRunning = instance.status === 'running'

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader className="pb-2 flex flex-row items-start justify-between">
        <div>
          <h3 className="font-medium">{instance.name}</h3>
          <p className="text-xs text-gray-500 mt-0.5">{instance.provider} / {instance.model}</p>
        </div>
        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColors[instance.status] ?? 'bg-gray-100'}`}>
          {statusLabels[instance.status] ?? instance.status}
        </span>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex gap-4 text-xs text-gray-500">
          <span>端口: {instance.port}</span>
          {instance.cpuPercent !== undefined && <span>CPU: {instance.cpuPercent}%</span>}
          {instance.memUsedMb !== undefined && <span>内存: {instance.memUsedMb}/{instance.memLimitMb}MB</span>}
        </div>
        <div className="flex flex-wrap gap-1.5">
          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => onStart(instance.id)} disabled={isRunning}>
            <Play className="w-3 h-3 mr-1" />启动
          </Button>
          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => onStop(instance.id)} disabled={!isRunning}>
            <Square className="w-3 h-3 mr-1" />停止
          </Button>
          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => onRestart(instance.id)} disabled={!isRunning}>
            <RotateCcw className="w-3 h-3 mr-1" />重启
          </Button>
          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => onLogs(instance.id)}>
            <FileText className="w-3 h-3 mr-1" />日志
          </Button>
          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => onConfig(instance.id)}>
            <Settings className="w-3 h-3 mr-1" />配置
          </Button>
          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => onOpenPanel(instance.id)} disabled={!isRunning}>
            <ExternalLink className="w-3 h-3 mr-1" />面板
          </Button>
          {isAdmin && (
            <Button size="sm" variant="outline" className="h-7 text-xs text-red-600 hover:bg-red-50" onClick={() => onDelete(instance.id)}>
              <Trash2 className="w-3 h-3 mr-1" />删除
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
```

- [ ] **Step 3: Write `app/(dashboard)/page.tsx`**

```tsx
'use client'
import { useEffect, useState, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'
import { InstanceCard, type InstanceCardData } from '@/components/instance-card'
import { LogViewer } from '@/components/log-viewer'
import { EditConfigSheet } from '@/components/edit-config-sheet'
import { DeleteInstanceDialog } from '@/components/delete-instance-dialog'

export default function DashboardPage() {
  const { data: session } = useSession()
  const [instances, setInstances] = useState<InstanceCardData[]>([])
  const [logsInstanceId, setLogsInstanceId] = useState<string | null>(null)
  const [configInstanceId, setConfigInstanceId] = useState<string | null>(null)
  const [deleteInstanceId, setDeleteInstanceId] = useState<string | null>(null)

  const fetchInstances = useCallback(async () => {
    const res = await fetch('/api/instances')
    if (res.ok) setInstances(await res.json())
  }, [])

  useEffect(() => {
    fetchInstances()
    const interval = setInterval(fetchInstances, 10000)
    return () => clearInterval(interval)
  }, [fetchInstances])

  async function doAction(id: string, action: 'start' | 'stop' | 'restart') {
    await fetch(`/api/instances/${id}/${action}`, { method: 'POST' })
    fetchInstances()
  }

  async function openPanel(id: string) {
    const res = await fetch(`/api/instances/${id}/token`)
    if (res.ok) {
      const { url } = await res.json()
      window.open(url, '_blank')
    } else {
      alert('实例尚未完成初始化，请稍候再试')
    }
  }

  const isAdmin = (session?.user as any)?.role === 'admin'

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">实例列表</h2>
        <Button asChild size="sm">
          <Link href="/instances/new"><Plus className="w-4 h-4 mr-1" />新建实例</Link>
        </Button>
      </div>

      {instances.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <p className="text-lg">暂无实例</p>
          <Button asChild className="mt-4" variant="outline">
            <Link href="/instances/new">创建第一个实例</Link>
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {instances.map(inst => (
            <InstanceCard
              key={inst.id}
              instance={inst}
              isAdmin={isAdmin}
              onStart={id => doAction(id, 'start')}
              onStop={id => doAction(id, 'stop')}
              onRestart={id => doAction(id, 'restart')}
              onLogs={setLogsInstanceId}
              onConfig={setConfigInstanceId}
              onOpenPanel={openPanel}
              onDelete={setDeleteInstanceId}
            />
          ))}
        </div>
      )}

      {logsInstanceId && (
        <LogViewer instanceId={logsInstanceId} onClose={() => setLogsInstanceId(null)} />
      )}
      {configInstanceId && (
        <EditConfigSheet
          instanceId={configInstanceId}
          onClose={() => setConfigInstanceId(null)}
          onSaved={fetchInstances}
        />
      )}
      {deleteInstanceId && (
        <DeleteInstanceDialog
          instanceId={deleteInstanceId}
          onClose={() => setDeleteInstanceId(null)}
          onDeleted={fetchInstances}
        />
      )}
    </div>
  )
}
```

- [ ] **Step 4: Add SessionProvider to `app/layout.tsx`**

```tsx
import type { Metadata } from 'next'
import { Geist } from 'next/font/google'
import './globals.css'
import { SessionProvider } from 'next-auth/react'

const geist = Geist({ subsets: ['latin'] })

export const metadata: Metadata = { title: 'OpenClaw Colony' }

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh">
      <body className={geist.className}>
        <SessionProvider>{children}</SessionProvider>
      </body>
    </html>
  )
}
```

- [ ] **Step 5: Verify dev server renders the dashboard**

```bash
npm run dev
# Open http://localhost:3000 in browser
# Should redirect to /login
```

- [ ] **Step 6: Commit**

```bash
git add app/\(dashboard\) components/instance-card.tsx app/layout.tsx
git commit -m "feat(colony): add dashboard layout, instance card component, and main page"
```

---

## Task 12: Log Viewer, Edit Config Sheet, Delete Dialog Components

**Files:**
- Create: `openclaw-colony/components/log-viewer.tsx`
- Create: `openclaw-colony/components/edit-config-sheet.tsx`
- Create: `openclaw-colony/components/delete-instance-dialog.tsx`

- [ ] **Step 1: Write `components/log-viewer.tsx`**

```tsx
'use client'
import { useEffect, useRef, useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Pause, Play } from 'lucide-react'

interface Props {
  instanceId: string
  onClose: () => void
}

export function LogViewer({ instanceId, onClose }: Props) {
  const [lines, setLines] = useState<string[]>([])
  const [paused, setPaused] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const pausedRef = useRef(false)

  useEffect(() => {
    const es = new EventSource(`/api/instances/${instanceId}/logs`)
    es.onmessage = (e) => {
      if (pausedRef.current) return
      const text: string = JSON.parse(e.data)
      setLines(prev => [...prev.slice(-500), text])
    }
    return () => es.close()
  }, [instanceId])

  useEffect(() => {
    if (!paused) bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [lines, paused])

  function togglePause() {
    pausedRef.current = !pausedRef.current
    setPaused(p => !p)
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[80vh] flex flex-col">
        <DialogHeader className="flex-row items-center justify-between">
          <DialogTitle>实例日志</DialogTitle>
          <Button size="sm" variant="outline" onClick={togglePause} className="mr-8">
            {paused ? <><Play className="w-3 h-3 mr-1" />继续</> : <><Pause className="w-3 h-3 mr-1" />暂停</>}
          </Button>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto bg-black rounded p-3 font-mono text-xs text-green-400 space-y-0.5">
          {lines.map((line, i) => <div key={i}>{line}</div>)}
          <div ref={bottomRef} />
        </div>
      </DialogContent>
    </Dialog>
  )
}
```

- [ ] **Step 2: Write `components/edit-config-sheet.tsx`**

```tsx
'use client'
import { useEffect, useState } from 'react'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

interface Props {
  instanceId: string
  onClose: () => void
  onSaved: () => void
}

export function EditConfigSheet({ instanceId, onClose, onSaved }: Props) {
  const [form, setForm] = useState({ provider: '', model: '', apiKey: '', baseUrl: '', cpuLimit: '', memoryLimit: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    fetch(`/api/instances/${instanceId}`).then(r => r.json()).then(data => {
      setForm({
        provider: data.provider ?? '',
        model: data.model ?? '',
        apiKey: '',
        baseUrl: data.baseUrl ?? '',
        cpuLimit: String(data.cpuLimit ?? 2),
        memoryLimit: data.memoryLimit ?? '2G',
      })
    })
  }, [instanceId])

  async function handleSave() {
    setSaving(true)
    setError('')
    const payload: Record<string, string | number> = {
      provider: form.provider, model: form.model,
      baseUrl: form.baseUrl, cpuLimit: parseFloat(form.cpuLimit),
      memoryLimit: form.memoryLimit,
    }
    if (form.apiKey) payload.apiKey = form.apiKey

    const res = await fetch(`/api/instances/${instanceId}/config`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    if (res.ok) { onSaved(); onClose() }
    else { setError((await res.json()).error ?? '保存失败'); setSaving(false) }
  }

  return (
    <Sheet open onOpenChange={onClose}>
      <SheetContent className="w-[400px] space-y-4">
        <SheetHeader><SheetTitle>编辑配置</SheetTitle></SheetHeader>
        <p className="text-sm text-amber-600 bg-amber-50 p-2 rounded">⚠️ 此操作会重启实例，数据保留，连接中断约 5s</p>
        {[
          { key: 'provider', label: '提供商' },
          { key: 'model', label: '模型名' },
          { key: 'apiKey', label: 'API Key（留空保持不变）', type: 'password' },
          { key: 'baseUrl', label: 'Base URL（可选）' },
          { key: 'cpuLimit', label: 'CPU 上限', type: 'number' },
          { key: 'memoryLimit', label: '内存上限（如 2G）' },
        ].map(({ key, label, type }) => (
          <div key={key} className="space-y-1">
            <Label>{label}</Label>
            <Input
              type={type ?? 'text'}
              value={(form as any)[key]}
              onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
            />
          </div>
        ))}
        {error && <p className="text-sm text-red-500">{error}</p>}
        <SheetFooter>
          <Button onClick={handleSave} disabled={saving} className="w-full">
            {saving ? '保存并重建中...' : '保存配置'}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
```

- [ ] **Step 3: Write `components/delete-instance-dialog.tsx`**

```tsx
'use client'
import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'

interface Props {
  instanceId: string
  onClose: () => void
  onDeleted: () => void
}

export function DeleteInstanceDialog({ instanceId, onClose, onDeleted }: Props) {
  const [deleteData, setDeleteData] = useState(false)
  const [deleting, setDeleting] = useState(false)

  async function handleDelete() {
    setDeleting(true)
    const url = `/api/instances/${instanceId}${deleteData ? '?deleteData=true' : ''}`
    const res = await fetch(url, { method: 'DELETE' })
    if (res.ok) { onDeleted(); onClose() }
    else setDeleting(false)
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>删除实例</DialogTitle></DialogHeader>
        <p className="text-sm text-gray-600">此操作不可撤销，容器将被停止并删除。</p>
        <div className="flex items-center gap-2 mt-2">
          <Checkbox id="del-data" checked={deleteData} onCheckedChange={v => setDeleteData(!!v)} />
          <Label htmlFor="del-data" className="text-sm">同时删除数据目录（配置和工作区）</Label>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} disabled={deleting}>取消</Button>
          <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
            {deleting ? '删除中...' : '确认删除'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
```

- [ ] **Step 4: Commit**

```bash
git add components/log-viewer.tsx components/edit-config-sheet.tsx components/delete-instance-dialog.tsx
git commit -m "feat(colony): add log viewer, edit config sheet, delete dialog components"
```

---

## Task 13: Create Instance Form Page

**Files:**
- Create: `openclaw-colony/app/(dashboard)/instances/new/page.tsx`

- [ ] **Step 1: Write `app/(dashboard)/instances/new/page.tsx`**

```tsx
'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { PROVIDERS } from '@/lib/validations'

const DEFAULT_IMAGE = '1panel/openclaw:2026.5.7'

export default function NewInstancePage() {
  const router = useRouter()
  const [form, setForm] = useState({
    name: '', imageTag: DEFAULT_IMAGE, port: '18789',
    provider: 'deepseek', model: '', apiKey: '', baseUrl: '',
    bindAddress: '127.0.0.1', allowedOrigin: '', cpuLimit: '2', memoryLimit: '2G',
  })
  const [error, setError] = useState('')
  const [creating, setCreating] = useState(false)

  function set(key: string, val: string) { setForm(f => ({ ...f, [key]: val })) }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
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
      setError(data.error ?? '创建失败')
      setCreating(false)
    }
  }

  return (
    <div className="max-w-xl mx-auto">
      <Card>
        <CardHeader><CardTitle>新建 OpenClaw 实例</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label htmlFor="name">实例名（小写字母/数字/横杠）</Label>
                <Input id="name" value={form.name} onChange={e => set('name', e.target.value)} placeholder="my-instance" pattern="[a-z0-9-]+" required />
              </div>
              <div className="space-y-1">
                <Label htmlFor="port">端口</Label>
                <Input id="port" type="number" value={form.port} onChange={e => set('port', e.target.value)} min={1024} max={65535} required />
              </div>
            </div>
            <div className="space-y-1">
              <Label>提供商</Label>
              <Select value={form.provider} onValueChange={v => set('provider', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PROVIDERS.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label htmlFor="model">模型名</Label>
                <Input id="model" value={form.model} onChange={e => set('model', e.target.value)} placeholder="deepseek-chat" required />
              </div>
              <div className="space-y-1">
                <Label htmlFor="apiKey">API Key</Label>
                <Input id="apiKey" type="password" value={form.apiKey} onChange={e => set('apiKey', e.target.value)} required />
              </div>
            </div>
            <div className="space-y-1">
              <Label htmlFor="baseUrl">Base URL（可选，用于 Ollama 等）</Label>
              <Input id="baseUrl" value={form.baseUrl} onChange={e => set('baseUrl', e.target.value)} placeholder="http://localhost:11434" />
            </div>
            <details className="text-sm">
              <summary className="cursor-pointer text-gray-500 hover:text-gray-700">高级选项</summary>
              <div className="mt-3 space-y-4 pl-2 border-l-2 border-gray-100">
                <div className="space-y-1">
                  <Label htmlFor="imageTag">镜像 Tag</Label>
                  <Input id="imageTag" value={form.imageTag} onChange={e => set('imageTag', e.target.value)} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <Label htmlFor="cpuLimit">CPU 上限</Label>
                    <Input id="cpuLimit" type="number" step="0.5" value={form.cpuLimit} onChange={e => set('cpuLimit', e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="memoryLimit">内存上限</Label>
                    <Input id="memoryLimit" value={form.memoryLimit} onChange={e => set('memoryLimit', e.target.value)} placeholder="2G" />
                  </div>
                </div>
                <div className="space-y-1">
                  <Label>绑定地址</Label>
                  <Select value={form.bindAddress} onValueChange={v => set('bindAddress', v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="127.0.0.1">127.0.0.1（仅本机）</SelectItem>
                      <SelectItem value="0.0.0.0">0.0.0.0（局域网）</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="allowedOrigin">外部访问地址（可选 HTTPS URL）</Label>
                  <Input id="allowedOrigin" value={form.allowedOrigin} onChange={e => set('allowedOrigin', e.target.value)} placeholder="https://my-domain.com" />
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

- [ ] **Step 2: Verify in browser**

```bash
# Navigate to http://localhost:3000/instances/new
# Form should render with all fields
```

- [ ] **Step 3: Commit**

```bash
git add app/\(dashboard\)/instances
git commit -m "feat(colony): add create instance form page"
```

---

## Task 14: User Management Page

**Files:**
- Create: `openclaw-colony/app/(dashboard)/settings/users/page.tsx`

- [ ] **Step 1: Write `app/(dashboard)/settings/users/page.tsx`**

```tsx
'use client'
import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Trash2 } from 'lucide-react'

interface User { id: string; email: string; role: string; createdAt: string }

export default function UsersPage() {
  const { data: session } = useSession()
  const router = useRouter()
  const [users, setUsers] = useState<User[]>([])
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState<'admin' | 'operator'>('operator')
  const [error, setError] = useState('')

  useEffect(() => {
    if ((session?.user as any)?.role !== 'admin') router.replace('/')
    fetchUsers()
  }, [session])

  async function fetchUsers() {
    const res = await fetch('/api/users')
    if (res.ok) setUsers(await res.json())
  }

  async function createUser(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    const res = await fetch('/api/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, role }),
    })
    if (res.ok) { setEmail(''); setPassword(''); fetchUsers() }
    else setError((await res.json()).error ?? '创建失败')
  }

  async function deleteUser(id: string) {
    if (!confirm('确认删除该用户？')) return
    const res = await fetch(`/api/users/${id}`, { method: 'DELETE' })
    if (res.ok) fetchUsers()
    else alert((await res.json()).error)
  }

  async function changeRole(id: string, newRole: string) {
    await fetch(`/api/users/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: newRole }),
    })
    fetchUsers()
  }

  return (
    <div className="max-w-2xl space-y-6">
      <h2 className="text-xl font-semibold">用户管理</h2>
      <Card>
        <CardHeader><CardTitle className="text-base">当前用户</CardTitle></CardHeader>
        <CardContent>
          <table className="w-full text-sm">
            <thead><tr className="text-left text-gray-500 border-b"><th className="pb-2">邮箱</th><th>角色</th><th>创建时间</th><th /></tr></thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id} className="border-b last:border-0">
                  <td className="py-2">{u.email}</td>
                  <td>
                    <Select value={u.role} onValueChange={v => changeRole(u.id, v)}>
                      <SelectTrigger className="h-7 text-xs w-24"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="admin">admin</SelectItem>
                        <SelectItem value="operator">operator</SelectItem>
                      </SelectContent>
                    </Select>
                  </td>
                  <td className="text-gray-400 text-xs">{new Date(u.createdAt).toLocaleDateString()}</td>
                  <td>
                    <Button size="sm" variant="ghost" className="h-7 text-red-500" onClick={() => deleteUser(u.id)}>
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle className="text-base">创建用户</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={createUser} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>邮箱</Label>
                <Input type="email" value={email} onChange={e => setEmail(e.target.value)} required />
              </div>
              <div className="space-y-1">
                <Label>密码</Label>
                <Input type="password" value={password} onChange={e => setPassword(e.target.value)} minLength={8} required />
              </div>
            </div>
            <div className="space-y-1 w-32">
              <Label>角色</Label>
              <Select value={role} onValueChange={v => setRole(v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="operator">operator</SelectItem>
                  <SelectItem value="admin">admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {error && <p className="text-sm text-red-500">{error}</p>}
            <Button type="submit" size="sm">创建用户</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add app/\(dashboard\)/settings
git commit -m "feat(colony): add user management page"
```

---

## Task 15: Dockerfile & docker-compose.yml

**Files:**
- Create: `openclaw-colony/Dockerfile`
- Create: `openclaw-colony/docker-compose.yml`
- Create: `openclaw-colony/.dockerignore`

- [ ] **Step 1: Write `Dockerfile`**

```dockerfile
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma

USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["sh", "-c", "npx prisma migrate deploy && node server.js"]
```

- [ ] **Step 2: Write `.dockerignore`**

```
node_modules
.next
.env.local
data
*.md
tests
```

- [ ] **Step 3: Write `docker-compose.yml`**

```yaml
services:
  openclaw-colony:
    image: openclaw-colony:latest
    build: .
    ports:
      - "3000:3000"
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock
      - ./data:/app/data
    environment:
      - NEXTAUTH_SECRET=${NEXTAUTH_SECRET}
      - NEXTAUTH_URL=${NEXTAUTH_URL:-http://localhost:3000}
      - DATABASE_URL=file:/app/data/colony.db
      - ENCRYPTION_KEY=${ENCRYPTION_KEY}
      - DATA_ROOT=/app/data/instances
      - HOST_IP=${HOST_IP:-127.0.0.1}
    restart: unless-stopped
```

- [ ] **Step 4: Build the Docker image to verify**

```bash
docker build -t openclaw-colony:latest .
```
Expected: Image built successfully, size ~200-300MB.

- [ ] **Step 5: Test run with docker compose**

```bash
NEXTAUTH_SECRET=$(openssl rand -base64 32) \
ENCRYPTION_KEY=$(openssl rand -hex 32) \
docker compose up -d
docker compose logs -f
```
Expected: Server listening on port 3000.

- [ ] **Step 6: Commit**

```bash
git add Dockerfile docker-compose.yml .dockerignore
git commit -m "feat(colony): add Dockerfile and docker-compose for production deployment"
```

---

## Task 16: Run All Tests & Final Verification

- [ ] **Step 1: Run full test suite**

```bash
npx vitest run
```
Expected: All tests PASS.

- [ ] **Step 2: Verify end-to-end flow in dev mode**

```bash
npm run dev
# 1. Go to http://localhost:3000 → redirected to /login
# 2. Go to http://localhost:3000/setup → create admin account
# 3. Log in with admin credentials
# 4. Dashboard shows "暂无实例"
# 5. Click 新建实例 → fill form → submit (Docker must be running for actual container creation)
# 6. Verify instance card appears with status badge
# 7. Test start/stop/logs buttons
```

- [ ] **Step 3: Check TypeScript compilation**

```bash
npx tsc --noEmit
```
Expected: No type errors.

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "feat(colony): complete OpenClaw Colony Manager implementation"
```

---

## Spec Coverage Checklist

| Spec Requirement | Task |
|-----------------|------|
| Email/password login + JWT | Task 5 |
| /setup first-run admin creation | Task 5 |
| Instance list dashboard (cards, auto-refresh) | Task 11 |
| Create instance (full form, Docker container) | Tasks 7, 13 |
| Start / stop / restart | Task 8 |
| Delete with optional data cleanup | Task 8 |
| Edit config (container recreation) | Task 8 |
| Log viewer (SSE) | Tasks 9, 12 |
| Resource stats (CPU/memory) | Tasks 4, 9 |
| Jump to OpenClaw panel (token read) | Tasks 9, 11 |
| User management (admin only) | Tasks 10, 14 |
| AES-256-GCM API key encryption | Task 3 |
| dockerode wrapper | Task 4 |
| Zod validation | Task 6 |
| Docker socket mount, standalone image | Task 15 |
| Route protection middleware | Task 5 |
