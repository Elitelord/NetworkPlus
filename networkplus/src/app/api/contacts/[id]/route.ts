import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET(
    _req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const contact = await prisma.contact.findUnique({
            where: { id },
            include: { outgoing: true, incoming: true },
        });
        if (!contact) return NextResponse.json({ error: "Not found" }, { status: 404 });
        return NextResponse.json(contact);
    } catch (err) {
        return NextResponse.json({ error: String(err) }, { status: 500 });
    }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const body = await req.json();
        const { name, description, groups, group, email, phone, commonPlatform, manualStrengthBias } = body;

        // Handle backward compatibility: if `group` string provided, add to `groups`.
        let validGroups = Array.isArray(groups) ? groups : [];
        if (group && typeof group === 'string' && !validGroups.includes(group)) {
            validGroups.push(group);
        }

        const contact = await prisma.contact.update({
            where: { id },
            data: {
                name,
                description,
                groups: validGroups, // Replaces existing groups with new list
                email,
                phone,
                commonPlatform: commonPlatform === "" ? null : commonPlatform,
                manualStrengthBias, // Allow updating manual bias
            },
        });

        // Trigger inference
        const { updateInferredLinks } = await import("@/lib/inference");
        await updateInferredLinks(contact.id);

        // Recalculate score if bias changed
        if (manualStrengthBias !== undefined) {
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
        return NextResponse.json({ error: String(err) }, { status: 500 });
    }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        // remove links that reference this contact first to avoid FK errors
        await prisma.link.deleteMany({ where: { OR: [{ fromId: id }, { toId: id }] } });
        await prisma.contact.delete({ where: { id } });
        return NextResponse.json({ ok: true });
    } catch (err) {
        return NextResponse.json({ error: String(err) }, { status: 500 });
    }
}
