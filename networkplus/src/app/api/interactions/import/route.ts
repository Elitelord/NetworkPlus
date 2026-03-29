import { NextResponse } from "next/server";
import { type Session } from "next-auth";
import { auth } from "@/auth";
import prisma from "@lib/prisma";

export async function POST(req: Request) {
    try {
        const session = await auth() as Session | null;
        if (!session?.user?.id) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const userId = session.user.id;
        const body = await req.json();
        const { conversations } = body;

        if (!Array.isArray(conversations) || conversations.length === 0) {
            return NextResponse.json(
                { error: "Invalid input: conversations must be a non-empty array" },
                { status: 400 }
            );
        }

        const importedInteractions: any[] = [];
        const skippedRows: { name: string; reason: string }[] = [];
        let duplicateCount = 0;

        const { recalculateContactScore } = await import("@/lib/strength-scoring");

        for (const conv of conversations) {
            const { contactName, messageCount, latestDate, contentPreview } = conv;

            if (!contactName || !latestDate) {
                skippedRows.push({
                    name: contactName || "Unknown",
                    reason: "Missing contact name or date",
                });
                continue;
            }

            // Match by full display name; require a single unambiguous contact
            const nameMatches = await prisma.contact.findMany({
                where: {
                    ownerId: userId,
                    name: { equals: contactName.trim(), mode: "insensitive" },
                },
                take: 2,
            });

            if (nameMatches.length === 0) {
                skippedRows.push({
                    name: contactName,
                    reason: "No matching contact found",
                });
                continue;
            }

            if (nameMatches.length > 1) {
                skippedRows.push({
                    name: contactName,
                    reason:
                        "Multiple contacts share this name — skipped. Rename one contact to disambiguate.",
                });
                continue;
            }

            const contact = nameMatches[0]!;

            const interactionDate = new Date(latestDate);
            if (isNaN(interactionDate.getTime())) {
                skippedRows.push({
                    name: contactName,
                    reason: "Invalid date",
                });
                continue;
            }

            // Create interaction
            const interaction = await prisma.$transaction(async (tx) => {
                const interaction = await tx.interaction.create({
                    data: {
                        type: "MESSAGE",
                        platform: "LINKEDIN",
                        date: interactionDate,
                        startTime: interactionDate,
                        endTime: interactionDate,
                        messageCount: messageCount || 1,
                        rawMessageCount: messageCount || 1,
                        content: contentPreview || `${messageCount} LinkedIn messages`,
                        contacts: {
                            connect: [{ id: contact.id }],
                        },
                    },
                });

                // Update contact's lastInteractionAt
                const latestInteraction = await tx.interaction.findFirst({
                    where: { contacts: { some: { id: contact.id } } },
                    orderBy: { date: "desc" },
                    select: { date: true, platform: true },
                });

                if (latestInteraction) {
                    await tx.contact.update({
                        where: { id: contact.id },
                        data: {
                            lastInteractionAt: latestInteraction.date,
                            lastPlatform: latestInteraction.platform,
                        },
                    });
                }

                await recalculateContactScore(contact.id, tx);

                return interaction;
            });

            importedInteractions.push(interaction);
        }

        return NextResponse.json({
            importedCount: importedInteractions.length,
            skippedCount: skippedRows.length,
            duplicateCount,
            skippedRows,
        });
    } catch (err) {
        console.error("LinkedIn interaction import failed:", err);
        return NextResponse.json(
            { error: "Internal Server Error" },
            { status: 500 }
        );
    }
}
