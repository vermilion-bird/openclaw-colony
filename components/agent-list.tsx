'use client'
import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { AgentEditForm } from '@/components/agent-edit-form'
import { AgentBindingsForm } from '@/components/agent-bindings-form'
import { Plus, Pencil, Trash2, Star, Link } from 'lucide-react'

interface AgentConfig {
  id: string
  default?: boolean
  identity?: { name?: string; theme?: string; emoji?: string; avatar?: string }
  model?: string | { primary: string; fallbacks?: string[] }
  tools?: { profile?: 'minimal' | 'coding' | 'messaging' | 'full'; allow?: string[]; deny?: string[] }
}

interface BindingConfig {
  agentId: string
  match: { channel?: string; peer?: string; guildId?: string; accountId?: string; teamId?: string }
}

interface Props {
  instanceId: string
  agents: AgentConfig[]
  bindings: BindingConfig[]
  onSaved: () => void
}

export function AgentList({ instanceId, agents, bindings, onSaved }: Props) {
  const [editAgent, setEditAgent] = useState<AgentConfig | null>(null)
  const [showAdd, setShowAdd] = useState(false)
  const [showBindings, setShowBindings] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [localBindings, setLocalBindings] = useState<BindingConfig[]>(bindings)

  useEffect(() => {
    setLocalBindings(bindings)
  }, [bindings])

  async function saveAgents(newAgents: AgentConfig[]) {
    setSaving(true)
    setError('')

    const res = await fetch(`/api/instances/${instanceId}/openclaw-config`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ agents: { list: newAgents } }),
    })

    if (res.ok) {
      onSaved()
      setEditAgent(null)
      setShowAdd(false)
    } else {
      const data = await res.json()
      setError(typeof data.error === 'string' ? data.error : '保存失败')
    }
    setSaving(false)
  }

  async function saveBindings() {
    setSaving(true)
    setError('')

    const res = await fetch(`/api/instances/${instanceId}/openclaw-config`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bindings: localBindings }),
    })

    if (res.ok) {
      onSaved()
      setShowBindings(false)
    } else {
      const data = await res.json()
      setError(typeof data.error === 'string' ? data.error : '保存失败')
    }
    setSaving(false)
  }

  function handleAddAgent(agent: AgentConfig) {
    saveAgents([...agents, agent])
  }

  function handleEditAgent(agent: AgentConfig) {
    saveAgents(agents.map(a => a.id === agent.id ? agent : a))
  }

  function handleDeleteAgent(id: string) {
    saveAgents(agents.filter(a => a.id !== id))
  }

  function handleSetDefault(id: string) {
    saveAgents(agents.map(a => ({ ...a, default: a.id === id })))
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center justify-between">
            Agent 列表
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => setShowBindings(true)}>
                <Link className="w-3 h-3 mr-1" />绑定
              </Button>
              <Button size="sm" onClick={() => setShowAdd(true)}>
                <Plus className="w-3 h-3 mr-1" />新建
              </Button>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {agents.length === 0 ? (
            <p className="text-center py-4 text-gray-400">暂无 Agent，点击新建添加</p>
          ) : (
            <div className="space-y-2">
              {agents.map(agent => (
                <div
                  key={agent.id}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded"
                >
                  <div className="flex items-center gap-2">
                    {agent.identity?.emoji && <span className="text-lg">{agent.identity.emoji}</span>}
                    <div>
                      <div className="font-medium">
                        {agent.identity?.name ?? agent.id}
                        {agent.default && <Star className="w-3 h-3 text-yellow-500 ml-1 inline" />}
                      </div>
                      <div className="text-xs text-gray-500">
                        {typeof agent.model === 'string' ? agent.model : agent.model?.primary}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    {!agent.default && (
                      <Button size="sm" variant="ghost" onClick={() => handleSetDefault(agent.id)}>
                        <Star className="w-3 h-3" />
                      </Button>
                    )}
                    <Button size="sm" variant="ghost" onClick={() => setEditAgent(agent)}>
                      <Pencil className="w-3 h-3" />
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => handleDeleteAgent(agent.id)}>
                      <Trash2 className="w-3 h-3 text-red-500" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {error && <p className="text-sm text-red-500">{error}</p>}
      <p className="text-xs text-gray-500">配置将自动热更新，无需重启实例</p>

      {/* Add Agent Dialog */}
      {showAdd && (
        <Dialog open onOpenChange={() => setShowAdd(false)}>
          <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto">
            <DialogHeader><DialogTitle>新建 Agent</DialogTitle></DialogHeader>
            <AgentEditForm
              instanceId={instanceId}
              initialAgent={null}
              existingIds={agents.map(a => a.id)}
              onSave={handleAddAgent}
              onCancel={() => setShowAdd(false)}
            />
          </DialogContent>
        </Dialog>
      )}

      {/* Edit Agent Dialog */}
      {editAgent && (
        <Dialog open onOpenChange={() => setEditAgent(null)}>
          <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto">
            <DialogHeader><DialogTitle>编辑 Agent</DialogTitle></DialogHeader>
            <AgentEditForm
              instanceId={instanceId}
              initialAgent={editAgent}
              existingIds={agents.map(a => a.id)}
              onSave={handleEditAgent}
              onCancel={() => setEditAgent(null)}
            />
          </DialogContent>
        </Dialog>
      )}

      {/* Bindings Dialog */}
      {showBindings && (
        <Dialog open onOpenChange={() => setShowBindings(false)}>
          <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto">
            <DialogHeader><DialogTitle>渠道绑定</DialogTitle></DialogHeader>
            <AgentBindingsForm
              value={localBindings}
              onChange={setLocalBindings}
              agentOptions={agents.map(a => ({ id: a.id, name: a.identity?.name }))}
            />
            {error && <p className="text-sm text-red-500">{error}</p>}
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setShowBindings(false)} className="flex-1">
                取消
              </Button>
              <Button onClick={saveBindings} disabled={saving} className="flex-1">
                {saving ? '保存中...' : '保存绑定'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}