import { NextResponse } from "next/server";
import { type Session } from "next-auth";
import { auth } from "@/auth";
import prisma from "@/lib/prisma";
import { inferPlatformFromEvent } from "@/lib/calendar-utils";

// Refresh Microsoft token if expired
async function getValidAccessToken(account: any) {
    if (!account.access_token) return null;

    const expiresAt = account.expires_at ? account.expires_at * 1000 : 0;

    if (Date.now() < expiresAt) {
        return account.access_token;
    }

    if (!account.refresh_token) return null;

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

export async function POST(req: Request) {
    try {
        const session = await auth() as Session | null;
        if (!session?.user?.id) {
            return new NextResponse("Unauthorized", { status: 401 });
        }

        const userId = session.user.id;

        // Get Microsoft Account
        const account = await prisma.account.findFirst({
            where: { userId, provider: "microsoft-entra-id" },
        });

        if (!account) {
            return NextResponse.json(
                { error: "No Microsoft account linked. Sign in with Microsoft first." },
                { status: 400 }
            );
        }

        const accessToken = await getValidAccessToken(account);
        if (!accessToken) {
            return NextResponse.json(
                { error: "Microsoft authentication expired. Please sign out and sign back in." },
                { status: 401 }
            );
        }

        // Fetch contacts for matching
        const contacts = await prisma.contact.findMany({
            where: { ownerId: userId, email: { not: null } },
            select: { id: true, email: true, name: true },
        });

        const contactEmailMap = new Map<string, string>();
        const contactNameMap = new Map<string, string>();
        for (const contact of contacts) {
            if (contact.email) {
                contactEmailMap.set(contact.email.toLowerCase(), contact.id);
            }
            if (contact.name) {
                contactNameMap.set(contact.name.toLowerCase(), contact.id);
            }
        }

        if (contactEmailMap.size === 0 && contactNameMap.size === 0) {
            return NextResponse.json({ message: "No contacts found to match.", synced: 0 });
        }

        // Fetch calendar events via Microsoft Graph: last 30 days + next 30 days
        const now = new Date();
        const startDateTime = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
        const endDateTime = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString();

        const calRes = await fetch(
            `https://graph.microsoft.com/v1.0/me/calendarView?` +
            `startDateTime=${encodeURIComponent(startDateTime)}&endDateTime=${encodeURIComponent(endDateTime)}` +
            `&$top=250&$select=id,subject,bodyPreview,start,end,location,attendees,webLink&$orderby=start/dateTime`,
            { headers: { Authorization: `Bearer ${accessToken}` } }
        );

        if (!calRes.ok) {
            const err = await calRes.text();
            console.error("Microsoft Calendar API error:", calRes.status, err);

            if (calRes.status === 403 || calRes.status === 401) {
                return NextResponse.json(
                    { error: "Calendar permissions not granted. Please sign out and sign back in to grant Calendar access." },
                    { status: 403 }
                );
            }
            return NextResponse.json(
                { error: `Microsoft Calendar API error: ${calRes.status}` },
                { status: 500 }
            );
        }

        const calData = await calRes.json();
        const events = calData.value || [];

        let synced = 0;
        const affectedContactIds = new Set<string>();

        for (const event of events) {
            const eventId = event.id;
            const subject = event.subject || "";
            const bodyPreview = event.bodyPreview || "";
            const locationName = event.location?.displayName || "";

            // Get event start/end time
            const startStr = event.start?.dateTime;
            const endStr = event.end?.dateTime;
            if (!startStr) continue;

            // Microsoft Graph returns times in UTC without Z suffix, add it
            const startTime = new Date(startStr.endsWith("Z") ? startStr : startStr + "Z");
            const endTime = endStr ? new Date(endStr.endsWith("Z") ? endStr : endStr + "Z") : startTime;
            const durationSeconds = Math.floor((endTime.getTime() - startTime.getTime()) / 1000);

            // Match attendees by email
            const matchedContactIds = new Set<string>();
            const attendees = event.attendees || [];

            for (const attendee of attendees) {
                const email = attendee.emailAddress?.address?.toLowerCase();
                if (email && contactEmailMap.has(email)) {
                    matchedContactIds.add(contactEmailMap.get(email)!);
                }
            }

            // Also try matching name from subject
            if (matchedContactIds.size === 0) {
                for (const [name, contactId] of contactNameMap) {
                    if (subject.toLowerCase().includes(name) || bodyPreview.toLowerCase().includes(name)) {
                        matchedContactIds.add(contactId);
                    }
                }
            }

            if (matchedContactIds.size === 0) continue;

            // Infer platform from event text
            const platform = inferPlatformFromEvent(subject, bodyPreview, locationName);

            // Upsert interaction for each matched contact
            for (const contactId of matchedContactIds) {
                affectedContactIds.add(contactId);

                const existing = await prisma.interaction.findFirst({
                    where: {
                        calendarEventId: eventId,
                        contacts: { some: { id: contactId } },
                    },
                });

                if (existing) {
                    await prisma.interaction.update({
                        where: { id: existing.id },
                        data: {
                            type: "Calendar Event",
                            platform,
                            date: startTime,
                            startTime,
                            endTime,
                            durationSeconds: durationSeconds > 0 ? durationSeconds : undefined,
                            content: subject || undefined,
                            metadata: { location: locationName, description: bodyPreview.slice(0, 500) },
                        },
                    });
                } else {
                    await prisma.interaction.create({
                        data: {
                            type: "Calendar Event",
                            platform,
                            date: startTime,
                            startTime,
                            endTime,
                            durationSeconds: durationSeconds > 0 ? durationSeconds : undefined,
                            content: subject || undefined,
                            calendarEventId: eventId,
                            metadata: { location: locationName, description: bodyPreview.slice(0, 500) },
                            contacts: {
                                connect: { id: contactId },
                            },
                        },
                    });
                    synced++;
                }
            }
        }

        // Recalculate scores for affected contacts
        const { recalculateContactScore } = await import("@/lib/strength-scoring");
        for (const cId of affectedContactIds) {
            const latestInteraction = await prisma.interaction.findFirst({
                where: { contacts: { some: { id: cId } } },
                orderBy: { date: "desc" },
                select: { date: true, platform: true },
            });

            if (latestInteraction) {
                await prisma.contact.update({
                    where: { id: cId },
                    data: {
                        lastInteractionAt: latestInteraction.date,
                        lastPlatform: latestInteraction.platform,
                    },
                });
            }

            await recalculateContactScore(cId);
        }

        return NextResponse.json({
            message: "Outlook Calendar sync complete",
            synced,
            eventsProcessed: events.length,
            contactsAffected: affectedContactIds.size,
        });

    } catch (error) {
        console.error("Outlook Calendar sync error:", error);
        return new NextResponse("Internal server error", { status: 500 });
    }
}
