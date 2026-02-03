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
        const { name, description, groups, group, email, phone, commonPlatform } = body;

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
                commonPlatform
            },
        });

        // Trigger inference
        const { updateInferredLinks } = await import("@/lib/inference");
        await updateInferredLinks(contact.id);

        return NextResponse.json(contact);
    } catch (err) {
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
