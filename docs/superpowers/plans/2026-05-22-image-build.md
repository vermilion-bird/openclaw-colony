# 镜像构建功能实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 镜像管理页面支持用户基于已导入镜像编辑 Dockerfile 并构建自定义镜像

**Architecture:** Colony 通过 docker.sock 调用宿主机 BuildKit 构建镜像，使用 SSE 流式返回构建日志，构建完成后自动导入镜像列表

**Tech Stack:** Next.js 16, Prisma 7, Dockerode, Server-Sent Events (SSE), React

---

## 文件结构

| 文件 | 责任 |
|------|------|
| `prisma/schema-postgresql.prisma` | Image 表扩展（buildType, dockerfile, baseImageId） |
| `prisma/schema-sqlite.prisma` | SQLite 版本的 Image 表扩展 |
| `lib/validations.ts` | 构建镜像输入验证 schema |
| `lib/docker.ts` | 新增 buildImage 函数 |
| `app/api/images/build/route.ts` | 构建镜像 API（POST） |
| `app/api/images/build/[id]/logs/route.ts` | SSE 构建日志流 |
| `components/build-image-dialog.tsx` | 构建镜像对话框组件 |
| `app/(dashboard)/settings/images/page.tsx` | 添加构建按钮 |
| `components/image-list-table.tsx` | 显示构建来源标记 |

---

### Task 1: 扩展 Prisma Schema

**Files:**
- Modify: `prisma/schema-postgresql.prisma`
- Modify: `prisma/schema-sqlite.prisma`

- [ ] **Step 1: 扩展 PostgreSQL schema**

在 `prisma/schema-postgresql.prisma` 的 Image model 添加字段：

```prisma
model Image {
  id             String   @id @default(cuid())
  repository     String   @default("openclaw/openclaw")
  tag            String
  digest         String   @unique
  os             String   @default("linux")
  architecture   String
  compressedSize Int
  isActive       Boolean  @default(false)
  pushedAt       DateTime
  importedAt     DateTime @default(now())
  importedBy     String
  importer       User     @relation(fields: [importedBy], references: [id])
  // 新增字段
  buildType      String   @default("import")  // 'import' | 'build'
  dockerfile     String?  // 构建时使用的 Dockerfile
  baseImageId    String?  // 基础镜像 ID（仅构建镜像）

  @@index([isActive])
  @@index([pushedAt])
  @@index([buildType])
}
```

- [ ] **Step 2: 扩展 SQLite schema**

在 `prisma/schema-sqlite.prisma` 的 Image model 添加相同字段：

```prisma
model Image {
  id             String   @id @default(cuid())
  repository     String   @default("openclaw/openclaw")
  tag            String
  digest         String   @unique
  os             String   @default("linux")
  architecture   String
  compressedSize Int
  isActive       Boolean  @default(false)
  pushedAt       DateTime
  importedAt     DateTime @default(now())
  importedBy     String
  importer       User     @relation(fields: [importedBy], references: [id])
  // 新增字段
  buildType      String   @default("import")
  dockerfile     String?
  baseImageId    String?

  @@index([isActive])
  @@index([pushedAt])
  @@index([buildType])
}
```

- [ ] **Step 3: Commit schema changes**

```bash
git add prisma/schema-postgresql.prisma prisma/schema-sqlite.prisma
git commit -m "feat: extend Image schema with build fields"
```

---

### Task 2: 添加构建镜像验证 schema

**Files:**
- Modify: `lib/validations.ts`

- [ ] **Step 1: 添加 buildImageSchema**

在 `lib/validations.ts` 文件末尾添加：

```typescript
export const buildImageSchema = z.object({
  baseImageId: z.string().min(1, '基础镜像不能为空'),
  dockerfile: z.string().min(1, 'Dockerfile 不能为空'),
  imageName: z.string().regex(/^[a-z0-9-]+$/, '镜像名只能包含小写字母、数字和横杠'),
  imageTag: z.string().regex(/^[a-zA-Z0-9._-]+$/, 'Tag 格式无效'),
})

export type BuildImageInput = z.infer<typeof buildImageSchema>
```

- [ ] **Step 2: Commit validation schema**

```bash
git add lib/validations.ts
git commit -m "feat: add buildImage validation schema"
```

---

### Task 3: 实现 buildImage 函数

**Files:**
- Modify: `lib/docker.ts`

- [ ] **Step 1: 添加 buildImage 函数**

在 `lib/docker.ts` 文件末尾添加：

