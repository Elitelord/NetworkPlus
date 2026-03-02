import { NextResponse } from "next/server";
import { type Session } from "next-auth";
import { auth } from "@/auth";
import prisma from "@lib/prisma";

export async function PUT(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const session = await auth() as Session | null;
        if (!session?.user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        // Verify the interaction exists and belongs to the user
        const existing = await prisma.interaction.findUnique({
            where: { id },
            include: { contacts: { select: { id: true, ownerId: true } } },
        });

        if (!existing) {
            return NextResponse.json({ error: "Interaction not found" }, { status: 404 });
        }

        // Check ownership via contacts
        const ownsAll = existing.contacts.every(c => c.ownerId === session.user!.id);
        if (!ownsAll) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
        }

        const body = await req.json();
        const { contactIds, type, content, date, platform, durationMinutes, messageCount } = body;

        const interactionDate = date ? new Date(date) : existing.date;
        const durationSeconds = durationMinutes ? parseInt(durationMinutes, 10) * 60 : undefined;
        const msgCount = messageCount ? parseInt(messageCount, 10) : undefined;
        let startTime = interactionDate;
        if (durationSeconds) {
            startTime = new Date(interactionDate.getTime() - durationSeconds * 1000);
        }

        // Collect all affected contact ids (old + new) for score recalculation
        const oldContactIds = existing.contacts.map(c => c.id);
        const newContactIds: string[] = contactIds || oldContactIds;

        // Verify ownership of new contacts
        if (contactIds) {
            const count = await prisma.contact.count({
                where: {
                    id: { in: newContactIds },
                    ownerId: session.user.id,
                },
            });
            if (count !== newContactIds.length) {
                return NextResponse.json({ error: "One or more contacts not found or unauthorized" }, { status: 403 });
            }
        }

        const allAffectedIds = [...new Set([...oldContactIds, ...newContactIds])];

        const updated = await prisma.$transaction(async (tx) => {
            const updated = await tx.interaction.update({
                where: { id },
                data: {
                    type: type ?? existing.type,
                    content: content !== undefined ? content : existing.content,
                    date: interactionDate,
                    startTime,
                    endTime: interactionDate,
                    durationSeconds: durationSeconds !== undefined ? durationSeconds : existing.durationSeconds,
                    messageCount: msgCount !== undefined ? msgCount : existing.messageCount,
                    rawMessageCount: msgCount !== undefined ? msgCount : existing.rawMessageCount,
                    platform: platform ?? existing.platform,
                    contacts: contactIds
                        ? { set: newContactIds.map((cid: string) => ({ id: cid })) }
                        : undefined,
                },
            });

            // Recalculate scores for all affected contacts
            const { recalculateContactScore } = await import("@/lib/strength-scoring");

            await Promise.all(allAffectedIds.map(async (cid: string) => {
                const latestInteraction = await tx.interaction.findFirst({
                    where: { contacts: { some: { id: cid } } },
                    orderBy: { date: "desc" },
                    select: { date: true, platform: true },
                });

                await tx.contact.update({
                    where: { id: cid },
                    data: {
                        lastInteractionAt: latestInteraction?.date ?? null,
                        lastPlatform: latestInteraction?.platform ?? null,
                    },
                });

                await recalculateContactScore(cid, tx);
            }));

            return updated;
        });

        return NextResponse.json(updated);
    } catch (err) {
        console.error("Update interaction failed:", err);
        return NextResponse.json(
            { error: "Internal Server Error" },
            { status: 500 }
        );
    }
}

export async function DELETE(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const session = await auth() as Session | null;
        if (!session?.user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        // Verify the interaction exists and belongs to the user
        const existing = await prisma.interaction.findUnique({
            where: { id },
            include: { contacts: { select: { id: true, ownerId: true } } },
        });

        if (!existing) {
            return NextResponse.json({ error: "Interaction not found" }, { status: 404 });
        }

        const ownsAll = existing.contacts.every(c => c.ownerId === session.user!.id);
        if (!ownsAll) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
        }

        const affectedContactIds = existing.contacts.map(c => c.id);

        await prisma.$transaction(async (tx) => {
            // Delete any recurring instances that reference this interaction
            await tx.interaction.deleteMany({
                where: { parentInteractionId: id },
            });

            await tx.interaction.delete({ where: { id } });

            // Recalculate scores for all affected contacts
            const { recalculateContactScore } = await import("@/lib/strength-scoring");

            await Promise.all(affectedContactIds.map(async (cid: string) => {
                const latestInteraction = await tx.interaction.findFirst({
                    where: { contacts: { some: { id: cid } } },
                    orderBy: { date: "desc" },
                    select: { date: true, platform: true },
                });

                await tx.contact.update({
                    where: { id: cid },
                    data: {
                        lastInteractionAt: latestInteraction?.date ?? null,
                        lastPlatform: latestInteraction?.platform ?? null,
                    },
                });

                await recalculateContactScore(cid, tx);
            }));
        });

        return NextResponse.json({ success: true });
    } catch (err) {
        console.error("Delete interaction failed:", err);
        return NextResponse.json(
            { error: "Internal Server Error" },
            { status: 500 }
        );
    }
}
