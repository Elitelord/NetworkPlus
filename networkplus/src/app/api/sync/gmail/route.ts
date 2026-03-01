import { NextResponse } from "next/server";
import { type Session } from "next-auth";
import { auth } from "@/auth";
import prisma from "@/lib/prisma";
import { RawMessage, buildSessions } from "@/lib/session-builder";

// Helper to refresh Google Token if expired
async function getValidAccessToken(account: any) {
    if (!account.access_token) return null;

    const expiresAt = account.expires_at ? account.expires_at * 1000 : 0;

    if (Date.now() < expiresAt) {
        return account.access_token;
    }

    if (!account.refresh_token) {
        return null;
    }

    // Refresh token
    const response = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
            client_id: process.env.AUTH_GOOGLE_ID!,
            client_secret: process.env.AUTH_GOOGLE_SECRET!,
            grant_type: "refresh_token",
            refresh_token: account.refresh_token,
        }),
    });

    const tokens = await response.json();

    if (!response.ok) {
        console.error("Failed to refresh Google token", tokens);
        return null; // Could not refresh
    }

    const newExpiresAt = Math.floor(Date.now() / 1000) + tokens.expires_in;

    await prisma.account.update({
        where: { id: account.id },
        data: {
            access_token: tokens.access_token,
            expires_at: newExpiresAt,
            refresh_token: tokens.refresh_token ?? account.refresh_token, // keep old if not returned
        },
    });

    return tokens.access_token;
}

// ... [existing imports]

export async function POST(req: Request) {
    try {
        const session = await auth() as Session | null;
        if (!session?.user?.id) {
            console.error("Sync Debug [Gmail]: No Session User ID found. Session object:", JSON.stringify(session));
            return new NextResponse("Unauthorized", { status: 401 });
        }

        const userId = session.user.id;

        // Get Google Account
        const account = await prisma.account.findFirst({
            where: { userId, provider: "google" },
        });

        if (!account) {
            console.error(`Sync Debug [Gmail]: No Google account linked for user ID: ${userId}`);
            return new NextResponse("No Google account linked", { status: 400 });
        }

        const accessToken = await getValidAccessToken(account);
        if (!accessToken) {
            console.error(`Sync Debug [Gmail]: Google token refresh failed for account ID: ${account.id}. Missing refresh_token?`);
            return new NextResponse("Google authentication expired. Please sign in again.", { status: 401 });
        }

        // Get user's email address to determine INBOUND/OUTBOUND direction
        const userEmail = session.user.email;

        // Fetch contacts for mapping (where email is not null)
        const contacts = await prisma.contact.findMany({
            where: { ownerId: userId, email: { not: null } },
            select: { id: true, email: true },
        });

        // Create email to ID lookup map
        const contactEmailMap = new Map<string, string>();
        for (const contact of contacts) {
            if (contact.email) {
                contactEmailMap.set(contact.email.toLowerCase(), contact.id);
            }
        }

        if (contactEmailMap.size === 0) {
            return NextResponse.json({ message: "No contacts with email addresses found.", importedSessions: 0 });
        }

        // --- Fetch Gmail list ---
        // For sync, we might only fetch the last N messages or based on a lastSyncedAt date.
        // For simplicity right now, we fetch maxResults=100 from INBOX and SENT.
        const maxResults = 100;
        const listRes = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=${maxResults}`, {
            headers: { Authorization: `Bearer ${accessToken}` },
        });

        if (!listRes.ok) {
            return new NextResponse("Failed to fetch messages from Gmail", { status: 500 });
        }

        const listData = await listRes.json();
        const messagesToFetch = listData.messages || [];

        const rawMessages: RawMessage[] = [];

        // --- Fetch full message details ---
        for (const msgObj of messagesToFetch) {
            const msgRes = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${msgObj.id}?format=metadata&metadataHeaders=From&metadataHeaders=To&metadataHeaders=Date`, {
                headers: { Authorization: `Bearer ${accessToken}` },
            });

            if (!msgRes.ok) continue;

            const msgData = await msgRes.json();
            const headers = msgData.payload?.headers || [];

            let fromHeader = "";
            let toHeader = "";

            for (const h of headers) {
                if (h.name.toLowerCase() === "from") fromHeader = h.value;
                if (h.name.toLowerCase() === "to") toHeader = h.value;
            }

            // Extract mere email strings from e.g. "John Doe <john@doe.com>"
            const extractEmail = (str: string) => {
                const match = str.match(/<([^>]+)>/);
                return (match ? match[1] : str).trim().toLowerCase();
            };

            const fromEmail = extractEmail(fromHeader);
            const toEmails = toHeader.split(",").map(extractEmail);

            const internalDate = parseInt(msgData.internalDate, 10);
            if (isNaN(internalDate)) continue;

            const date = new Date(internalDate);
            const threadId = msgData.threadId;

            // Determine direction and contact matching
            // We check only ONE primary contact involved to keep it simple, OR create multiple Interactions per contact involved.
            // Let's create an Interaction entry for EVERY mapped contact in this email.
            const relatedEmails = new Set<string>();
            let direction: "INBOUND" | "OUTBOUND" = "INBOUND"; // Default

            if (fromEmail === userEmail?.toLowerCase()) {
                direction = "OUTBOUND";
                toEmails.forEach(e => relatedEmails.add(e));
            } else {
                direction = "INBOUND";
                relatedEmails.add(fromEmail);
                // CC/To emails could also yield other mutual contacts, but generally From is the contact.
            }

            for (const email of relatedEmails) {
                const contactId = contactEmailMap.get(email);
                if (contactId) {
                    rawMessages.push({
                        id: msgData.id,
                        threadId,
                        platform: "EMAIL",
                        date,
                        contactId,
                        direction,
                        content: msgData.snippet || undefined,
                    });
                }
            }
        }

        // --- Process through Session Builder Engine ---
        const sessions = buildSessions(rawMessages);

        // --- Save sessions to Database ---
        let importedSessions = 0;
        for (const sessionData of sessions) {
            const { contactId, ...rest } = sessionData;

            // Upsert / Create Interaction. To prevent duplicates, we can check by threadId + contactId if it already exists,
            // or we could use the start time / threadId.
            // Since multiple syncs could recreate this, we should find by threadId and contactId.

            const existing = await prisma.interaction.findFirst({
                where: {
                    threadId: rest.threadId,
                    contacts: { some: { id: contactId } },
                    platform: "EMAIL"
                }
            });

            if (existing) {
                // Update
                await prisma.interaction.update({
                    where: { id: existing.id },
                    data: {
                        startTime: rest.startTime,
                        endTime: rest.endTime,
                        durationSeconds: rest.durationSeconds,
                        messageCount: rest.messageCount,
                        directionSummary: rest.directionSummary,
                        rawMessageCount: rest.rawMessageCount,
                        date: rest.endTime, // Use endTime as primary display date
                        metadata: rest.metadata || {},
                    }
                });
            } else {
                // Create
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

        return NextResponse.json({ message: "Gmail sync complete", importedSessions });

    } catch (error) {
        console.error("Gmail sync error:", error);
        return new NextResponse("Internal server error", { status: 500 });
    }
}
