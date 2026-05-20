import { auth } from '@/lib/auth-edge'
import { NextResponse } from 'next/server'

export default auth((req) => {
  if (!req.auth) {
    const url = req.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }
  return NextResponse.next()
})

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api/auth|api/setup|login|setup).*)'],
}
