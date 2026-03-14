import { NextResponse } from "next/server";
import { type Session } from "next-auth";
import { auth } from "@/auth";
import prisma from "@lib/prisma";

export async function PATCH(req: Request) {
    try {
        const session = await auth() as Session | null;
        if (!session?.user?.id) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const body = await req.json();
        const { contactIds, action, groups } = body;

        if (!Array.isArray(contactIds) || contactIds.length === 0) {
            return NextResponse.json({ error: "No contacts selected" }, { status: 400 });
        }

        if (action !== "add_group" && action !== "remove_group") {
            return NextResponse.json({ error: "Invalid action" }, { status: 400 });
        }

        if (!Array.isArray(groups) || groups.length === 0) {
            return NextResponse.json({ error: "Groups array is required" }, { status: 400 });
        }

        const userId = session.user.id;

        // Fetch contacts to make sure they belong to the user and get their current groups
        const contacts = await prisma.contact.findMany({
            where: {
                id: { in: contactIds },
                ownerId: userId,
            },
            select: { id: true, groups: true },
        });

        if (contacts.length === 0) {
            return NextResponse.json({ error: "No valid contacts found" }, { status: 404 });
        }

        // Perform updates sequentially or via transaction
        const updatePromises = contacts.map(contact => {
            const currentGroups = contact.groups || [];
            let newGroups: string[] = [];

            if (action === "add_group") {
                // Add new groups, avoiding duplicates
                const set = new Set([...currentGroups, ...groups]);
                newGroups = Array.from(set);
            } else if (action === "remove_group") {
                // Remove specified groups
                newGroups = currentGroups.filter(g => !groups.includes(g));
            }

            return prisma.contact.update({
                where: { id: contact.id },
                data: { groups: newGroups },
            });
        });

        await Promise.all(updatePromises);

        // Trigger inference for all updated contacts
        const { updateInferredLinksBulk } = await import("@/lib/inference");
        await updateInferredLinksBulk(contacts.map(c => c.id));

        return NextResponse.json({ success: true, updatedCount: contacts.length });
    } catch (err: any) {
        console.error("Bulk update failed:", err);
        return NextResponse.json({ error: String(err) }, { status: 500 });
    }
}

export async function DELETE(req: Request) {
    try {
        const session = await auth() as Session | null;
        if (!session?.user?.id) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const body = await req.json();
        const { contactIds } = body;

        if (!Array.isArray(contactIds) || contactIds.length === 0) {
            return NextResponse.json({ error: "No contacts selected" }, { status: 400 });
        }

        const userId = session.user.id;

        // Delete links involving these contacts first
        // Link doesn't have an ownerId, only fromId and toId since it connects Contacts which have ownerIds.
        await prisma.link.deleteMany({
            where: {
                OR: [
                    { fromId: { in: contactIds } },
                    { toId: { in: contactIds } }
                ]
            }
        });

        // Delete the contacts
        const result = await prisma.contact.deleteMany({
            where: {
                id: { in: contactIds },
                ownerId: userId,
            },
        });

        return NextResponse.json({ success: true, deletedCount: result.count });
    } catch (err: any) {
        console.error("Bulk delete failed:", err);
        return NextResponse.json({ error: String(err) }, { status: 500 });
    }
}
