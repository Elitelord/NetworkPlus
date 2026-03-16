import { NextResponse } from "next/server";
import { type Session } from "next-auth";
import { auth } from "@/auth";
import prisma from "@lib/prisma";
import { parseJsonBody, apiError, checkRateLimit, getRateLimitId, RATE_LIMITS, LIMITS, clampGroupsArray } from "@/lib/api-utils";

export async function PATCH(req: Request) {
    try {
        const session = await auth() as Session | null;
        if (!session?.user?.id) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const limited = checkRateLimit(getRateLimitId(req, session.user.id), RATE_LIMITS.bulk);
        if (limited) return limited;

        const parsed = await parseJsonBody(req);
        if (!parsed.ok) return parsed.response;
        const body = parsed.data as { contactIds?: unknown; action?: string; groups?: unknown };
        const { contactIds, action, groups } = body;

        if (!Array.isArray(contactIds) || contactIds.length === 0) {
            return NextResponse.json({ error: "No contacts selected" }, { status: 400 });
        }

        const MAX_BULK_SIZE = 500;
        if (contactIds.length > MAX_BULK_SIZE) {
            return NextResponse.json(
                { error: `Too many contacts. Maximum ${MAX_BULK_SIZE} per request.` },
                { status: 400 }
            );
        }

        if (action !== "add_group" && action !== "remove_group") {
            return NextResponse.json({ error: "Invalid action" }, { status: 400 });
        }

        if (!Array.isArray(groups) || groups.length === 0) {
            return NextResponse.json({ error: "Groups array is required" }, { status: 400 });
        }

        const validGroups = clampGroupsArray(groups);
        if (validGroups.length === 0) {
            return NextResponse.json({ error: "At least one valid group name is required" }, { status: 400 });
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
                const set = new Set([...currentGroups, ...validGroups]);
                newGroups = Array.from(set);
            } else if (action === "remove_group") {
                // Remove specified groups
                newGroups = currentGroups.filter(g => !validGroups.includes(g));
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
    } catch (err) {
        console.error("Bulk update failed:", err);
        return apiError(err);
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

        const MAX_BULK_DELETE = 500;
        if (contactIds.length > MAX_BULK_DELETE) {
            return NextResponse.json(
                { error: `Too many contacts. Maximum ${MAX_BULK_DELETE} per delete.` },
                { status: 400 }
            );
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
    } catch (err) {
        console.error("Bulk delete failed:", err);
        return apiError(err);
    }
}
