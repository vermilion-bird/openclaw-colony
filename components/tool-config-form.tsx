'use client'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Plus, X } from 'lucide-react'

interface ToolConfig {
  profile?: 'minimal' | 'coding' | 'messaging' | 'full'
  allow?: string[]
  deny?: string[]
}

interface Props {
  value: ToolConfig
  onChange: (config: ToolConfig) => void
}

const TOOL_PROFILE_OPTIONS = [
  { value: 'minimal', label: 'Minimal (session_status only)' },
  { value: 'coding', label: 'Coding (fs, runtime, web, sessions)' },
  { value: 'messaging', label: 'Messaging (messaging + sessions)' },
  { value: 'full', label: 'Full (no restriction)' },
]

const TOOL_HINTS = [
  'group:runtime', 'group:fs', 'group:sessions', 'group:web', 'group:memory',
  'exec', 'process', 'code_execution',
  'read', 'write', 'edit', 'apply_patch',
  'web_search', 'web_fetch', 'x_search',
  'browser', 'image', 'image_generate', 'tts',
  'sessions_list', 'sessions_history',
]

export function ToolConfigForm({ value, onChange }: Props) {
  const [newAllow, setNewAllow] = useState('')
  const [newDeny, setNewDeny] = useState('')

  function update<K extends keyof ToolConfig>(key: K, val: ToolConfig[K]) {
    onChange({ ...value, [key]: val })
  }

  function addAllow() {
    if (newAllow.trim()) {
      update('allow', [...(value.allow ?? []), newAllow.trim()])
      setNewAllow('')
    }
  }

  function removeAllow(index: number) {
    update('allow', value.allow?.filter((_, i) => i !== index) ?? [])
  }

  function addDeny() {
    if (newDeny.trim()) {
      update('deny', [...(value.deny ?? []), newDeny.trim()])
      setNewDeny('')
    }
  }

  function removeDeny(index: number) {
    update('deny', value.deny?.filter((_, i) => i !== index) ?? [])
  }

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <Label>工具权限级别</Label>
        <Select
          value={value.profile ?? 'coding'}
          onValueChange={v => update('profile', v as ToolConfig['profile'])}
        >
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {TOOL_PROFILE_OPTIONS.map(opt => (
              <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-gray-500">Profile 作为基础权限，allow/deny 可叠加调整</p>
      </div>

      <div className="space-y-1">
        <Label>额外允许的工具</Label>
        <div className="flex gap-2">
          <Input
            value={newAllow}
            onChange={e => setNewAllow(e.target.value)}
            placeholder="工具名或组名"
            list="tool-hints"
          />
          <Button size="sm" variant="outline" onClick={addAllow}>
            <Plus className="w-3 h-3" />
          </Button>
        </div>
        <datalist id="tool-hints">
          {TOOL_HINTS.map(h => <option key={h} value={h} />)}
        </datalist>
        {value.allow && value.allow.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {value.allow.map((tool, i) => (
              <span
                key={i}
                className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-100 text-green-700 rounded text-xs"
              >
                {tool}
                <X
                  className="w-3 h-3 cursor-pointer hover:text-red-500"
                  onClick={() => removeAllow(i)}
                />
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="space-y-1">
        <Label>禁止的工具</Label>
        <p className="text-xs text-gray-500">deny 优先级高于 allow，可禁用特定工具</p>
        <div className="flex gap-2">
          <Input
            value={newDeny}
            onChange={e => setNewDeny(e.target.value)}
            placeholder="工具名或组名"
            list="tool-hints"
          />
          <Button size="sm" variant="outline" onClick={addDeny}>
            <Plus className="w-3 h-3" />
          </Button>
        </div>
        {value.deny && value.deny.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {value.deny.map((tool, i) => (
              <span
                key={i}
                className="inline-flex items-center gap-1 px-2 py-0.5 bg-red-100 text-red-700 rounded text-xs"
              >
                {tool}
                <X
                  className="w-3 h-3 cursor-pointer"
                  onClick={() => removeDeny(i)}
                />
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}