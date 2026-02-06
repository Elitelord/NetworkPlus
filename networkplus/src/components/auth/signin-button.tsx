"use client"
import { signIn } from "next-auth/react"

export function SignIn() {
    return (
        <button
            type="button"
            onClick={() => signIn("google", { redirectTo: "/dashboard" })}
            className="underline text-sm text-muted-foreground hover:text-primary"
        >
            Sign In with Google
        </button>
    )
}
