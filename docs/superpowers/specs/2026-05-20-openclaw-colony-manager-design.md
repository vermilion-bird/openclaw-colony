# OpenClaw Colony Manager — Design Spec

**Date:** 2026-05-20  
**Stack:** Next.js 14+ (App Router) · TypeScript · dockerode · Prisma + SQLite · NextAuth.js · Tailwind + shadcn/ui  
**Deployment:** 单容器，挂载 `/var/run/docker.sock`

---

## Context

当前仓库 (`bv_openclaw_colony`) 是 OpenClaw AI 网关的**单实例** Docker 部署配置，为 1Panel 打包。缺少多实例管理能力。

本系统（Colony Manager）在同一宿主机上作为独立 Web 服务运行，通过 Docker socket 创建和管理任意数量的 OpenClaw 实例，提供统一 UI 界面。

---

## 1. Architecture

```
Browser ──► Next.js (port 3000)
              ├── App Router (React pages)
              ├── API Routes (REST)
              │     └── dockerode ──► /var/run/docker.sock
              └── Prisma ORM ──► SQLite (./data/colony.db)
```

- **单容器部署**：Colony Manager 本身运行在容器中，通过 volume 挂载 docker socket
- **管理容器方式**：dockerode SDK（Node.js），不依赖 CLI exec
- **持久化**：SQLite 存元数据；OpenClaw 实例数据挂载到宿主机目录
- **认证**：NextAuth.js Credentials Provider，JWT session，两种角色

---

## 2. Data Model (Prisma Schema)

### User
| 字段 | 类型 | 说明 |
|------|------|------|
| id | String (cuid) | PK |
| email | String (unique) | 登录账号 |
| passwordHash | String | bcrypt hash |
| role | Enum: admin \| operator | admin 可管理用户和删除实例 |
| createdAt | DateTime | |

### Instance
| 字段 | 类型 | 说明 |
|------|------|------|
| id | String (cuid) | PK |
| name | String (unique) | 实例名，用于容器命名 |
| containerId | String? | Docker 容器 ID（创建后赋值） |
| imageTag | String | 如 `1panel/openclaw:2026.5.7` |
| port | Int (unique) | 宿主机映射端口 |
| provider | String | 模型提供商（deepseek/openai/…） |
| model | String | 模型名 |
| apiKey | String | 加密存储 |
| baseUrl | String? | 自定义 endpoint |
| bindAddress | String | `127.0.0.1` 或 `0.0.0.0` |
| allowedOrigin | String? | 外部访问 HTTPS 地址 |
| cpuLimit | Float | 默认 2.0 |
| memoryLimit | String | 默认 `2G` |
| status | Enum: creating\|running\|stopped\|unhealthy\|error | |
| createdAt | DateTime | |
| createdBy | String | User.id |

> `apiKey` 用 AES-256-GCM 加密，密钥来自 `ENCRYPTION_KEY` 环境变量。

---

## 3. Feature Specifications

### 3.1 认证 (Auth)
- Email + password 登录，NextAuth.js Credentials
- Session 有效期 7 天，JWT 存 `role` 和 `userId`
- 未登录访问任意路由 → 重定向到 `/login`
- 首次启动若无用户，访问 `/setup` 创建初始 admin

### 3.2 实例列表 Dashboard (`/`)
- 卡片网格，每张卡片展示：实例名、状态 badge、端口、提供商/模型、CPU/内存使用率
- 顶部快捷操作：批量启动/停止
- 每个卡片快捷按钮：启动 / 停止 / 重启 / 日志 / 配置 / 打开面板 / 删除
- 状态自动刷新：每 10s 轮询一次

### 3.3 创建实例 (`/instances/new`)
**表单字段：**
- 实例名（仅小写字母/数字/横杠，唯一，用于容器名 `openclaw-{name}` 和数据目录）
- 镜像 Tag（默认 `1panel/openclaw:2026.5.7`，可自定义）
- 端口（自动建议下一个可用端口，从 18789 起）
- 提供商（下拉：deepseek / openai / anthropic / gemini / ollama / openrouter / vllm / minimax / …）
- 模型名（文本输入）
- API Key（password 输入）
- Base URL（可选，用于 Ollama 等自定义 endpoint）
- CPU 上限（默认 2）
- 内存上限（默认 2G）
- 绑定地址（127.0.0.1 / 0.0.0.0）
- 允许来源（可选 HTTPS URL）
- 资源数据目录（默认 `{DATA_ROOT}/{name}`，高级选项可自定义）

