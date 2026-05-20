'use client'
import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Trash2 } from 'lucide-react'

interface User { id: string; email: string; role: string; createdAt: string }

export default function UsersPage() {
  const { data: session } = useSession()
  const router = useRouter()
  const [users, setUsers] = useState<User[]>([])
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState<'admin' | 'operator'>('operator')
  const [error, setError] = useState('')

  useEffect(() => {
    if (session && (session.user as any)?.role !== 'admin') router.replace('/')
    if (session) fetchUsers()
  }, [session])

  async function fetchUsers() {
    const res = await fetch('/api/users')
    if (res.ok) setUsers(await res.json())
  }

  async function createUser(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    const res = await fetch('/api/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, role }),
    })
    if (res.ok) {
      setEmail('')
      setPassword('')
      fetchUsers()
    } else {
      const data = await res.json()
      setError(typeof data.error === 'string' ? data.error : '创建失败')
    }
  }

  async function deleteUser(id: string) {
    if (!confirm('确认删除该用户？')) return
    const res = await fetch(`/api/users/${id}`, { method: 'DELETE' })
    if (res.ok) {
      fetchUsers()
    } else {
      const data = await res.json()
      alert(typeof data.error === 'string' ? data.error : '删除失败')
    }
  }

  async function changeRole(id: string, newRole: string) {
    await fetch(`/api/users/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: newRole }),
    })
    fetchUsers()
  }

  return (
    <div className="max-w-2xl space-y-6">
      <h2 className="text-xl font-semibold">用户管理</h2>
      <Card>
        <CardHeader><CardTitle className="text-base">当前用户</CardTitle></CardHeader>
        <CardContent>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 border-b">
                <th className="pb-2">邮箱</th>
                <th>角色</th>
                <th>创建时间</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id} className="border-b last:border-0">
                  <td className="py-2">{u.email}</td>
                  <td>
                    <Select value={u.role} onValueChange={v => changeRole(u.id, v ?? '')}>
                      <SelectTrigger className="h-7 text-xs w-24"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="admin">admin</SelectItem>
                        <SelectItem value="operator">operator</SelectItem>
                      </SelectContent>
                    </Select>
                  </td>
                  <td className="text-gray-400 text-xs">
                    {new Date(u.createdAt).toLocaleDateString()}
                  </td>
                  <td>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 text-red-500"
                      onClick={() => deleteUser(u.id)}
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle className="text-base">创建用户</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={createUser} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>邮箱</Label>
                <Input type="email" value={email} onChange={e => setEmail(e.target.value)} required />
              </div>
              <div className="space-y-1">
                <Label>密码</Label>
                <Input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  minLength={8}
                  required
                />
              </div>
            </div>
            <div className="space-y-1 w-32">
              <Label>角色</Label>
              <Select value={role} onValueChange={v => setRole(v as 'admin' | 'operator')}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="operator">operator</SelectItem>
                  <SelectItem value="admin">admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {error && <p className="text-sm text-red-500">{error}</p>}
            <Button type="submit" size="sm">创建用户</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
