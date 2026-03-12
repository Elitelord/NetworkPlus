import Google from "next-auth/providers/google"
import type { NextAuthConfig } from "next-auth"

export default {
    providers: [
        Google({
            clientId: process.env.AUTH_GOOGLE_ID,
            clientSecret: process.env.AUTH_GOOGLE_SECRET,
            allowDangerousEmailAccountLinking: true,
            authorization: {
                params: {
                    scope: "openid profile email https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/gmail.send https://www.googleapis.com/auth/calendar.readonly https://www.googleapis.com/auth/calendar.events",
                    access_type: "offline",
                    prompt: "consent",
                },
            },
        }),
    ],
    pages: {
        signIn: "/signin",
    },
    callbacks: {
        authorized({ auth, request: { nextUrl } }) {
            const isLoggedIn = !!auth?.user;
            const isApiAuthRoute = nextUrl.pathname.startsWith("/api/auth");
            const isPublicRoute = ["/", "/signin", "/signup", "/terms", "/privacy"].includes(nextUrl.pathname);

            if (isApiAuthRoute) {
                return true;
            }

            if (isPublicRoute) {
                if (isLoggedIn && (nextUrl.pathname === "/signin" || nextUrl.pathname === "/signup")) {
                    return Response.redirect(new URL("/dashboard", nextUrl));
                }
                return true;
            }

            return isLoggedIn;
        },
    },
} satisfies NextAuthConfig
