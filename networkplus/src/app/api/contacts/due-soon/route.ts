import { NextResponse } from "next/server";
import { type Session } from "next-auth";
import { auth } from "@/auth";
import { getDueSoonContacts } from "@/lib/contacts";
import prisma from "@/lib/prisma";

export async function GET(req: Request) {
    try {
        const session = await auth() as Session | null;

        if (!session?.user?.id) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const userId = session.user.id;

        // Get threshold from query params
        const { searchParams } = new URL(req.url);
        const daysParam = searchParams.get("days");
        const thresholdDays = daysParam ? parseInt(daysParam, 10) : 30;

        const contacts = await getDueSoonContacts(userId, thresholdDays);

        return NextResponse.json(contacts);
    } catch (error) {
        console.error("Error fetching due soon contacts:", error);
        return NextResponse.json(
            { error: "Internal Server Error" },
            { status: 500 }
        );
    }
}