**创建流程：**
1. 校验表单（名称唯一、端口未占用）
2. DB 写入 Instance 记录（status: creating）
3. `docker.createContainer(...)` with env vars、volume mounts、port bindings、resource limits
4. `container.start()`
5. 更新 DB：containerId、status: running

### 3.4 启动 / 停止 / 重启
- 直接调用 `container.start()` / `container.stop()` / `container.restart()`
- 操作后立即刷新状态
- stop 超时 30s（graceful shutdown）

### 3.5 删除实例
- 弹窗确认
- 可选 checkbox：同时删除数据目录（`{DATA_ROOT}/{name}/`）
- 流程：stop → remove container → 可选删除目录 → 删除 DB 记录

### 3.6 编辑配置
> Docker 不支持对运行中容器修改 env vars，需重建容器。

- 弹出 Sheet 展示当前配置（env vars 可编辑）
- 保存时警告："此操作会重启实例，数据保留，连接中断约 5s"
- 流程：stop → remove container → recreate with new config → start → update DB

### 3.7 日志查看
- 弹出 Dialog，Server-Sent Events 流式推送
- 初始加载最近 200 行（`tail: 200`）
- 自动滚动，可暂停
- 实现：`container.logs({ follow: true, stdout: true, stderr: true })` → SSE endpoint

### 3.8 资源监控
- 卡片内 mini 指标：CPU %、内存 used/limit
- 点击卡片进入详情页 → 近 5 分钟折线图（前端轮询 `/api/instances/:id/stats`，5s 间隔）
- 实现：`container.stats({ stream: false })` 计算 CPU delta

### 3.9 跳转 OpenClaw 面板
- 后端读取 `{DATA_ROOT}/{name}/conf/openclaw.json` 取 token
- 若文件不存在（实例未初始化），提示"实例尚未完成初始化，请稍候"
- 返回带 token 的 URL，前端在新标签打开：`http://{HOST_IP}:{port}?token={token}`
- `HOST_IP` 来自 Colony Manager 环境变量，默认 `127.0.0.1`

### 3.10 用户管理 (`/settings/users`，仅 admin)
- 列表展示：邮箱、角色、创建时间
- 创建用户（邮箱 + 临时密码）
- 修改角色
- 停用/删除用户（不可删除唯一 admin）

---

## 4. API Routes

| Method | Path | 权限 | 说明 |
|--------|------|------|------|
| POST | `/api/instances` | operator+ | 创建实例 |
| GET | `/api/instances` | operator+ | 列举实例（含实时状态） |
| GET | `/api/instances/:id` | operator+ | 实例详情 |
| DELETE | `/api/instances/:id` | admin | 删除实例 |
| POST | `/api/instances/:id/start` | operator+ | 启动 |
| POST | `/api/instances/:id/stop` | operator+ | 停止 |
| POST | `/api/instances/:id/restart` | operator+ | 重启 |
| PUT | `/api/instances/:id/config` | operator+ | 更新配置（触发重建） |
| GET | `/api/instances/:id/logs` | operator+ | SSE 日志流 |
| GET | `/api/instances/:id/stats` | operator+ | 资源使用快照 |
| GET | `/api/instances/:id/token` | operator+ | 读取 OpenClaw token |
| GET | `/api/users` | admin | 列举用户 |
| POST | `/api/users` | admin | 创建用户 |
| PUT | `/api/users/:id` | admin | 更新角色 |
| DELETE | `/api/users/:id` | admin | 删除用户 |

---

## 5. Docker Container Spec

每个被管理的 OpenClaw 实例按以下规格创建：

