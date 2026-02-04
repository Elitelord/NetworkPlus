import { NextResponse } from "next/server";
import { auth } from "@/auth";
import prisma from "@/lib/prisma";

export async function POST(req: Request) {
    try {
        const session = await auth();
        // Minimal auth check
        // if (!session?.user) {
        //     return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        // }

        const body = await req.json();
        const { contactIds, type = "OTHER", content, date, platform = "OTHER" } = body;

        // Fallback for single contactId support (if needed during transition or just for safety)
        const targets = contactIds || (body.contactId ? [body.contactId] : []);

        if (!targets || targets.length === 0) {
            return NextResponse.json({ error: "Missing contactIds" }, { status: 400 });
        }

        const interactionDate = date ? new Date(date) : new Date();

        // Transaction to ensure atomicity
        const interaction = await prisma.$transaction(async (tx) => {
            // 1. Create interaction
            const interaction = await tx.interaction.create({
                data: {
                    type,
                    content,
                    date: interactionDate,
                    platform,
                    contacts: {
                        connect: targets.map((id: string) => ({ id })),
                    },
                },
            });

            // 2. Update each contact's lastInteractionAt and recalculate score
            const { recalculateContactScore } = await import("@/lib/strength-scoring");

            await Promise.all(targets.map(async (id: string) => {
                await tx.contact.update({
                    where: { id },
                    data: {
                        lastInteractionAt: interactionDate,
                        lastPlatform: platform,
                    },
                });
                await recalculateContactScore(id, tx);
            }));

            return interaction;
        });

        return NextResponse.json(interaction);
    } catch (err) {
        console.error("Create interaction failed:", err);
        return NextResponse.json(
            { error: "Internal Server Error" },
            { status: 500 }
        );
    }
}