```typescript
export interface BuildImageOptions {
  dockerfile: string
  imageName: string
  imageTag: string
}

export interface BuildResult {
  imageId: string
  digest: string
  success: boolean
  error?: string
}

export async function buildImage(opts: BuildImageOptions): Promise<AsyncGenerator<string, BuildResult>> {
  const docker = getDockerClient()
  const tempDir = `/tmp/build-${Date.now()}`
  const fs = await import('fs/promises')
  const path = await import('path')

  // Create temp directory and write Dockerfile
  await fs.mkdir(tempDir, { recursive: true })
  await fs.writeFile(path.join(tempDir, 'Dockerfile'), opts.dockerfile)

  const fullTag = `${opts.imageName}:${opts.imageTag}`

  async function* generate(): AsyncGenerator<string, BuildResult> {
    try {
      const stream = await docker.buildImage({
        context: tempDir,
        src: ['Dockerfile'],
      }, {
        t: fullTag,
        dockerfile: 'Dockerfile',
      })

      // Stream build logs
      for await (const chunk of stream as AsyncIterable<Buffer>) {
        const lines = chunk.toString().split('\n').filter(l => l.trim())
        for (const line of lines) {
          try {
            const parsed = JSON.parse(line)
            if (parsed.stream) {
              yield parsed.stream.trim()
            } else if (parsed.error) {
              yield `ERROR: ${parsed.error.trim()}`
            }
          } catch {
            yield line
          }
        }
      }

      // Get image info after build
      const image = await docker.getImage(fullTag).inspect()
      
      // Cleanup temp directory
      await fs.rm(tempDir, { recursive: true, force: true })

      return {
        imageId: image.Id,
        digest: image.RepoDigests?.[0]?.split('@')[1] ?? image.Id,
        success: true,
      }
    } catch (err: any) {
      // Cleanup on error
      await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {})
      return {
        imageId: '',
        digest: '',
        success: false,
        error: err.message ?? '构建失败',
      }
    }
  }

  return generate()
}

// Generate Dockerfile template from base image
export function generateDockerfileTemplate(repository: string, tag: string): string {
  return `FROM ${repository}:${tag}

# 在此添加自定义配置
# 示例：
# RUN apk add --no-cache vim curl
# ENV MY_VAR=value
# COPY custom-config.yaml /app/config/
`
}
```

- [ ] **Step 2: Commit buildImage function**

```bash
git add lib/docker.ts
git commit -m "feat: add buildImage function with BuildKit support"
```

---

### Task 4: 实现构建镜像 API

**Files:**
- Create: `app/api/images/build/route.ts`

- [ ] **Step 1: 创建构建 API**

创建文件 `app/api/images/build/route.ts`：

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { auth } from '@/lib/auth'
import { buildImage, generateDockerfileTemplate } from '@/lib/docker'
import { buildImageSchema } from '@/lib/validations'

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
  const parsed = buildImageSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const { baseImageId, dockerfile, imageName, imageTag } = parsed.data

  // Check base image exists
  const baseImage = await prisma.image.findUnique({ where: { id: baseImageId } })
  if (!baseImage) return NextResponse.json({ error: '基础镜像不存在' }, { status: 404 })

  // Execute build
  const buildGen = await buildImage({ dockerfile, imageName, imageTag })
  const logs: string[] = []
  let result: any

  for await (const log of buildGen) {
    logs.push(log)
  }

  // Get final result
  result = await buildGen.return

  if (!result.success) {
    return NextResponse.json({ 
      error: '构建失败', 
      logs, 
      detail: result.error 
    }, { status: 500 })
  }

  // Check for duplicate digest (optional - allow overwrite for same name:tag)
  const existing = await prisma.image.findFirst({
    where: { repository: imageName, tag: imageTag },
  })

  if (existing) {
    // Update existing image
    const updated = await prisma.image.update({
      where: { id: existing.id },
      data: {
        digest: result.digest,
        dockerfile,
        baseImageId,
        buildType: 'build',
        pushedAt: new Date(),
      },
    })
    return NextResponse.json({ image: updated, logs })
  }

  // Create new image record
  const image = await prisma.image.create({
    data: {
      repository: imageName,
      tag: imageTag,
      digest: result.digest,
      os: 'linux',
      architecture: 'amd64',
      compressedSize: 0, // Unknown for custom builds
      buildType: 'build',
      dockerfile,
      baseImageId,
      importedBy: session!.user!.id!,
      pushedAt: new Date(),
    },
  })

  // Create audit log
  await prisma.auditLog.create({
    data: {
      userId: session!.user!.id!,
      action: 'build',
      resource: 'image',
      resourceId: image.id,
      metadata: JSON.stringify({ imageName, imageTag, baseImageId }),
    },
  })

  return NextResponse.json({ image, logs }, { status: 201 })
}
```

- [ ] **Step 2: Commit build API**

```bash
git add app/api/images/build/route.ts
git commit -m "feat: add image build API endpoint"
```

---

### Task 5: 实现构建日志 SSE API

**Files:**
- Create: `app/api/images/build/[id]/logs/route.ts`

- [ ] **Step 1: 创建 SSE 日志端点**

创建文件 `app/api/images/build/[id]/logs/route.ts`：

```typescript
import { NextRequest } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'

