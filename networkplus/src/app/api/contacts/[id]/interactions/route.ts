import { NextResponse } from "next/server";
import { auth } from "@/auth";
import prisma from "@/lib/prisma";

export async function GET(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const session = await auth();
        // Minimal auth check
        // if (!session?.user) {
        //     return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        // }

        const interactions = await prisma.interaction.findMany({
            where: {
                contacts: {
                    some: { id },
                },
            },
            orderBy: {
                date: "desc",
            },
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
