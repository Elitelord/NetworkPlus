import { NextResponse } from "next/server";
import { type Session } from "next-auth";
import { auth } from "@/auth";
import prisma from "@/lib/prisma";
import { inferPlatformFromEvent, getValidGoogleAccessToken } from "@/lib/calendar-utils";

export async function POST(req: Request) {
    try {
        const session = await auth() as Session | null;
        if (!session?.user?.id) {
            return new NextResponse("Unauthorized", { status: 401 });
        }

        const userId = session.user.id;

        // Get Google Account
        const account = await prisma.account.findFirst({
            where: { userId, provider: "google" },
        });

        if (!account) {
            return new NextResponse("No Google account linked", { status: 400 });
        }

        const accessToken = await getValidGoogleAccessToken(account, prisma);
        if (!accessToken) {
            return new NextResponse("Google authentication expired. Please sign in again.", { status: 401 });
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

        // Fetch calendar events: last 30 days + next 30 days
        const now = new Date();
        const timeMin = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
        const timeMax = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString();

        const calRes = await fetch(
            `https://www.googleapis.com/calendar/v3/calendars/primary/events?` +
            `timeMin=${encodeURIComponent(timeMin)}&timeMax=${encodeURIComponent(timeMax)}` +
            `&maxResults=250&singleEvents=true&orderBy=startTime`,
            { headers: { Authorization: `Bearer ${accessToken}` } }
        );

        if (!calRes.ok) {
            const err = await calRes.text();
            console.error("Google Calendar API error:", calRes.status, err);

            if (calRes.status === 403 || calRes.status === 401) {
                return NextResponse.json(
                    { error: "Calendar permissions not granted. Please sign out and sign back in to grant Calendar access." },
                    { status: 403 }
                );
            }
            return NextResponse.json(
                { error: `Google Calendar API error: ${calRes.status}` },
                { status: 500 }
            );
        }

        const calData = await calRes.json();
        const events = calData.items || [];

        let synced = 0;
        const affectedContactIds = new Set<string>();

        for (const event of events) {
            const eventId = event.id;
            const summary = event.summary || "";
            const description = event.description || "";
            const location = event.location || "";

            // Get event start time
            const startStr = event.start?.dateTime || event.start?.date;
            const endStr = event.end?.dateTime || event.end?.date;
            if (!startStr) continue;

            const startTime = new Date(startStr);
            const endTime = endStr ? new Date(endStr) : startTime;
            const durationSeconds = Math.floor((endTime.getTime() - startTime.getTime()) / 1000);

            // Match attendees by email, then try summary/description for contact names
            const matchedContactIds = new Set<string>();
            const attendees = event.attendees || [];

            for (const attendee of attendees) {
                const email = attendee.email?.toLowerCase();
                if (email && contactEmailMap.has(email)) {
                    matchedContactIds.add(contactEmailMap.get(email)!);
                }
            }

            // Also try matching name from summary
            if (matchedContactIds.size === 0) {
                for (const [name, contactId] of contactNameMap) {
                    if (summary.toLowerCase().includes(name) || description.toLowerCase().includes(name)) {
                        matchedContactIds.add(contactId);
                    }
                }
            }

            if (matchedContactIds.size === 0) continue;

            // Infer platform from event text
            const platform = inferPlatformFromEvent(summary, description, location);

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
                            content: summary || undefined,
                            metadata: { location, description: description.slice(0, 500) },
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
                            content: summary || undefined,
                            calendarEventId: eventId,
                            metadata: { location, description: description.slice(0, 500) },
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
            message: "Google Calendar sync complete",
            synced,
            eventsProcessed: events.length,
            contactsAffected: affectedContactIds.size,
        });

    } catch (error) {
        console.error("Google Calendar sync error:", error);
        return new NextResponse("Internal server error", { status: 500 });
    }
}
