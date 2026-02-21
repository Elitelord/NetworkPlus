import Google from "next-auth/providers/google"
import MicrosoftEntraID from "next-auth/providers/microsoft-entra-id"
import type { NextAuthConfig } from "next-auth"

export default {
    providers: [
        Google({
            clientId: process.env.AUTH_GOOGLE_ID,
            clientSecret: process.env.AUTH_GOOGLE_SECRET,
            allowDangerousEmailAccountLinking: true,
            authorization: {
                params: {
                    scope: "openid profile email https://www.googleapis.com/auth/gmail.readonly",
                    access_type: "offline",
                    prompt: "consent",
                },
            },
        }),
        MicrosoftEntraID({
            clientId: process.env.AUTH_MICROSOFT_ENTRA_ID_ID,
            clientSecret: process.env.AUTH_MICROSOFT_ENTRA_ID_SECRET,
            issuer: process.env.AUTH_MICROSOFT_ENTRA_ID_TENANT_ID ? `https://login.microsoftonline.com/${process.env.AUTH_MICROSOFT_ENTRA_ID_TENANT_ID}/v2.0` : undefined,
            allowDangerousEmailAccountLinking: true,
            authorization: {
                params: {
                    scope: "openid profile email offline_access Mail.Read",
                },
            },
        }),
    ],
} satisfies NextAuthConfig
