import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getDueSoonContacts } from "@/lib/contacts";
import prisma from "@/lib/prisma";

export async function GET(req: Request) {
    try {
        const session = await auth();
        let userId: string | undefined;

        if (!session?.user?.email) {
            // Development bypass: If strict auth fails, check if we are in dev mode and use a fallback
            if (process.env.NODE_ENV === "development") {
                console.log("Dev mode: attempting to resolve user without session...");
                const firstUser = await prisma.user.findFirst();
                if (firstUser) {
                    userId = firstUser.id;
                    console.log(`Dev mode: Using fallback user ${firstUser.email}`);
                } else {
                    return NextResponse.json({ error: "Unauthorized - No dev user found" }, { status: 401 });
                }
            } else {
                return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
            }
        } else {
            userId = session.user.id;
            // Fallback: look up user by email if ID is not in session
            if (!userId) {
                const user = await prisma.user.findUnique({
                    where: { email: session.user.email },
                });
                if (user) {
                    userId = user.id;
                }
            }
        }

        if (!userId) {
            return NextResponse.json({ error: "User not found" }, { status: 404 });
        }

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
