# Skill Hub 设计文档

## 概述

Skill Hub 是 openclaw-colony 平台的技能管理系统，用于管理企业技能(Skill)并下发到 OpenClaw 实例。

## 需求总结

| 维度 | 选择 |
|------|------|
| Skill格式 | 文件夹结构(SKILL.md + scripts/ + references/ + assets/) |
| 存储模式 | 混合：核心skill存DB，外部skill从单Git仓库同步 |
| 下发机制 | 配置绑定：实例绑定skill组，启动时同步，支持手动触发更新 |
| 版本管理 | 完整版本控制：历史记录、回滚、diff查看 |
| 权限模型 | 分级：admin管理所有，operator查看/使用已绑定skill |
| 组织方式 | 标签系统：多标签灵活检索 |
| Git同步 | 单仓库：所有外部skill以文件夹组织 |
| 实例存储 | `{dataDir}/workspace/skills/{skillName}/` |
| 部署验证 | 基本验证：检查SKILL.md格式和必需字段 |

---

## 第一部分：数据模型

### Prisma Schema 新增模型

```prisma
// Skill主体 - 存储skill的基本信息和当前版本
model Skill {
  id          String        @id @default(cuid())
  name        String        @unique          // skill标识名，如"code-review"
  displayName String                         // 显示名称
  description String                         // skill描述
  source      String        @default("local") // 来源: "local" | "git"
  gitPath     String?                        // Git仓库中的路径(source=git时)
  isActive    Boolean       @default(true)   // 是否启用
  createdAt   DateTime      @default(now())
  updatedAt   DateTime      @updatedAt
  createdBy   String
  creator     User          @relation(fields: [createdBy], references: [id])

  // 关联
  tags        SkillToTag[]   // 通过显式关联表实现多对多
  versions    SkillVersion[]
  bindings    SkillBinding[]

  @@index([source])
  @@index([isActive])
}

// Skill版本 - 每次变更的完整快照
model SkillVersion {
  id          String    @id @default(cuid())
  skillId     String
  skill       Skill     @relation(fields: [skillId], references: [id], onDelete: Cascade)
  version     Int                        // 版本号，从1开始递增
  skillMd     String                      // SKILL.md完整内容
  scripts     String?                     // scripts目录内容(JSON格式，文件名->内容)
  references  String?                     // references目录内容(JSON格式)
  assets      String?                     // assets目录内容(JSON格式)
  checksum    String                      // 内容校验和(SHA-256)，用于diff比对
  changeNote  String?                     // 版本变更说明
  createdAt   DateTime  @default(now())
  createdBy   String

  @@unique([skillId, version])
  @@index([skillId])
  @@index([createdAt])
}

// Skill标签 - 多对多关系
model SkillTag {
  id        String      @id @default(cuid())
  name      String      @unique
  skills    SkillToTag[]   // 通过显式关联表实现多对多

  @@index([name])
}

// Skill标签关联表（显式定义，用于查询和管理）
model SkillToTag {
  id        String    @id @default(cuid())
  skillId   String
  skill     Skill     @relation(fields: [skillId], references: [id], onDelete: Cascade)
  tagId     String
  tag       SkillTag  @relation(fields: [tagId], references: [id], onDelete: Cascade)

  @@unique([skillId, tagId])
  @@index([skillId])
  @@index([tagId])
}

// Skill绑定 - 实例与skill的关联
model SkillBinding {
  id            String    @id @default(cuid())
  instanceId    String
  instance      Instance  @relation(fields: [instanceId], references: [id], onDelete: Cascade)
  skillId       String
  skill         Skill     @relation(fields: [skillId], references: [id], onDelete: Cascade)
  version       Int?      // null表示使用最新版本，否则指定版本
  syncStatus    String    @default("pending") // "pending" | "synced" | "failed"
  lastSyncAt    DateTime?
  createdAt     DateTime  @default(now())

  @@unique([instanceId, skillId])
  @@index([instanceId])
  @@index([skillId])
  @@index([syncStatus])
}

// Git同步配置
model GitSyncConfig {
  id          String    @id @default(cuid())
  repoUrl     String                         // Git仓库地址
  branch      String    @default("main")
  accessToken String?                        // 访问令牌(加密存储)
  lastSyncAt  DateTime?
  syncStatus  String    @default("pending")
  createdAt   DateTime  @default(now())
}
```

