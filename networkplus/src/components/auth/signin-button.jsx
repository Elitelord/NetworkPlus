"use client"
import { signIn } from "next-auth/react"
 
export function SignIn() {
  return (
    <button onClick={() => signIn("google", { redirectTo: "/dashboard" })}>
      Sign In with Google
    </button>
  )
}