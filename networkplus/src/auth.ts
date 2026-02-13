import NextAuth from "next-auth"
import { PrismaAdapter } from "@auth/prisma-adapter"
import prisma from "@lib/prisma"

import authConfig from "./auth.config"

export const { handlers, auth: nextAuthAuth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma as any),
  session: { strategy: "jwt" },
  pages: {
    signIn: "/signin",
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id
      }
      return token
    },
    async session({ session, token }) {
      if (session.user && token?.id) {
        session.user.id = token.id as string
      }
      return session
    },
  },

  ...authConfig,
})

export const auth = async (...args: any[]) => {
  // Check if we are in a middleware context (usually passed a NextRequest)
  const isRequest = args[0] instanceof Request || (args[0] && typeof args[0].method === 'string');

  if (process.env.NODE_ENV === "development") {
    // NOTE: This forces a session in development, meaning "Sign Out" won't appear to work 
    // (you'll be immediately re-logged in as Dev User).
    // To test real auth flows locally, comment out this block.
    if (isRequest) {
      // Middleware usage in dev: just continue without interfering
      // Or pass through to nextAuthAuth but realize it might fail if no token?
      // If we want to simulate logged-in status in middleware, we might need to fake a response?
      // Returning undefined/void usually signals "continue" in middleware chains.
      return nextAuthAuth(...(args as Parameters<typeof nextAuthAuth>));
      // Actually, if we call nextAuthAuth without a token, it might redirect to login.
      // But since we want to BYPASS auth in dev, maybe we shouldn't call it?
      // However, usually auth middleware is used to PROTECT routes.
      // If we want to mock that we are logged in, we should effectively "do nothing" and let the request proceeds.
      // But `export { auth as middleware }` expects a response.
      // Let's rely on the fact that if we don't return a response, it might be an issue.
      // Let's try calling original auth. If it fails (redirects), we might need another strategy.
      // UPDATE: The user wants to avoid logging in.
      // If we just return, what happens? 
      // NextAuth's auth() returns a Session | null when called server side, or a Response when called as middleware?
    }

    return {
      user: {
        id: "dev-user",
        name: "Dev User",
        email: "dev@example.com",
        image: "https://github.com/shadcn.png",
      },
      expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    }
  }
  return nextAuthAuth(...(args as Parameters<typeof nextAuthAuth>))
}

export const getAuthSession = auth;