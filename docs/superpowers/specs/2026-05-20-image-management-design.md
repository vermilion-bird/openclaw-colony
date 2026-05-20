# Image Management Module Design

**Date:** 2026-05-20
**Topic:** Docker Image Management for OpenClaw Colony Platform

## Overview

This module enables administrators to manage container images used when creating OpenClaw instances. Images are sourced from Docker Hub's official `openclaw/openclaw` repository. Admins import specific tags, validate against Docker Hub API, and designate one as "active" for new instance creation.

## Database Schema

### Image Model

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
```

### AuditLog Model

```prisma
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

### User Model Updates

Add relations for imported images and audit logs:

```prisma
model User {
  // existing fields...
  importedImages Image[]
  auditLogs      AuditLog[]
}
```

### Instance Model Updates

- Remove default value from `imageTag` field
- Runtime validation: require active image before creating new instance

## API Routes

### Endpoints

| Route | Method | Auth | Description |
|-------|--------|------|-------------|
| `/api/images` | GET | admin | List images (paginated, `pushedAt` desc) |
| `/api/images` | POST | admin | Import image (`{ tag }`) |
| `/api/images/[id]/activate` | PATCH | admin | Set as active |
| `/api/images/[id]` | DELETE | admin | Delete image record |
| `/api/images/validate` | POST | admin | Validate tag on Docker Hub |

### Implementation Details

**Docker Hub API Integration:**
- Endpoint: `GET https://hub.docker.com/v2/repositories/openclaw/openclaw/tags/{tag}`
- Timeout: 5 seconds, 1 retry on failure
- No authentication required (public repository)

**Response Mapping:**
- `name` → `tag`
- `digest` → `digest` (unique identifier)
- `last_pushed` → `pushedAt`
- `full_size` → `compressedSize`
- `images[].os` → `os`
- `images[].architecture` → `architecture`

**Activate Endpoint:**
- Use Prisma `$transaction` with row-level locking
- First: set all `isActive = false`
- Then: set target `isActive = true`
- Prevents concurrent race conditions

**Cache Strategy:**
- In-memory cache for Docker Hub tag metadata
- TTL: 10 minutes
- Key: tag string (e.g., "latest", "v1.2.0")
- Reduces API calls to avoid rate limiting (100 requests/6 hours for anonymous)

## UI Components

### Page Location

Route: `/settings/images` (admin-only, accessible via navigation)

### Components

**1. ImageList Table**
- Columns: Tag, Digest (first 12 chars), Architecture, Size, Pushed At, Status, Actions
- Status Badge: green "生效" for active, gray "未生效" for inactive
- Actions: "设为生效" button (disabled if active), "删除" button
- Pagination: 10 items per page

**2. ImportImageDialog**
- Trigger: "导入镜像" button (top right)
- Input field: Tag (placeholder: "如 latest、v1.2.0")
- Helper text: link to Docker Hub openclaw/openclaw page
- "查询" button: calls `/api/images/validate`, shows preview card
- Preview displays: Tag, Digest, OS/Arch, Size, Pushed At
- "确认导入" button: enabled only after successful preview

**3. DeleteConfirmDialog**
- Normal image: single confirmation "删除后数据将无法恢复"
- Active image: red warning banner + text "该镜像当前生效，删除后将无生效镜像，新建 OpenClaw 可能失败，请谨慎操作"

**4. EmptyState**
- Message: "暂无镜像，点击右上角「导入镜像」添加 openclaw 版本"

### Navigation Update

Add "镜像" link in dashboard header nav, visible only to admins (same pattern as "用户" link).

## Instance Creation Integration

**Default Image Selection:**
- When creating instance, `imageTag` defaults to `${repository}:${tag}` of active image
- If no active image exists, show error banner: "请先在镜像管理中设置生效镜像"
- Instance creation API returns 400 if no active image configured

**Optional Override:**
- Add dropdown in instance creation form to select from imported images
- User can choose different image than the active default

## Error Handling

| Scenario | User Message |
|----------|--------------|
| Docker Hub 404 | "Tag 不存在，请前往 Docker Hub 确认版本号" |
| Digest duplicate | "该版本已导入（digest 相同）" |
| `latest` same digest | "当前 latest 版本已是最新" |
| No active image | "请先在镜像管理中设置生效镜像" |
| Docker Hub timeout | "查询超时，请稍后重试" |
| Docker Hub rate limit | "Docker Hub API 限流，请稍后重试" |
| Unauthorized | 401 response |
| Non-admin access | 403 response |

## Testing Requirements

**API Tests:**
- GET /api/images: pagination, sorting, auth check
- POST /api/images: validation, Docker Hub mock, digest uniqueness
- PATCH activate: transaction behavior, concurrent requests
- DELETE: soft delete, active image warning
- POST validate: Docker Hub API responses (success, 404, timeout)

**UI Tests:**
- Image list rendering
- Import dialog flow
- Delete confirmation flows
- Active/inactive badge display
- Empty state display

**Integration Tests:**
- Instance creation with active image
- Instance creation without active image (error)
- Image selection override in instance form