import { NextResponse } from "next/server";
import { type Session } from "next-auth";
import { auth } from "@/auth";
import prisma from "@/lib/prisma";
import { inferPlatformFromEvent, getValidGoogleAccessToken } from "@/lib/calendar-utils";
import { textMentionsDistinctName } from "@/lib/contact-name-matching";

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
            return NextResponse.json(
                { error: "Sign in with Google to sync your calendar." },
                { status: 400 }
            );
        }

        const accessToken = await getValidGoogleAccessToken(account, prisma);
        if (!accessToken) {
            return NextResponse.json(
                { error: "Your Google sign-in has expired. Please sign in again to continue." },
                { status: 401 }
            );
        }

        // Fetch contacts for matching
        const contacts = await prisma.contact.findMany({
            where: { ownerId: userId, email: { not: null } },
            select: { id: true, email: true, name: true },
        });

        const contactEmailMap = new Map<string, string>();
        /** Lowercased full name → contact ids (multiple if duplicate display names) */
        const nameToIds = new Map<string, string[]>();
        for (const contact of contacts) {
            if (contact.email) {
                contactEmailMap.set(contact.email.toLowerCase(), contact.id);
            }
            if (contact.name?.trim()) {
                const k = contact.name.trim().toLowerCase();
                if (!nameToIds.has(k)) nameToIds.set(k, []);
                nameToIds.get(k)!.push(contact.id);
            }
        }
        /** Only names unique in the address book; longest first so "Jane Doe" wins over "Jane" in text */
        const unambiguousNameMatchers = [...nameToIds.entries()]
            .filter(([, ids]) => ids.length === 1)
            .map(([norm, ids]) => ({ norm, id: ids[0]! }))
            .sort((a, b) => b.norm.length - a.norm.length);

        if (contactEmailMap.size === 0 && unambiguousNameMatchers.length === 0) {
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

            // Also try matching full display name in summary/description (only if that name is unique)
            if (matchedContactIds.size === 0) {
                const haystack = `${summary}\n${description}`;
                for (const { norm, id } of unambiguousNameMatchers) {
                    if (textMentionsDistinctName(haystack, norm)) {
                        matchedContactIds.add(id);
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
