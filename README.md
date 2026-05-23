# OpenClaw Colony

[![License](https://img.shields.io/badge/license-Apache%202.0-blue.svg)](LICENSE)
[![Tests](https://img.shields.io/badge/tests-202%20passing-green.svg)](tests)
[![Coverage](https://img.shields.io/badge/coverage-76%25-green.svg)](tests)

OpenClaw AI 网关集群管理平台 - 在单台宿主机上管理和监控多个 OpenClaw 代理实例。

## 功能特性

### 核心功能

- **实例管理** - 创建、启动、停止、重启、删除 OpenClaw 实例，支持自定义镜像、端口、资源配置
- **资源监控** - 实时 CPU、内存使用率监控，流式日志查看，状态自动刷新
- **镜像管理** - 导入 Docker Hub/ghcr.io 镜像，自定义构建镜像，版本激活管理
- **用户管理** - Admin/Operator 双角色权限，用户创建、角色修改、审计日志
- **飞书集成** - 飞书机器人配置，私聊/群聊策略，白名单管理

### 安全模块

三层安全防护架构：

| 层级 | 功能 | 延迟 |
|------|------|------|
| 输入层 | 防 Prompt 注入（关键词检测 + 意图分类） | ~200ms |
| 处理层 | PII 识别脱敏（身份证、手机、银行卡、邮箱 + 自定义规则） | <5ms/chunk |
| 输出层 | 合规审查（敏感词黑名单 + 内容分类） | 流式检测 |

## 系统架构

```
浏览器 → Colony Manager (Next.js + Dockerode) → Docker Socket → OpenClaw 实例群
```

- **单容器部署**：Colony Manager 通过 volume 挂载 docker socket
- **管理容器方式**：dockerode SDK（Node.js），不依赖 CLI exec
- **持久化**：SQLite/PostgreSQL 存元数据；OpenClaw 实例数据挂载到宿主机目录
- **认证**：NextAuth.js Credentials Provider，JWT session，双角色权限

## 快速开始

### 1. 克隆项目

```bash
git clone https://github.com/vermilion-bird/openclaw-colony.git
cd openclaw-colony
```

### 2. 配置环境变量

```bash
cp .env.example .env
```

编辑 `.env` 设置必要变量：

| 变量 | 说明 |
|------|------|
| `NEXTAUTH_SECRET` | NextAuth JWT 签名密钥（随机 32 字符） |
| `ENCRYPTION_KEY` | API Key 加密密钥（随机 32 字符） |
| `DATABASE_URL` | 数据库连接（默认 SQLite） |
| `DATA_ROOT` | 实例数据目录 |
| `HOST_IP` | 宿主机可访问地址 |

### 3. Docker Compose 启动

```bash
docker-compose up -d
```

### 4. 访问管理面板

打开 http://localhost:3000，首次访问会引导创建 admin 账号。

## 技术栈

| 技术 | 版本 | 用途 |
|------|------|------|
| Next.js | 16 | 前端框架 + API 路由 |
| TypeScript | 5 | 类型安全 |
| Prisma | 7 | 数据库 ORM |
| Dockerode | 5 | Docker API 客户端 |
| NextAuth.js | 5-beta | 认证授权 |
| Tailwind CSS | 4 | 样式框架 |
| shadcn/ui | 4 | UI 组件库 |
| Vitest | 4 | 单元测试 |

## 项目结构

```
openclaw-colony/
├── app/                    # Next.js App Router
│   ├── (auth)/             # 登录、初始化页面
│   ├── (dashboard)/        # 实例管理、设置页面
│   └── api/                # REST API 路由
│       ├── instances/      # 实例 CRUD、操作接口
│       ├── images/         # 镜像管理接口
│       ├── users/          # 用户管理接口
│       └── admin/          # 管理员专用接口
├── lib/                    # 业务逻辑
│   ├── docker.ts           # Docker 容器操作
│   ├── auth.ts             # 认证配置
│   ├── crypto.ts           # AES-256-GCM 加密
│   └── security/           # 安全模块
│       ├── input-guard/    # 输入层防注入
│       ├── pii-filter/     # 处理层 PII 脱敏
│       └── output-guard/   # 输出层合规审查
├── components/             # React 组件
│   ├── instance-card.tsx   # 实例卡片
│   ├── log-viewer.tsx      # 日志流查看
│   └── ui/                 # shadcn/ui 组件
├── prisma/                 # 数据库 schema
├── tests/                  # 测试文件
│   ├── api/                # API 集成测试
│   └── security/           # 安全模块测试
├── docs-site/              # GitHub Pages 介绍页
└── docker-compose.yml      # 部署配置
```

## API 路由

| Method | Path | 权限 | 说明 |
|--------|------|------|------|
| POST | `/api/instances` | operator+ | 创建实例 |
| GET | `/api/instances` | operator+ | 列举实例 |
| POST | `/api/instances/:id/start` | operator+ | 启动 |
| POST | `/api/instances/:id/stop` | operator+ | 停止 |
| POST | `/api/instances/:id/restart` | operator+ | 重启 |
| DELETE | `/api/instances/:id` | admin | 删除实例 |
| GET | `/api/instances/:id/logs` | operator+ | SSE 日志流 |
| GET | `/api/images` | admin | 列举镜像 |
| POST | `/api/images` | admin | 导入镜像 |
| PATCH | `/api/images/:id/activate` | admin | 激活镜像 |
| GET | `/api/users` | admin | 列举用户 |
| POST | `/api/users` | admin | 创建用户 |

## 安全模块使用

```typescript
import { processWithSecurity, isWhitelisted } from '@/lib/security'

// 白名单检查
if (isWhitelisted(channelId, userId)) {
  // 绕过安全检查
}

// 安全处理
const result = await processWithSecurity({
  channelId: 'test_channel',
  userId: 'user_123',
  message: '用户消息内容',
  timestamp: new Date(),
})

if (!result.passed) {
  // 拦截处理
  console.log(result.reason)
}
```

## 测试

```bash
# 运行全部测试
npm run test

# 监听模式
npm run test:watch

# 查看覆盖率
npm run test -- --coverage
```

## 文档

- [设计文档](docs/superpowers/specs/2026-05-20-openclaw-colony-manager-design.md)
- [安全模块设计](docs/superpowers/specs/2026-05-22-security-module-design.md)
- [实现计划](docs/superpowers/plans/2026-05-22-security-module-plan.md)

## 贡献

欢迎提交 Issue 和 Pull Request。

## 许可证

Apache 2.0 License

## 项目主页

https://vermilion-bird.github.io/openclaw-colony/