### 关系说明

- `Skill` → `User`: 创建者关联
- `Skill` ↔ `SkillTag`: 通过`SkillToTag`显式关联表实现多对多标签关系
- `Skill` → `SkillVersion`: 一对多版本历史
- `Instance` ↔ `Skill`: 通过`SkillBinding`多对多绑定
- `SkillBinding.version`: 控制实例使用哪个版本(null=最新版本，查询时按version DESC取第一条)

---

## 第二部分：API端点

### Skill管理API

| 端点 | 方法 | 说明 | 权限 |
|------|------|------|------|
| `/api/skills` | GET | 获取skill列表（支持标签过滤） | admin/operator |
| `/api/skills` | POST | 创建新skill | admin |
| `/api/skills/[id]` | GET | 获取skill详情（含版本历史） | admin/operator |
| `/api/skills/[id]` | PUT | 更新skill（创建新版本） | admin |
| `/api/skills/[id]` | DELETE | 删除skill | admin |
| `/api/skills/[id]/versions/[v]` | GET | 获取指定版本详情 | admin/operator |
| `/api/skills/[id]/versions/[v]/diff` | GET | 版本间diff对比 | admin/operator |
| `/api/skills/[id]/rollback` | POST | 回滚到指定版本 | admin |
| `/api/skills/import` | POST | 从Git导入skill | admin |

### Skill绑定API

| 端点 | 方法 | 说明 | 权限 |
|------|------|------|------|
| `/api/skill-bindings` | GET | 获取绑定列表 | admin/operator |
| `/api/skill-bindings` | POST | 绑定skill到实例 | admin |
| `/api/skill-bindings/[id]` | DELETE | 解绑skill | admin |
| `/api/skill-bindings/sync` | POST | 触发同步到实例 | admin |
| `/api/skill-bindings/sync/[instanceId]` | POST | 同步指定实例的所有绑定skill | admin |

### Git同步API

| 端点 | 方法 | 说明 | 权限 |
|------|------|------|------|
| `/api/git-sync` | GET | 获取Git同步配置 | admin |
| `/api/git-sync` | PUT | 更新Git同步配置 | admin |
| `/api/git-sync/trigger` | POST | 手动触发Git同步 | admin |
| `/api/git-sync/status` | GET | 获取同步状态和日志 | admin |

### 标签API

| 端点 | 方法 | 说明 | 权限 |
|------|------|------|------|
| `/api/skill-tags` | GET | 获取所有标签 | admin/operator |
| `/api/skill-tags` | POST | 创建新标签 | admin |
| `/api/skill-tags/[id]` | DELETE | 删除标签 | admin |

---

## 第三部分：前端页面

### 新增页面结构

```
app/(dashboard)/
├── skills/                     # Skill管理页面
│   ├── page.tsx               # Skill列表页
│   ├── new/page.tsx           # 创建新skill
│   └── [id]/
│       ├── page.tsx           # Skill详情页
│       ├── edit/page.tsx      # 编辑skill（创建新版本）
│       └── versions/
│           ├── page.tsx       # 版本历史列表
│           └── [v]/page.tsx   # 版本详情
│
├── skill-bindings/            # Skill绑定管理
│   ├── page.tsx               # 绑定列表页（按实例分组）
│   └── new/page.tsx           # 创建新绑定
│
├── settings/
│   └── git-sync/page.tsx      # Git同步配置（新增）
│
└── instances/[id]/
│   └── skills/page.tsx        # 实例的skill绑定管理（新增）
```

### 主要组件

