import { NextResponse } from "next/server";
import { auth } from "@/auth";
import prisma from "@/lib/prisma";

export async function GET(req: Request) {
    try {
        const session = await auth();
        // In dev mode, we might want to bypass or use fallback, but for now let's assume loose auth or none for public fetch
        // If you need specific user data:
        // const userId = session?.user?.id;

        // Fetch all contacts (acting as nodes)
        const contacts = await prisma.contact.findMany({
            include: {
                // Include interactions if needed?
            }
        });

        // Map to node format if frontend expects it, or return contacts directly and update frontend?
        // Let's return contacts directly but ensure frontend handles "name" instead of "title".
        return NextResponse.json(contacts);
    } catch (err) {
        return NextResponse.json({ error: String(err) }, { status: 500 });
    }
}

export async function POST(req: Request) {
    try {
        const session = await auth();
        const body = await req.json();
        const { name, description, group, email, phone } = body;

        // We need an ownerId. Fallback to first user in dev if not authenticated?
        let userId = session?.user?.id;
        if (!userId && process.env.NODE_ENV === "development") {
            const u = await prisma.user.findFirst();
            userId = u?.id;
        }

        if (!userId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const contact = await prisma.contact.create({
            data: {
                ownerId: userId,
                name,
                description,
                group,
                email,
                phone,
            },
        });

        return NextResponse.json(contact);
    } catch (err) {
        console.error("Create contact failed:", err);
        return NextResponse.json({ error: String(err) }, { status: 500 });
    }
}