type Params = { params: Promise<{ id: string }> }

export async function GET(req: NextRequest, { params }: Params) {
  const session = await auth()
  if (!session?.user || (session.user as any).role !== 'admin') {
    return new Response('Unauthorized', { status: 401 })
  }

  const { id } = await params

  // For now, return stored logs from the build record
  // In future, could implement real-time streaming during build
  const image = await prisma.image.findUnique({ where: { id } })
  if (!image || image.buildType !== 'build') {
    return new Response('Not found', { status: 404 })
  }

  // Return as SSE stream
  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    start(controller) {
      // Send Dockerfile as first event
      controller.enqueue(encoder.encode(`data: Dockerfile:\n\n`))
      if (image.dockerfile) {
        const lines = image.dockerfile.split('\n')
        for (const line of lines) {
          controller.enqueue(encoder.encode(`data: ${line}\n\n`))
        }
      }
      controller.enqueue(encoder.encode(`data: \n\n`))
      controller.enqueue(encoder.encode(`data: Build completed: ${image.repository}:${image.tag}\n\n`))
      controller.close()
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  })
}
```

- [ ] **Step 2: Commit SSE logs API**

```bash
git add app/api/images/build/[id]/logs/route.ts
git commit -m "feat: add SSE endpoint for build logs"
```

---

### Task 6: 创建构建镜像对话框组件

**Files:**
- Create: `components/build-image-dialog.tsx`

- [ ] **Step 1: 创建对话框组件**

创建文件 `components/build-image-dialog.tsx`：

```typescript
'use client'
import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Loader2, Hammer } from 'lucide-react'
import { ImageRow } from '@/components/image-list-table'
import { generateDockerfileTemplate } from '@/lib/docker-template'

interface Props {
  open: boolean
  onClose: () => void
  onBuilt: () => void
  images: ImageRow[]
}

