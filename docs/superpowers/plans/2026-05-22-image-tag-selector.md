# 镜像 Tag 选择功能实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 新建实例时，用户可以从已导入镜像列表中选择镜像 Tag

**Architecture:** 前端新增下拉选择模式，复用现有镜像列表 API 和 Select 组件，无需后端改动

**Tech Stack:** React, Next.js, TypeScript, shadcn/ui Select 组件

---

## 文件结构

| 文件 | 责任 |
|------|------|
| `app/(dashboard)/instances/new/page.tsx` | 实例创建页面，新增镜像选择下拉框 |
| `components/image-list-table.tsx` | 提供 `ImageRow` 类型定义（已存在，导入使用） |

---

### Task 1: 添加镜像列表获取和状态管理

**Files:**
- Modify: `app/(dashboard)/instances/new/page.tsx`

- [ ] **Step 1: 添加 import 和状态**

在文件顶部添加 import，并新增两个状态变量：

```typescript
// 在第 9 行后添加 import
import { ImageRow } from '@/components/image-list-table'

// 在第 19 行后添加状态（在 activeImage 状态后）
const [imageSelectMode, setImageSelectMode] = useState(false)
const [importedImages, setImportedImages] = useState<ImageRow[]>([])
```

- [ ] **Step 2: 添加镜像列表获取**

在 useEffect 中并行获取镜像列表：

```typescript
// 修改第 30-44 行的 useEffect
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

    // Fetch all imported images for selector
    fetch('/api/images')
      .then(res => res.json())
      .then(data => setImportedImages(data.images || []))
      .catch(() => setImportedImages([]))
  }, [])
```

- [ ] **Step 3: 本地验证 TypeScript 编译**

Run: `npx tsc --noEmit --skipLibCheck`
Expected: 无类型错误

- [ ] **Step 4: Commit**

```bash
git add app/(dashboard)/instances/new/page.tsx
git commit -m "feat: add imported images state and fetch in new instance form"
```

---

### Task 2: 实现镜像 Tag 选择 UI

**Files:**
- Modify: `app/(dashboard)/instances/new/page.tsx`

- [ ] **Step 1: 替换镜像 Tag 输入字段为可切换模式**

找到高级选项中的镜像 Tag 字段（约第 161-172 行），替换为新的 UI 结构：

```tsx
// 替换第 161-172 行的镜像 Tag 字段区域
<div className="space-y-1">
  <Label htmlFor="imageTag">镜像 Tag</Label>
  <div className="flex gap-2">
    {imageSelectMode ? (
      <Select value={form.imageTag} onValueChange={v => set('imageTag', v ?? '')}>
        <SelectTrigger className="flex-1"><SelectValue /></SelectTrigger>
        <SelectContent>
          {importedImages.map(img => (
            <SelectItem key={img.id} value={`${img.repository}:${img.tag}`}>
              {img.repository}:{img.tag}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    ) : (
      <Input
        id="imageTag"
        className="flex-1"
        value={form.imageTag}
        onChange={e => set('imageTag', e.target.value)}
        placeholder={activeImage ? `${activeImage.repository}:${activeImage.tag}` : 'openclaw/openclaw:latest'}
      />
    )}
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={() => setImageSelectMode(!imageSelectMode)}
      className="whitespace-nowrap"
    >
      {imageSelectMode ? '手动输入' : '选择镜像'}
    </Button>
  </div>
  {activeImage && !imageSelectMode && (
    <p className="text-xs text-gray-400">当前生效镜像: {activeImage.repository}:{activeImage.tag}</p>
  )}
</div>
```

- [ ] **Step 2: 本地验证 TypeScript 编译**

Run: `npx tsc --noEmit --skipLibCheck`
Expected: 无类型错误

- [ ] **Step 3: Commit**

```bash
git add app/(dashboard)/instances/new/page.tsx
git commit -m "feat: implement image tag selector with toggle between select and input modes"
```

---

### Task 3: 构建和部署

**Files:**
- Modify: `docker-compose.yml` (无需改动)

- [ ] **Step 1: 构建 Docker 镜像**

Run: `docker compose build --no-cache && docker compose up -d`
Expected: 构建成功，容器启动

- [ ] **Step 2: 验证功能**

手动测试：
1. 访问 https://colony.8tb.cc/instances/new
2. 确认默认显示生效镜像
3. 点击"选择镜像"按钮，确认下拉框显示已导入镜像
4. 选择不同镜像，确认值更新
5. 点击"手动输入"，确认切换回输入框
6. 创建实例，确认使用正确镜像 Tag

- [ ] **Step 3: Commit 如果有修复**

如有构建或运行时错误，修复后提交：
```bash
git add -A
git commit -m "fix: resolve build/deployment issues"
```

---

### Task 4: 推送代码

- [ ] **Step 1: Push to GitHub**

Run: `git push origin master`
Expected: 推送成功