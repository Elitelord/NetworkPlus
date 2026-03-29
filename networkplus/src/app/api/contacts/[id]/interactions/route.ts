import { NextResponse } from "next/server";
import { type Session } from "next-auth";
import { auth } from "@/auth";
import prisma from "@lib/prisma";

export async function GET(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const session = await auth() as Session | null;
        // Minimal auth check
        // if (!session?.user) {
        //     return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        // }

        const url = new URL(req.url);
        const limit = Math.min(parseInt(url.searchParams.get("limit") || "50", 10), 200);
        const offset = parseInt(url.searchParams.get("offset") || "0", 10);

        const interactions = await prisma.interaction.findMany({
            where: {
                contacts: {
                    some: { id },
                },
            },
            orderBy: {
                date: "desc",
            },
            take: limit,
            skip: offset,
        });

        return NextResponse.json(interactions);
    } catch (err) {
        console.error("Fetch interactions failed:", err);
        return NextResponse.json(
            { error: "Internal Server Error" },
            { status: 500 }
        );
    }
}
