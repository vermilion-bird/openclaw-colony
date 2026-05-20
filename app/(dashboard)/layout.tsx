import { auth, signOut } from '@/lib/auth'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()
  if (!session?.user) redirect('/login')

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <h1 className="font-semibold text-lg">OpenClaw Colony</h1>
          <nav className="flex gap-4 text-sm">
            <Link href="/instances" className="text-gray-600 hover:text-gray-900">实例</Link>
            {(session.user as any).role === 'admin' && (
              <>
                <Link href="/settings/users" className="text-gray-600 hover:text-gray-900">用户</Link>
                <Link href="/activity-logs" className="text-gray-600 hover:text-gray-900">操作记录</Link>
              </>
            )}
          </nav>
        </div>
        <div className="flex items-center gap-3 text-sm text-gray-500">
          <span>{session.user.email}</span>
          <form action={async () => { 'use server'; await signOut({ redirectTo: '/login' }) }}>
            <Button type="submit" variant="ghost" size="sm">退出</Button>
          </form>
        </div>
      </header>
      <main className="p-6">{children}</main>
    </div>
  )
}
