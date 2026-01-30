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
        const { contactId, type = "OTHER", content, date, platform = "OTHER" } = body;

        if (!contactId) {
            return NextResponse.json({ error: "Missing contactId" }, { status: 400 });
        }

        const interactionDate = date ? new Date(date) : new Date();

        // Transaction to ensure atomicity
        const [interaction] = await prisma.$transaction([
            prisma.interaction.create({
                data: {
                    contactId,
                    type,
                    content,
                    date: interactionDate,
                    platform,
                },
            }),
            prisma.contact.update({
                where: { id: contactId },
                data: {
                    lastInteractionAt: interactionDate,
                    lastPlatform: platform,
                },
            }),
        ]);

        return NextResponse.json(interaction);
    } catch (err) {
        console.error("Create interaction failed:", err);
        return NextResponse.json(
            { error: "Internal Server Error" },
            { status: 500 }
        );
    }
}
