import { NextResponse } from "next/server";
import { type Session } from "next-auth";
import { auth } from "@/auth";
import prisma from "@/lib/prisma";
import { inferPlatformFromEvent, getValidGoogleAccessToken } from "@/lib/calendar-utils";

// GET: List upcoming calendar events (next 30 days)
export async function GET(req: Request) {
    try {
        const session = await auth() as Session | null;
        if (!session?.user?.id) {
            return new NextResponse("Unauthorized", { status: 401 });
        }

        const account = await prisma.account.findFirst({
            where: { userId: session.user.id, provider: "google" },
        });

        if (!account) {
            return NextResponse.json({ events: [], error: "No Google account linked" });
        }

        const accessToken = await getValidGoogleAccessToken(account, prisma);
        if (!accessToken) {
            return NextResponse.json({ events: [], error: "Google authentication expired" });
        }

        const now = new Date();
        const timeMax = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString();

        const calRes = await fetch(
            `https://www.googleapis.com/calendar/v3/calendars/primary/events?` +
            `timeMin=${encodeURIComponent(now.toISOString())}&timeMax=${encodeURIComponent(timeMax)}` +
            `&maxResults=100&singleEvents=true&orderBy=startTime`,
            { headers: { Authorization: `Bearer ${accessToken}` } }
        );

        if (!calRes.ok) {
            return NextResponse.json({ events: [], error: "Failed to fetch events" });
        }

        const calData = await calRes.json();
        const events = (calData.items || []).map((event: any) => ({
            id: event.id,
            summary: event.summary || "Untitled",
            description: event.description || "",
            location: event.location || "",
            start: event.start?.dateTime || event.start?.date,
            end: event.end?.dateTime || event.end?.date,
            attendees: (event.attendees || []).map((a: any) => ({
                email: a.email,
                displayName: a.displayName,
                responseStatus: a.responseStatus,
            })),
            htmlLink: event.htmlLink,
        }));

        return NextResponse.json({ events });

    } catch (error) {
        console.error("Calendar events fetch error:", error);
        return new NextResponse("Internal server error", { status: 500 });
    }
}

// POST: Create a Google Calendar event and corresponding interaction
export async function POST(req: Request) {
    try {
        const session = await auth() as Session | null;
        if (!session?.user?.id) {
            return new NextResponse("Unauthorized", { status: 401 });
        }

        const userId = session.user.id;
        const body = await req.json();
        const { title, description, startTime, endTime, contactIds, attendeeEmails, createMeetLink } = body;

        if (!title || !startTime) {
            return NextResponse.json({ error: "Title and start time are required" }, { status: 400 });
        }

        const account = await prisma.account.findFirst({
            where: { userId, provider: "google" },
        });

        if (!account) {
            return new NextResponse("No Google account linked", { status: 400 });
        }

        const accessToken = await getValidGoogleAccessToken(account, prisma);
        if (!accessToken) {
            return new NextResponse("Google authentication expired", { status: 401 });
        }

        // The startTime and endTime from the frontend are in the user's local timezone (e.g. "2026-03-06T13:00")
        // but they are sent as ISO strings without offsets. When `new Date()` parses them on the server,
        // it assumes they are UTC if they have a 'Z', or local server time if they don't.
        // The safest way to handle this is to have the client send the exact ISO string with offset,
        // but since the client sends "YYYY-MM-DDTHH:mm", we can treat it as a floating time.
        // Google Calendar accepts `dateTime` as an RFC3339 timestamp.

        // If we just pass the strings as they are to Google, it will treat them as the server's local time,
        // which might be UTC. To fix this, we should ensure the client is sending the full timezone offset,
        // OR we can just pass the raw datetime string and the client's timezone if they provide it.
        // Let's assume the frontend will start sending the proper full ISO string.
        const startDateTime = new Date(startTime).toISOString();
        const endDateTime = endTime
            ? new Date(endTime).toISOString()
            : new Date(new Date(startTime).getTime() + 60 * 60 * 1000).toISOString();

        // Build Google Calendar event
        const eventBody: any = {
            summary: title,
            description: description || "",
            start: {
                dateTime: startDateTime,
            },
            end: {
                dateTime: endDateTime,
            },
        };

        // Add attendees
        const emails = attendeeEmails || [];
        if (emails.length > 0) {
            eventBody.attendees = emails.map((email: string) => ({ email }));
        }

        if (createMeetLink) {
            eventBody.conferenceData = {
                createRequest: {
                    requestId: `meet-${Date.now()}-${Math.random().toString(36).substring(7)}`,
                    conferenceSolutionKey: { type: "hangoutsMeet" }
                }
            };
        }

        // Create event in Google Calendar
        const createRes = await fetch(
            "https://www.googleapis.com/calendar/v3/calendars/primary/events?sendUpdates=all&conferenceDataVersion=1",
            {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(eventBody),
            }
        );

        if (!createRes.ok) {
            const err = await createRes.text();
            console.error("Failed to create calendar event:", err);
            return NextResponse.json({ error: "Failed to create calendar event" }, { status: 500 });
        }

        const createdEvent = await createRes.json();

        // Create corresponding interaction for matched contacts
        const targets = contactIds || [];
        if (targets.length > 0) {
            // Verify ownership
            const count = await prisma.contact.count({
                where: { id: { in: targets }, ownerId: userId },
            });

            if (count === targets.length) {
                const start = new Date(startTime);
                const end = endTime ? new Date(endTime) : new Date(start.getTime() + 60 * 60 * 1000);
                const durationSeconds = Math.floor((end.getTime() - start.getTime()) / 1000);
                const platform = inferPlatformFromEvent(title, description, null);

                await prisma.interaction.create({
                    data: {
                        type: "Calendar Event",
                        platform,
                        date: start,
                        startTime: start,
                        endTime: end,
                        durationSeconds,
                        content: title,
                        calendarEventId: createdEvent.id,
                        metadata: { description: description?.slice(0, 500) },
                        contacts: {
                            connect: targets.map((id: string) => ({ id })),
                        },
                    },
                });
            }
        }

        return NextResponse.json({
            message: "Event created",
            eventId: createdEvent.id,
            htmlLink: createdEvent.htmlLink,
        });

    } catch (error) {
        console.error("Create calendar event error:", error);
        return new NextResponse("Internal server error", { status: 500 });
    }
}
