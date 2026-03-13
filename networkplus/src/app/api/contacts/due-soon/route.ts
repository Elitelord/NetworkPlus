import { NextResponse } from "next/server";
import { type Session } from "next-auth";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getDueSoonContacts } from "@/lib/contacts";

export async function GET(req: Request) {
    try {
        const session = await auth() as Session | null;

        if (!session?.user?.id) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const userId = session.user.id;
        
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: {
                filterReachOutByPreferences: true,
                catchUpGroups: true,
                catchUpCategories: true,
                catchUpContactIds: true,
            }
        });

        const filters = user?.filterReachOutByPreferences ? {
            groups: user.catchUpGroups,
            categories: user.catchUpCategories,
            contactIds: user.catchUpContactIds,
        } : undefined;

        const contacts = await getDueSoonContacts(userId, filters);

        return NextResponse.json(contacts);
    } catch (error) {
        console.error("Error fetching catch-up contacts:", error);
        return NextResponse.json(
            { error: "Internal Server Error" },
            { status: 500 }
        );
    }
}
