import { NextResponse } from "next/server";
import { type Session } from "next-auth";
import { auth } from "@/auth";
import prisma from "@/lib/prisma";
import { RawMessage, buildSessions } from "@/lib/session-builder";

// Helper to refresh Microsoft token if expired
async function getValidAccessToken(account: any) {
    if (!account.access_token) return null;

    const expiresAt = account.expires_at ? account.expires_at * 1000 : 0;

    if (Date.now() < expiresAt) {
        return account.access_token;
    }

    if (!account.refresh_token) {
        return null; // Need user to re-authenticate
    }

    // Refresh token
    const tenantId = process.env.AUTH_MICROSOFT_ENTRA_ID_TENANT_ID || "common";
    const response = await fetch(`https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
            client_id: process.env.AUTH_MICROSOFT_ENTRA_ID_ID!,
            client_secret: process.env.AUTH_MICROSOFT_ENTRA_ID_SECRET!,
            grant_type: "refresh_token",
            refresh_token: account.refresh_token,
        }),
    });

    const tokens = await response.json();

    if (!response.ok) {
        console.error("Failed to refresh Microsoft token", tokens);
        return null;
    }

    const newExpiresAt = Math.floor(Date.now() / 1000) + tokens.expires_in;

    await prisma.account.update({
        where: { id: account.id },
        data: {
            access_token: tokens.access_token,
            expires_at: newExpiresAt,
            refresh_token: tokens.refresh_token ?? account.refresh_token,
        },
    });

    return tokens.access_token;
}

// ... [existing imports]

export async function POST(req: Request) {
    try {
        const session = await auth() as Session | null;
        if (!session?.user?.id) {
            console.error("Sync Debug [Outlook]: No Session User ID found. Session object:", JSON.stringify(session));
            return new NextResponse("Unauthorized", { status: 401 });
        }

        const userId = session.user.id;

        // Get Microsoft Account
        const account = await prisma.account.findFirst({
            where: { userId, provider: "microsoft-entra-id" },
        });

        if (!account) {
            console.error(`Sync Debug [Outlook]: No Microsoft account linked for user ID: ${userId}`);
            return new NextResponse("No Microsoft account linked", { status: 400 });
        }

        const accessToken = await getValidAccessToken(account);
        if (!accessToken) {
            console.error(`Sync Debug [Outlook]: Microsoft token refresh failed for account ID: ${account.id}. Missing refresh_token?`);
            return new NextResponse("Microsoft authentication expired. Please sign in again.", { status: 401 });
        }

        const userEmail = session.user.email;

        const contacts = await prisma.contact.findMany({
            where: { ownerId: userId, email: { not: null } },
            select: { id: true, email: true },
        });

        const contactEmailMap = new Map<string, string>();
        for (const contact of contacts) {
            if (contact.email) contactEmailMap.set(contact.email.toLowerCase(), contact.id);
        }

        if (contactEmailMap.size === 0) {
            return NextResponse.json({ message: "No contacts with email addresses found.", importedSessions: 0 });
        }

        const maxResults = 100;
        // MS Graph API for fetching messages
        const res = await fetch(`https://graph.microsoft.com/v1.0/me/messages?$top=${maxResults}&$select=id,conversationId,sentDateTime,from,toRecipients,bodyPreview`, {
            headers: { Authorization: `Bearer ${accessToken}` },
        });

        if (!res.ok) {
            const err = await res.text();
            console.error(err);
            return new NextResponse("Failed to fetch messages from Outlook", { status: 500 });
        }

        const listData = await res.json();
        const messagesToFetch = listData.value || [];

        const rawMessages: RawMessage[] = [];

        for (const msgData of messagesToFetch) {
            const fromEmail = msgData.from?.emailAddress?.address?.toLowerCase();
            const toRecipients = msgData.toRecipients || [];
            const toEmails = toRecipients.map((r: any) => r.emailAddress?.address?.toLowerCase()).filter(Boolean);

            if (!fromEmail) continue;

            const date = new Date(msgData.sentDateTime);
            const conversationId = msgData.conversationId;

            const relatedEmails = new Set<string>();
            let direction: "INBOUND" | "OUTBOUND" = "INBOUND";

            if (fromEmail === userEmail?.toLowerCase()) {
                direction = "OUTBOUND";
                toEmails.forEach((e: string) => relatedEmails.add(e));
            } else {
                direction = "INBOUND";
                relatedEmails.add(fromEmail);
            }

            for (const email of relatedEmails) {
                const contactId = contactEmailMap.get(email);
                if (contactId) {
                    rawMessages.push({
                        id: msgData.id,
                        threadId: conversationId,
                        platform: "EMAIL",
                        date,
                        contactId,
                        direction,
                        content: msgData.bodyPreview || undefined,
                    });
                }
            }
        }

        const sessions = buildSessions(rawMessages);

        let importedSessions = 0;
        for (const sessionData of sessions) {
            const { contactId, ...rest } = sessionData;

            const existing = await prisma.interaction.findFirst({
                where: {
                    threadId: rest.threadId,
                    contacts: { some: { id: contactId } },
                    platform: "EMAIL"
                }
            });

            if (existing) {
                await prisma.interaction.update({
                    where: { id: existing.id },
                    data: {
                        startTime: rest.startTime,
                        endTime: rest.endTime,
                        durationSeconds: rest.durationSeconds,
                        messageCount: rest.messageCount,
                        directionSummary: rest.directionSummary,
                        rawMessageCount: rest.rawMessageCount,
                        date: rest.endTime,
                        metadata: rest.metadata || {},
                    }
                });
            } else {
                await prisma.interaction.create({
                    data: {
                        type: "Email Thread",
                        platform: "EMAIL",
                        date: rest.endTime,
                        startTime: rest.startTime,
                        endTime: rest.endTime,
                        durationSeconds: rest.durationSeconds,
                        messageCount: rest.messageCount,
                        directionSummary: rest.directionSummary,
                        rawMessageCount: rest.rawMessageCount,
                        threadId: rest.threadId,
                        metadata: rest.metadata || {},
                        contacts: {
                            connect: { id: contactId }
                        }
                    }
                });
                importedSessions++;
            }
        }

        return NextResponse.json({ message: "Outlook sync complete", importedSessions });

    } catch (error) {
        console.error("Outlook sync error:", error);
        return new NextResponse("Internal server error", { status: 500 });
    }
}
