# 镜像构建功能设计

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 镜像管理页面支持用户基于已导入镜像编辑 Dockerfile 并构建自定义镜像

**Architecture:** Colony 通过 docker.sock 调用宿主机 BuildKit 构建镜像，构建完成后自动导入镜像列表

**Tech Stack:** Next.js, Docker API (dockerode), SSE (Server-Sent Events) 用于实时日志

---

## 功能描述

在镜像管理页面新增"构建镜像"功能。用户选择一个已导入的镜像作为基础，系统自动生成 Dockerfile 模板，用户编辑后提交构建。构建通过 docker.sock 在宿主机上使用 BuildKit 执行，构建完成后自动导入到镜像列表。

## 数据模型

### Image 表扩展

新增字段：
- `buildType: 'import' | 'build'` - 区分镜像来源（默认 'import'）
- `dockerfile: String?` - Dockerfile 内容（仅构建镜像）
- `baseImageId: String?` - 基础镜像 ID（仅构建镜像）

### Prisma Schema 变更

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
  dockerfile     String?
  baseImageId    String?

  @@index([isActive])
  @@index([pushedAt])
  @@index([buildType])
}
```

## 前端 UI

### 镜像管理页面改动

在页面顶部按钮区域新增"构建镜像"按钮，与"导入镜像"并列。

### 构建镜像对话框 (BuildImageDialog)

组件结构：
1. 基础镜像选择（Select 下拉框，显示已导入镜像）
2. Dockerfile 编辑区（Textarea 或代码编辑器）
3. 镜像名称/Tag 输入（格式：`name:tag`）
4. 构建按钮
5. 构建日志显示区（实时滚动，SSE 接收）

### 交互流程

1. 打开构建对话框
2. 选择基础镜像 → 自动生成 Dockerfile 模板
3. 用户编辑 Dockerfile
4. 输入目标镜像名称和 Tag
5. 点击构建 → 显示日志区
6. 实时显示构建日志
7. 构建完成 → 自动关闭对话框，刷新镜像列表
8. 构建失败 → 显示错误，用户可修改后重试

## 后端 API

### POST /api/images/build

请求体：
```json
{
  "baseImageId": "xxx",
  "dockerfile": "FROM openclaw/openclaw:xxx\n...",
  "imageName": "my-openclaw",
  "imageTag": "v1"
}
```

处理流程：
1. 验证用户权限（admin）
2. 创建临时目录存放 Dockerfile
3. 调用 Docker API 执行构建
4. 构建成功后获取镜像 digest
5. 创建 Image 记录（buildType='build'）
6. 返回构建结果

### GET /api/images/build/[id]/logs

SSE 端点，流式返回构建日志：
- 使用 Server-Sent Events
- 每行日志作为一个 event
- 构建完成发送 `done` event

## Docker 构建实现

### 构建命令

使用 dockerode API：
```typescript
const stream = await docker.buildImage({
  context: tempDir,
  src: ['Dockerfile'],
}, {
  t: `${imageName}:${imageTag}`,
  buildkit: true,  // 使用 BuildKit
})
```

### 日志流处理

BuildKit 输出格式为 JSON 流，需要解析并转发：
```typescript
stream.on('data', (chunk) => {
  const line = JSON.parse(chunk.toString())
  if (line.stream) {
    // 发送 SSE event
  }
})
```

## Dockerfile 模板生成

选择基础镜像后，生成模板：
```dockerfile
FROM {repository}:{tag}

# 在此添加自定义配置
# 示例：
# RUN apk add --no-cache vim curl
# ENV MY_VAR=value
# COPY custom-config.yaml /app/config/
```

## 测试要点

1. 选择基础镜像后正确生成 Dockerfile 模板
2. 构建成功后镜像出现在镜像列表
3. 构建的镜像可设为生效镜像
4. 构建的镜像可用于创建实例
5. 构建日志实时显示
6. 构建失败时显示错误信息
7. 重复构建相同 name:tag 时提示覆盖确认