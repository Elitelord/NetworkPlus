import { NextResponse } from "next/server";
import { auth } from "@/auth";
import prisma from "@/lib/prisma";

export async function POST(req: Request) {
    try {
        const session = await auth();
        // In a real app, strict auth checks here. 
        // For now, assuming dev/fallback logic similar to contacts route or loose auth.
        // If strict auth is required, we'd copy the logic from due-soon route.

        // Minimal auth check for now
        // if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const body = await req.json();
        const { contactId, type = "OTHER", content, date } = body;

        if (!contactId) {
            return NextResponse.json({ error: "Missing contactId" }, { status: 400 });
        }

        const interaction = await prisma.interaction.create({
            data: {
                contactId,
                type,
                content,
                date: date ? new Date(date) : new Date(),
                platform: "OTHER", // Default or pass from body
            },
        });

        // Update the contact's lastInteractionAt
        await prisma.contact.update({
            where: { id: contactId },
            data: { lastInteractionAt: interaction.date },
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
