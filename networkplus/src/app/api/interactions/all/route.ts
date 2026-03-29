import { NextResponse } from "next/server";
import { type Session } from "next-auth";
import { auth } from "@/auth";
import prisma from "@lib/prisma";

export async function GET() {
    try {
        const session = await auth() as Session | null;
        if (!session?.user?.id) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const interactions = await prisma.interaction.findMany({
            where: {
                contacts: {
                    some: { ownerId: session.user.id },
                },
            },
            include: {
                contacts: {
                    select: { id: true, name: true },
                },
            },
            orderBy: { date: "desc" },
        });

        return NextResponse.json(interactions);
    } catch (err) {
        console.error("Fetch all interactions failed:", err);
        return NextResponse.json(
            { error: "Internal Server Error" },
            { status: 500 }
        );
    }
}