```
components/
├── skill-list-table.tsx       # Skill列表表格（支持标签筛选）
├── skill-detail-panel.tsx     # Skill详情面板（显示SKILL.md内容）
├── skill-version-history.tsx  # 版本历史时间线
├── skill-diff-viewer.tsx      # 版本diff对比视图
├── skill-editor.tsx           # Skill编辑器（Markdown编辑+文件上传）
├── skill-binding-card.tsx     # Skill绑定卡片（显示绑定状态）
├── skill-binding-dialog.tsx   # 绑定/解绑操作对话框
├── skill-sync-status.tsx      # 同步状态指示器
├── git-sync-form.tsx          # Git同步配置表单
├── git-sync-log.tsx           # Git同步日志查看器
├── skill-create-dialog.tsx    # 创建skill对话框
├── skill-import-dialog.tsx    # 从Git导入skill对话框
├── skill-tags-select.tsx      # 标签多选组件
```

### 页面功能说明

**Skill列表页 (`/skills`)**
- 表格显示所有skill：名称、描述、标签、来源、状态、版本数
- 支持按标签筛选、搜索
- admin可创建/删除，operator只能查看

**Skill详情页 (`/skills/[id]`)**
- 显示SKILL.md内容（Markdown渲染）
- 显示scripts/references/assets文件列表
- 版本历史侧栏，可切换查看历史版本
- admin可编辑、回滚、删除

**Skill绑定页 (`/skill-bindings`)**
- 按实例分组显示绑定的skill
- 显示同步状态
- admin可绑定/解绑、触发同步
- operator只能查看自己可访问实例的绑定

**实例Skill页 (`/instances/[id]/skills`)**
- 管理单个实例的skill绑定
- 快速绑定/解绑操作
- 触发同步按钮
- 显示实例skill目录当前状态

---

## 第四部分：Skill下发机制

### 同步流程

```
┌─────────────┐     ┌─────────────┐     ┌─────────────────┐
│  Colony DB  │ ──> │ Skill内容   │ ──> │ 实例dataDir     │
│ (Skill表)   │     │ 提取/组装    │     │ workspace/skills│
└─────────────┘     └─────────────┘     └─────────────────┘
```

### 详细流程

**1. 绑定创建时**
```
SkillBinding创建 → status="pending"
```

**2. 触发同步时**
```
API: POST /api/skill-bindings/sync/[instanceId]
  │
  ├─> 查询该实例所有绑定skill
  │
  ├─> 对每个skill:
  │     ├─> 获取指定版本或最新版本内容
  │     ├─> 从SkillVersion提取skillMd/scripts/references/assets
  │     ├─> 组装成文件夹结构
  │     ├─> 写入实例目录: {dataDir}/workspace/skills/{skillName}/
  │     │     ├── SKILL.md
  │     │     ├── scripts/
  │     │     ├── references/
  │     │     └── assets/
  │     └─> 更新SkillBinding.lastSyncAt, syncStatus="synced"
  │
  └─> 返回同步结果
```

**3. 实例启动时自动同步**
```
Instance创建/启动 → 检查SkillBinding → 自动触发同步
```

### 同步策略

| 触发时机 | 行为 |
|----------|------|
| 新建绑定 | 标记pending，等待手动触发同步 |
| 手动触发 | 立即同步，更新状态 |
| skill更新 | 已绑定实例的绑定状态改为pending，提示需重新同步 |
| 实例启动 | 检查pending绑定，自动同步 |

---

## 第五部分：Git同步机制

### Git仓库结构约定

```
skills-git-repo/
├── skill-1/
│   ├── SKILL.md
│   ├── scripts/
│   │   └── helper.py
│   └── references/
│       └── docs.md
├── skill-2/
│   ├── SKILL.md
│   └── assets/
│       └── template.json
└── skill-3/
    └── SKILL.md
```

