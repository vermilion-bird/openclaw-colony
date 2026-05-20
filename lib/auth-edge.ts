import NextAuth from 'next-auth'

// Lightweight auth config for proxy (Edge Runtime) — no DB imports, no fs.
// Only verifies the JWT token stored in the session cookie.
export const { auth } = NextAuth({
  providers: [],
  callbacks: {
    session({ session, token }) {
      session.user.id = token.id as string
      ;(session.user as any).role = token.role as string
      return session
    },
  },
  pages: { signIn: '/login' },
  session: { strategy: 'jwt' },
})