```
容器名：  openclaw-{instanceName}
镜像：    {imageTag}
标签：    { "openclaw.managed": "true", "openclaw.instance": "{name}" }
端口：    {bindAddress}:{port}:18789/tcp
挂载：
  - {DATA_ROOT}/{name}/conf  → /home/node/.openclaw
  - {DATA_ROOT}/{name}/workspace → /home/node/.openclaw/workspace
  - /etc/localtime → /etc/localtime (ro)
环境变量：
  - PROVIDER, MODEL, API_KEY, BASE_URL
  - ALLOWED_ORIGIN, OPENCLAW_GATEWAY_TOKEN (可选)
资源：    NanoCpus = cpuLimit * 1e9, Memory = parseMemory(memoryLimit)
重启策略：unless-stopped
```

Colony Manager 自身的 compose 配置：

```yaml
services:
  openclaw-colony:
    image: openclaw-colony:latest
    ports:
      - "3000:3000"
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock
      - ./data:/app/data           # SQLite DB + 实例数据目录
    environment:
      - NEXTAUTH_SECRET=<random>
      - NEXTAUTH_URL=http://localhost:3000
      - DATABASE_URL=file:/app/data/colony.db
      - ENCRYPTION_KEY=<32-char-random>
      - DATA_ROOT=/app/data/instances
      - HOST_IP=127.0.0.1          # 宿主机可访问地址，用于生成 OpenClaw 面板链接
    restart: unless-stopped
```

---

## 6. Project Structure

```
openclaw-colony/
├── app/
│   ├── (auth)/login/page.tsx
│   ├── (auth)/setup/page.tsx      # 初始化 admin 账号
│   ├── (dashboard)/
│   │   ├── page.tsx               # 实例列表
│   │   ├── instances/new/page.tsx # 创建表单
│   │   └── settings/users/page.tsx
│   └── api/
│       ├── instances/[...route]/route.ts
│       └── users/[...route]/route.ts
├── lib/
│   ├── docker.ts                  # dockerode 封装
│   ├── crypto.ts                  # AES-256-GCM 加密工具
│   └── auth.ts                    # NextAuth 配置
├── prisma/
│   └── schema.prisma
├── components/
│   ├── instance-card.tsx
│   ├── instance-form.tsx
│   ├── log-viewer.tsx
│   └── stats-chart.tsx
├── Dockerfile
├── docker-compose.yml
└── .env.example
```

---

## 7. UI Pages

| 路由 | 说明 |
|------|------|
| `/login` | 登录页 |
| `/setup` | 首次运行初始化（无用户时才可访问） |
| `/` | 实例 Dashboard（卡片网格） |
| `/instances/new` | 创建实例表单 |
| `/instances/[id]` | 实例详情（资源监控图表、配置查看） |
| `/settings/users` | 用户管理（仅 admin） |

---

## 8. Error Handling

- **Docker socket 不可用**：启动时检查，主页显示错误 banner，API 返回 503
- **容器创建失败**：DB 回滚、状态置 `error`、返回 Docker 错误信息
- **端口冲突**：创建前检查宿主机端口占用（`net.connect`），提前报错
- **实例数据目录权限问题**：容器内以 uid 1000（node）运行，宿主机目录需 chown 或设 777
- **token 文件不存在**：UI 提示"实例尚未完成初始化"，等待 readyz 成功后自动重试

---

## 9. Security

- API Key 用 AES-256-GCM 加密存 SQLite，ENCRYPTION_KEY 仅在环境变量
- Docker socket 挂载有安全风险（等同于 root 权限）；文档中说明仅内网/受信环境使用
- NextAuth.js JWT 签名用 `NEXTAUTH_SECRET`
- CSRF：Next.js App Router 内置保护
- 输入校验：Zod schema 校验所有 API 请求

---

## 10. Testing Strategy

| 层级 | 工具 | 覆盖点 |
|------|------|--------|
| Unit | Vitest | `lib/docker.ts` 封装、crypto、schema 校验 |
| Integration | Vitest + testcontainers | API Routes 端到端（真实 Docker） |
| E2E | Playwright | 登录 → 创建实例 → 启动 → 查看日志 → 删除 |
