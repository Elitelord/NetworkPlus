import { NextResponse } from "next/server";
import { type Session } from "next-auth";
import { auth } from "@/auth";
import prisma from "@lib/prisma";
import { parseJsonBody, apiError, LIMITS, clampString, clampGroupsArray } from "@/lib/api-utils";

export async function GET(
    _req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await auth() as Session | null;
        if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const { id } = await params;
        const contact = await prisma.contact.findFirst({
            where: {
                id,
                ownerId: session.user.id
            },
            include: { outgoing: true, incoming: true },
        });
        if (!contact) return NextResponse.json({ error: "Not found" }, { status: 404 });
        return NextResponse.json(contact);
    } catch (err) {
        return apiError(err);
    }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const session = await auth() as Session | null;
        if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const { id } = await params;
        const parsed = await parseJsonBody(req);
        if (!parsed.ok) return parsed.response;
        const body = parsed.data as Record<string, unknown>;
        const { group, commonPlatform } = body;

        let validGroups = clampGroupsArray(body.groups);
        if (group && typeof group === "string") {
            const g = clampString(group, LIMITS.groupItem);
            if (g && !validGroups.includes(g)) validGroups = [...validGroups, g];
        }

        const name = clampString(body.name, LIMITS.name);
        const description = clampString(body.description, LIMITS.description) ?? null;
        const email = clampString(body.email, LIMITS.email) ?? null;
        const phone = clampString(body.phone, LIMITS.phone) ?? null;
        let monthsKnown: number | undefined;
        if (typeof body.monthsKnown === "number" && Number.isInteger(body.monthsKnown) && body.monthsKnown >= 0 && body.monthsKnown <= 1200) {
            monthsKnown = body.monthsKnown;
        } else if (body.monthsKnown !== undefined) {
            return NextResponse.json({ error: "monthsKnown must be an integer between 0 and 1200" }, { status: 400 });
        }

        if (name === undefined || name === null || name.length === 0) {
            return NextResponse.json({ error: "Name is required" }, { status: 400 });
        }

        const contact = await prisma.contact.update({
            where: {
                id,
                ownerId: session.user.id
            },
            data: {
                name,
                description,
                groups: validGroups,
                email,
                phone,
                commonPlatform: commonPlatform === "" ? null : (commonPlatform as string | null) ?? undefined,
                ...(monthsKnown !== undefined && { monthsKnown }),
            },
        });

        // Trigger inference
        const { updateInferredLinks } = await import("@/lib/inference");
        await updateInferredLinks(contact.id);

        // Recalculate score if monthsKnown changed (affects timeKnownModifier)
        if (monthsKnown !== undefined) {
            console.log("Recalculating score for contact:", contact.id);
            try {
                const { recalculateContactScore } = await import("@/lib/strength-scoring");
                await recalculateContactScore(contact.id);
                console.log("Score recalculation successful");
            } catch (scoreErr) {
                console.error("Score recalculation failed:", scoreErr);
                throw scoreErr; // Re-throw to be caught by outer catch
            }
            // Re-fetch contact to get the updated score
            const updatedContact = await prisma.contact.findUnique({ where: { id } });
            return NextResponse.json(updatedContact);
        }

        return NextResponse.json(contact);
    } catch (err) {
        console.error("PATCH contact failed:", err);
        return apiError(err);
    }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const session = await auth() as Session | null;
        if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const { id } = await params;

        // Verify ownership before deleting
        const count = await prisma.contact.count({
            where: { id, ownerId: session.user.id }
        });
        if (count === 0) return NextResponse.json({ error: "Not found or unauthorized" }, { status: 404 });

        // remove links that reference this contact first to avoid FK errors
        await prisma.link.deleteMany({ where: { OR: [{ fromId: id }, { toId: id }] } });
        await prisma.contact.delete({ where: { id } });
        return NextResponse.json({ ok: true });
    } catch (err) {
        return apiError(err);
    }
}
