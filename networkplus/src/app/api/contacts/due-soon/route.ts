import { NextResponse } from "next/server";
import { type Session } from "next-auth";
import { auth } from "@/auth";
import { getDueSoonContacts } from "@/lib/contacts";

export async function GET(req: Request) {
    try {
        const session = await auth() as Session | null;

        if (!session?.user?.id) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const userId = session.user.id;
        const contacts = await getDueSoonContacts(userId);

        return NextResponse.json(contacts);
    } catch (error) {
        console.error("Error fetching catch-up contacts:", error);
        return NextResponse.json(
            { error: "Internal Server Error" },
            { status: 500 }
        );
    }
}
