'use client'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Trash2, CheckCircle } from 'lucide-react'

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
  buildType?: string
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
          <th className="pb-2 font-medium">来源</th>
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
              {img.buildType === 'build' ? (
                <Badge className="bg-blue-100 text-blue-700 border-blue-200">构建</Badge>
              ) : (
                <Badge className="bg-gray-100 text-gray-700 border-gray-200">导入</Badge>
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