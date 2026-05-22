# 镜像 Tag 选择功能设计

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 新建实例时，用户可以从已导入镜像列表中选择镜像 Tag

**Architecture:** 前端新增下拉选择模式，复用现有镜像列表 API，无需后端改动

**Tech Stack:** React, Next.js, Select 组件（已存在）

---

## 功能描述

新建实例页面中，镜像 Tag 字段默认显示生效镜像的完整名称（如 `openclaw/openclaw:2026.5.7`）。用户可以切换为下拉选择模式，从数据库中已导入的镜像列表选择其他镜像。

## 当前行为

- 页面加载时自动获取生效镜像，填充到 `imageTag` 输入框
- 用户可以在"高级选项"中手动修改 `imageTag` 值
- 无下拉选择功能

## 新行为

- 默认：Input 显示生效镜像完整名称（`repository:tag`）
- 切换：点击按钮切换为 Select 下拉框
- Select 内容：所有已导入镜像，格式为 `repository:tag`
- 默认选中：生效镜像
- 可切换回手动输入模式

## 实现细节

### 前端改动

**文件：** `app/(dashboard)/instances/new/page.tsx`

**新增状态：**
```typescript
const [imageSelectMode, setImageSelectMode] = useState(false)
const [importedImages, setImportedImages] = useState<ImageRow[]>([])
```

**数据获取：**
页面加载时获取镜像列表（与生效镜像获取并行）：
```typescript
fetch('/api/images')
  .then(res => res.json())
  .then(data => setImportedImages(data.images))
```

**UI 结构：**
```tsx
<div className="space-y-1">
  <Label htmlFor="imageTag">镜像 Tag</Label>
  <div className="flex gap-2">
    {imageSelectMode ? (
      <Select value={form.imageTag} onValueChange={v => set('imageTag', v)}>
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
        placeholder="openclaw/openclaw:latest"
      />
    )}
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={() => setImageSelectMode(!imageSelectMode)}
    >
      {imageSelectMode ? '手动输入' : '选择镜像'}
    </Button>
  </div>
</div>
```

### 后端改动

无需改动。现有 API 已满足需求：
- `GET /api/images` 返回镜像列表
- `POST /api/instances` 接受 `imageTag` 参数

## 测试要点

1. 页面加载后，默认显示生效镜像完整名称
2. 点击"选择镜像"按钮，切换为下拉框
3. 下拉框列出所有已导入镜像
4. 选择镜像后，值更新到表单
5. 点击"手动输入"按钮，切换回输入框，保留当前值
6. 提交表单创建实例，使用正确的镜像 Tag