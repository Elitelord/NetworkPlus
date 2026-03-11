import NextAuth from "next-auth"
import authConfig from "./auth.config"
import { NextResponse } from "next/server"

const { auth } = NextAuth(authConfig)

export default auth((req) => {
  const publicRoutes = ["/", "/terms", "/privacy"]

  const { pathname } = req.nextUrl

  if (publicRoutes.includes(pathname)) {
    return NextResponse.next()
  }
})

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
}
