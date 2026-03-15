import { NextResponse } from "next/server";
import { type Session } from "next-auth";
import { auth } from "@/auth";
import prisma from "@lib/prisma";
import { parseJsonBody, apiError, LIMITS, clampString } from "@/lib/api-utils";

const MAX_BULK_INTERACTIONS = 500;

export async function POST(req: Request) {
    try {
        const session = await auth() as Session | null;
        if (!session?.user?.id) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const parsed = await parseJsonBody(req);
        if (!parsed.ok) return parsed.response;
        const body = parsed.data as { contactIds?: unknown; date?: string; platform?: string; description?: unknown };
        let { contactIds, date, platform, description } = body;

        if (!Array.isArray(contactIds) || contactIds.length === 0) {
            return NextResponse.json({ error: "No contacts selected" }, { status: 400 });
        }
        if (contactIds.length > MAX_BULK_INTERACTIONS) {
            return NextResponse.json(
                { error: `Too many contacts. Maximum ${MAX_BULK_INTERACTIONS} per request.` },
                { status: 400 }
            );
        }

        if (!date || !platform) {
            return NextResponse.json({ error: "Date and platform are required" }, { status: 400 });
        }

        // Validate platform enum
        const validPlatforms = ["WHATSAPP", "LINKEDIN", "IMESSAGE", "IN_PERSON", "CALL", "EMAIL", "SOCIAL_MEDIA", "OTHER"];
        if (!validPlatforms.includes(platform)) {
            return NextResponse.json({ error: "Invalid platform" }, { status: 400 });
        }

        const interactionDate = new Date(date);
        if (isNaN(interactionDate.getTime())) {
            return NextResponse.json({ error: "Invalid date format" }, { status: 400 });
        }

        const userId = session.user.id;

        // Fetch contacts to make sure they belong to the user
        const contacts = await prisma.contact.findMany({
            where: {
                id: { in: contactIds },
                ownerId: userId,
            },
            select: { id: true, lastInteractionAt: true },
        });

        if (contacts.length === 0) {
            return NextResponse.json({ error: "No valid contacts found" }, { status: 404 });
        }

        // Create interactions for each valid contact
        const interactionPromises = contacts.map(contact => {
            return prisma.interaction.create({
                data: {
                    type: "MANUAL_LOG",
                    contacts: {
                        connect: [{ id: contact.id }]
                    },
                    date: interactionDate,
                    platform: platform as any,
                    content: description || null,
                }
            });
        });

        await Promise.all(interactionPromises);

        // Update contacts lastInteractionAt and trigger score recalculation
        const updatePromises = contacts.map(async contact => {
            // Update lastInteractionAt if the new interaction is more recent
            const currentLastInteraction = contact.lastInteractionAt ? new Date(contact.lastInteractionAt).getTime() : 0;
            const isNewer = interactionDate.getTime() >= currentLastInteraction;

            if (isNewer) {
                await prisma.contact.update({
                    where: { id: contact.id },
                    data: { lastInteractionAt: interactionDate },
                });
            }

            // Trigger score recalculation
            try {
                const { recalculateContactScore } = await import("@/lib/strength-scoring");
                await recalculateContactScore(contact.id);
            } catch (err) {
                console.error(`Failed to recalcluate score for ${contact.id}:`, err);
            }
        });

        await Promise.all(updatePromises);

        return NextResponse.json({ success: true, createdCount: contacts.length });
    } catch (err) {
        console.error("Bulk interaction failed:", err);
        return apiError(err);
    }
}
