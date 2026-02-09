import { NextResponse } from "next/server";
import { type Session } from "next-auth";
import { auth } from "@/auth";
import prisma from "@lib/prisma";

export async function GET(req: Request) {
    try {
        const session = await auth() as Session | null;
        if (!session?.user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const contacts = await prisma.contact.findMany({
            where: {
                ownerId: session.user.id
            },
            include: {
                // Include interactions if needed?
            }
        });

        return NextResponse.json(contacts);
    } catch (err) {
        return NextResponse.json({ error: String(err) }, { status: 500 });
    }
}

export async function POST(req: Request) {
    try {
        const session = await auth() as Session | null;
        const body = await req.json();
        const { name, description, group, groups, email, phone } = body;

        if (!name) {
            return NextResponse.json(
                { error: "Name is required" },
                { status: 400 }
            );
        }

        // Handle backward compatibility
        let validGroups = Array.isArray(groups) ? groups : [];
        if (group && typeof group === 'string' && !validGroups.includes(group)) {
            validGroups.push(group);
        }

        if (!session?.user?.id) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const newContact = await prisma.contact.create({
            data: {
                ownerId: session.user.id,
                name,
                description,
                groups: validGroups,
                email,
                phone,
                // group: group || null, // Keep existing if schema still had it? Schema replaced it.
                // If we absolutely removed `group` from schema, we can't pass it.
            },
        });

        // Trigger inference
        const { updateInferredLinks } = await import("@/lib/inference");
        await updateInferredLinks(newContact.id);

        return NextResponse.json(newContact);
    } catch (err) {
        console.error("Create contact failed:", err);
        return NextResponse.json({ error: String(err) }, { status: 500 });
    }
}