### 同步流程

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│  Git Remote  │ ──> │  Clone/Pull  │ ──> │  解析导入    │
│   Repository │     │  到临时目录   │     │  到数据库    │
└──────────────┘     └──────────────┘     └──────────────┘
```

### Git同步策略

| 配置项 | 说明 |
|--------|------|
| repoUrl | Git仓库地址（支持HTTPS/SSH） |
| branch | 分支名，默认main |
| accessToken | 访问令牌（可选，私有仓库需要） |

| 触发时机 | 行为 |
|----------|------|
| 配置更新后 | 不自动同步，等待手动触发 |
| 手动触发 | 执行Clone/Pull + 导入 |

---

## 第六部分：Skill验证机制

### SKILL.md格式要求

```markdown
---
name: skill-name
displayName: Skill Display Name
description: What this skill does
---

# Skill Instructions

The actual skill content here...
```

### 必需字段

| 字段 | 类型 | 必需 | 说明 |
|------|------|------|------|
| `name` | string | ✓ | Skill标识符，用于文件命名 |
| `displayName` | string |  | 显示名称，缺失时使用name |
| `description` | string |  | Skill描述，用于列表展示 |

### 验证时机

| 场景 | 验证行为 |
|------|----------|
| 创建新skill | 前端实时验证 + 后端验证，失败则拒绝创建 |
| 更新skill | 同上 |
| Git导入 | 对每个skill文件夹验证，失败则跳过并记录错误 |
| 绑定同步 | 不验证（使用已验证通过的版本） |

---

## 第七部分：版本管理机制

### 版本创建

每次skill更新都创建新的`SkillVersion`记录，版本号从1开始递增。

### 版本管理策略

| 操作 | 行为 |
|------|------|
| 编辑skill | 创建新版本(v+1)，保留历史 |
| 回滚 | 以历史版本内容创建新版本，不修改历史记录 |
| 删除skill | 软删除或硬删除（取决于是否有绑定） |
| 版本查询 | 支持查看任意版本详情、对比任意两个版本 |

---

## 第八部分：权限控制逻辑

### 角色权限矩阵

| 功能 | admin | operator |
|------|-------|----------|
| 查看skill列表 | ✓ | ✓（仅可见已绑定到可访问实例的skill） |
| 查看skill详情 | ✓ | ✓（仅可见已绑定skill） |
| 创建skill | ✓ | ✗ |
| 编辑skill | ✓ | ✗ |
| 删除skill | ✓ | ✗ |
| 版本回滚 | ✓ | ✗ |
| 从Git导入 | ✓ | ✗ |
| 管理标签 | ✓ | ✗ |
| 配置Git同步 | ✓ | ✗ |
| 绑定skill到实例 | ✓ | ✗ |
| 解绑skill | ✓ | ✗ |
| 触发同步 | ✓ | ✗ |
| 查看绑定状态 | ✓ | ✓（仅可访问实例的绑定） |
| 查看版本历史 | ✓ | ✓（仅可见skill） |
| 版本diff对比 | ✓ | ✓（仅可见skill） |

### 实例访问控制（operator）

operator能访问的实例：
- 自己创建的实例（`createdBy === userId`）

---

## 系统架构图

```
┌─────────────────────────────────────────────────────────────────────┐
│                        Skill Hub 系统架构                            │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐          │
│  │  Git仓库     │───>│  Git同步     │───>│  Skill表     │          │
│  │ (外部skill)  │    │  导入解析    │    │  (数据库)    │          │
│  └──────────────┘    └──────────────┘    └──────────────┘          │
│                                                │                    │
│                                                v                    │
│                                         ┌──────────────┐           │
│                                         │ SkillVersion │           │
│                                         │  (版本历史)   │           │
│                                         └──────────────┘           │
│                                                │                    │
│                                                v                    │
│                                         ┌──────────────┐           │
│                                         │ SkillBinding │           │
│                                         │  (实例绑定)   │           │
│                                         └──────────────┘           │
│                                                │                    │
│                                                v                    │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐          │
│  │ OpenClaw实例 │<───│  同步下发     │<───│  Skill内容   │          │
│  │              │    │              │    │  提取组装    │          │
│  └──────────────┘    └──────────────┘    └──────────────┘          │
│        │                                                        │
│        v                                                        │
│  ┌──────────────┐                                               │
│  │workspace/    │                                               │
│  │skills/{name} │                                               │
│  └──────────────┘                                               │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```