import { NextResponse } from "next/server";
import { type Session } from "next-auth";
import { auth } from "@/auth";
import prisma from "@lib/prisma";
import { parseJsonBody, apiError, LIMITS, clampString, clampGroupsArray } from "@/lib/api-utils";

export async function GET(req: Request) {
    try {
        const session = await auth() as Session | null;
        if (!session?.user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const url = new URL(req.url);
        const includeLinkedIn = url.searchParams.get("includeLinkedIn") === "true";

        const contacts = await prisma.contact.findMany({
            where: {
                ownerId: session.user.id
            },
            include: includeLinkedIn ? {
                interactions: {
                    where: { platform: "LINKEDIN" },
                    select: { date: true, platform: true },
                    orderBy: { date: "desc" },
                    take: 20,
                }
            } : undefined,
        });

        return NextResponse.json(contacts);
    } catch (err) {
        return apiError(err);
    }
}

export async function POST(req: Request) {
    try {
        const session = await auth() as Session | null;
        if (!session?.user?.id) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const parsed = await parseJsonBody(req);
        if (!parsed.ok) return parsed.response;
        const body = parsed.data as Record<string, unknown>;
        const { group } = body;
        const name = clampString(body.name, LIMITS.name);
        const description = clampString(body.description, LIMITS.description) ?? undefined;
        const email = clampString(body.email, LIMITS.email) ?? undefined;
        const phone = clampString(body.phone, LIMITS.phone) ?? undefined;
        let validGroups = clampGroupsArray(body.groups);
        if (group && typeof group === "string") {
            const g = clampString(group, LIMITS.groupItem);
            if (g && !validGroups.includes(g)) validGroups = [...validGroups, g];
        }

        if (!name || name.length === 0) {
            return NextResponse.json({ error: "Name is required" }, { status: 400 });
        }

        const newContact = await prisma.contact.create({
            data: {
                ownerId: session.user.id,
                name,
                description: description ?? null,
                groups: validGroups,
                email: email ?? null,
                phone: phone ?? null,
            },
        });

        // Trigger inference
        const { updateInferredLinks } = await import("@/lib/inference");
        await updateInferredLinks(newContact.id);

        return NextResponse.json(newContact);
    } catch (err) {
        console.error("Create contact failed:", err);
        return apiError(err);
    }
}