export function BuildImageDialog({ open, onClose, onBuilt, images }: Props) {
  const [baseImageId, setBaseImageId] = useState('')
  const [dockerfile, setDockerfile] = useState('')
  const [imageName, setImageName] = useState('')
  const [imageTag, setImageTag] = useState('latest')
  const [building, setBuilding] = useState(false)
  const [logs, setLogs] = useState<string[]>([])
  const [error, setError] = useState('')
  const [showLogs, setShowLogs] = useState(false)

  // Generate template when base image selected
  useEffect(() => {
    if (baseImageId) {
      const base = images.find(img => img.id === baseImageId)
      if (base) {
        setDockerfile(generateDockerfileTemplate(base.repository, base.tag))
      }
    }
  }, [baseImageId, images])

  function handleClose() {
    setBaseImageId('')
    setDockerfile('')
    setImageName('')
    setImageTag('latest')
    setLogs([])
    setError('')
    setShowLogs(false)
    onClose()
  }

  async function handleBuild() {
    if (!baseImageId || !dockerfile || !imageName || !imageTag) return
    setError('')
    setBuilding(true)
    setShowLogs(true)
    setLogs(['开始构建...'])

    try {
      const res = await fetch('/api/images/build', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ baseImageId, dockerfile, imageName, imageTag }),
      })
      const data = await res.json()

      if (res.ok) {
        setLogs(data.logs || [])
        setLogs(prev => [...prev, '构建完成!'])
        setTimeout(() => {
          onBuilt()
          handleClose()
        }, 1500)
      } else {
        setError(data.error || '构建失败')
        setLogs(data.logs || [])
      }
    } catch (err: any) {
      setError(err.message || '网络错误')
    } finally {
      setBuilding(false)
    }
  }

  const importImages = images.filter(img => img.buildType === 'import' || !img.buildType)

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Hammer className="w-5 h-5" />
            构建镜像
          </DialogTitle>
          <DialogDescription>
            选择已导入镜像作为基础，编辑 Dockerfile 后构建自定义镜像
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>基础镜像</Label>
              <Select value={baseImageId} onValueChange={setBaseImageId}>
                <SelectTrigger>
                  <SelectValue placeholder="选择基础镜像" />
                </SelectTrigger>
                <SelectContent>
                  {importImages.map(img => (
                    <SelectItem key={img.id} value={img.id}>
                      {img.repository}:{img.tag}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>镜像名称</Label>
              <Input
                value={imageName}
                onChange={e => setImageName(e.target.value)}
                placeholder="my-openclaw"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Tag</Label>
            <Input
              value={imageTag}
              onChange={e => setImageTag(e.target.value)}
              placeholder="latest"
            />
          </div>

          <div className="space-y-2">
            <Label>Dockerfile</Label>
            <Textarea
              value={dockerfile}
              onChange={e => setDockerfile(e.target.value)}
              className="font-mono text-sm min-h-[200px]"
              placeholder="FROM openclaw/openclaw:latest"
            />
          </div>

          {showLogs && (
            <div className="space-y-2">
              <Label>构建日志</Label>
              <div className="bg-gray-900 text-gray-100 p-3 rounded-lg text-sm font-mono max-h-[150px] overflow-y-auto">
                {logs.map((log, i) => (
                  <div key={i}>{log}</div>
                ))}
                {building && <div className="animate-pulse">构建中...</div>}
              </div>
            </div>
          )}

          {error && <p className="text-sm text-red-500">{error}</p>}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={building}>
            取消
          </Button>
          <Button onClick={handleBuild} disabled={building || !baseImageId || !dockerfile || !imageName}>
            {building && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
            构建镜像
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
```

- [ ] **Step 2: 创建 docker-template 辅助函数**

创建文件 `lib/docker-template.ts`：

```typescript
export function generateDockerfileTemplate(repository: string, tag: string): string {
  return `FROM ${repository}:${tag}

# 在此添加自定义配置
# 示例：
# RUN apk add --no-cache vim curl
# ENV MY_VAR=value
# COPY custom-config.yaml /app/config/
`
}
```

- [ ] **Step 3: Commit build dialog**

```bash
git add components/build-image-dialog.tsx lib/docker-template.ts
git commit -m "feat: add build image dialog component"
```

---

### Task 7: 集成构建按钮到镜像管理页面

**Files:**
- Modify: `app/(dashboard)/settings/images/page.tsx`

- [ ] **Step 1: 添加构建按钮和对话框**

在页面添加构建功能：

```typescript
// 在 imports 添加
import { BuildImageDialog } from '@/components/build-image-dialog'
import { Hammer } from 'lucide-react'

// 在 state 添加
const [buildOpen, setBuildOpen] = useState(false)

// 在按钮区域添加（约第 66-70 行）
<Button size="sm" onClick={() => setBuildOpen(true)}>
  <Hammer className="w-4 h-4 mr-1" />
  构建镜像
</Button>

// 在 dialogs 区域添加
<BuildImageDialog
  open={buildOpen}
  onClose={() => setBuildOpen(false)}
  onBuilt={fetchImages}
  images={images}
/>
```

- [ ] **Step 2: Commit page integration**

```bash
git add app/(dashboard)/settings/images/page.tsx
git commit -m "feat: integrate build image button in settings page"
```

---

### Task 8: 更新镜像列表显示构建来源

**Files:**
- Modify: `components/image-list-table.tsx`

- [ ] **Step 1: 添加 buildType 显示**

在 ImageRow interface 添加 buildType：

```typescript
export interface ImageRow {
  id: string
  repository: string
  tag: string
  digest: string
  os: string
  architecture: string
  compressedSize: number
  isActive: boolean
  pushedAt: string
  importedAt: string
  buildType?: string  // 'import' | 'build'
}
```

在表格添加来源列：

```typescript
// 在 headers 添加（约第 55 行）
<th className="pb-2 font-medium">来源</th>

// 在 tbody 添加（约第 75 行，在状态列前）
<td className="py-3">
  {img.buildType === 'build' ? (
    <Badge variant="outline" className="text-blue-600">构建</Badge>
  ) : (
    <Badge variant="outline" className="text-gray-500">导入</Badge>
  )}
</td>
```

- [ ] **Step 2: Commit table update**

```bash
git add components/image-list-table.tsx
git commit -m "feat: show image source (import/build) in table"
```

---

### Task 9: 构建和部署

- [ ] **Step 1: 构建 Docker 镜像**

Run: `docker compose build --no-cache && docker compose up -d`
Expected: 构建成功，容器启动

- [ ] **Step 2: 手动测试功能**

测试步骤：
1. 登录 Colony 界面
2. 进入镜像管理页面
3. 点击"构建镜像"按钮
4. 选择一个已导入的基础镜像
5. 确认 Dockerfile 模板自动生成
6. 编辑 Dockerfile（添加注释或 RUN 命令）
7. 输入镜像名称和 Tag
8. 点击构建
9. 等待构建完成
10. 确认新镜像出现在列表，来源显示"构建"
11. 将构建的镜像设为生效
12. 创建实例时选择该镜像

---

### Task 10: 推送代码

- [ ] **Step 1: Push to GitHub**

Run: `git push origin master`
Expected: 推送成功