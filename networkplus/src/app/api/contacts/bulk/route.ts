import { NextResponse } from "next/server";
import { type Session } from "next-auth";
import { auth } from "@/auth";
import prisma from "@lib/prisma";
import { Platform, Prisma } from "@prisma/client";
import { parseJsonBody, apiError, checkRateLimit, getRateLimitId, RATE_LIMITS, LIMITS, clampGroupsArray } from "@/lib/api-utils";
import { mergeContactProfile, parseContactProfile } from "@/lib/contact-profile";
import { getDefaultEstimatedFrequency } from "@/lib/estimated-frequency-defaults";
import type { GroupType } from "@/lib/group-type-classifier";

const VALID_CADENCES = new Set(["DAILY", "WEEKLY", "BIWEEKLY", "MONTHLY"]);
const VALID_PLATFORMS = new Set<string>(Object.values(Platform));

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
        const body = parsed.data as Record<string, unknown>;
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

        const validActions = ["add_group", "remove_group", "set_estimated_frequency", "clear_estimated_frequency", "backfill_estimated_frequency", "merge_profile"];
        if (typeof action !== "string" || !validActions.includes(action)) {
            return NextResponse.json({ error: "Invalid action" }, { status: 400 });
        }

        const userId = session.user.id;

        // ─── Estimated frequency actions ─────────────────────────────────
        if (action === "set_estimated_frequency") {
            const count = body.estimatedFrequencyCount;
            const cadence = body.estimatedFrequencyCadence;
            const platform = body.estimatedFrequencyPlatform;

            if (typeof count !== "number" || count < 1) {
                return NextResponse.json({ error: "estimatedFrequencyCount must be a positive number" }, { status: 400 });
            }
            if (typeof cadence !== "string" || !VALID_CADENCES.has(cadence)) {
                return NextResponse.json({ error: "estimatedFrequencyCadence must be DAILY, WEEKLY, BIWEEKLY, or MONTHLY" }, { status: 400 });
            }
            if (typeof platform !== "string" || !VALID_PLATFORMS.has(platform)) {
                return NextResponse.json({ error: "estimatedFrequencyPlatform must be a valid platform" }, { status: 400 });
            }

            await prisma.contact.updateMany({
                where: { id: { in: contactIds as string[] }, ownerId: userId },
                data: {
                    estimatedFrequencyCount: count,
                    estimatedFrequencyCadence: cadence,
                    estimatedFrequencyPlatform: platform as Platform,
                    estimatedFrequencyIsAuto: false as any, // Explicitly set by user
                },
            });

            // Recalculate scores
            const { recalculateContactScore } = await import("@/lib/strength-scoring");
            for (const cid of contactIds as string[]) {
                await recalculateContactScore(cid);
            }

            return NextResponse.json({ success: true, updatedCount: (contactIds as string[]).length });
        }

        if (action === "clear_estimated_frequency") {
            await prisma.contact.updateMany({
                where: { id: { in: contactIds as string[] }, ownerId: userId },
                data: {
                    estimatedFrequencyCount: null,
                    estimatedFrequencyCadence: null,
                    estimatedFrequencyPlatform: null,
                    estimatedFrequencyIsAuto: false,
                } as any
            });

            const { recalculateContactScore } = await import("@/lib/strength-scoring");
            for (const cid of contactIds as string[]) {
                await recalculateContactScore(cid);
            }

            return NextResponse.json({ success: true, updatedCount: (contactIds as string[]).length });
        }

        // ─── Backfill estimated frequency from group types ───────────────
        if (action === "backfill_estimated_frequency") {
            const user = await (prisma.user as any).findUnique({
                where: { id: userId },
                select: { groupTypeOverrides: true, groups: true },
            });
            const overrides = (user as any)?.groupTypeOverrides as Record<string, GroupType> | null;
            const userGroups = (user as any)?.groups || [];

            const contactsToBackfill = await prisma.contact.findMany({
                where: {
                    id: { in: contactIds as string[] },
                    ownerId: userId,
                    OR: [
                        { estimatedFrequencyCount: null },
                        { estimatedFrequencyIsAuto: true } as any,
                    ],
                },
                select: { id: true, groups: true },
            });

            let updatedCount = 0;
            const { recalculateContactScore } = await import("@/lib/strength-scoring");

            for (const c of contactsToBackfill) {
                if (!c.groups || c.groups.length === 0) continue;
                const defaults = getDefaultEstimatedFrequency(c.groups, overrides, userGroups);
                if (!defaults) continue;

                await prisma.contact.update({
                    where: { id: c.id },
                    data: {
                        estimatedFrequencyCount: defaults.count,
                        estimatedFrequencyCadence: defaults.cadence,
                        estimatedFrequencyPlatform: defaults.platform,
                        estimatedFrequencyIsAuto: true,
                    } as any
                });
                await recalculateContactScore(c.id);
                updatedCount++;
            }

            return NextResponse.json({
                success: true,
                updatedCount,
                skippedCount: (contactIds as string[]).length - updatedCount,
            });
        }

        // ─── Merge profile patch into many contacts ─────────────────────
        if (action === "merge_profile") {
            const profilePatch = body.profile;
            if (profilePatch === undefined || profilePatch === null || typeof profilePatch !== "object" || Array.isArray(profilePatch)) {
                return NextResponse.json({ error: "profile object is required" }, { status: 400 });
            }

            const contactsForProfile = await prisma.contact.findMany({
                where: { id: { in: contactIds as string[] }, ownerId: userId },
                select: { id: true, profile: true },
            });

            if (contactsForProfile.length === 0) {
                return NextResponse.json({ error: "No valid contacts found" }, { status: 404 });
            }

            for (const c of contactsForProfile) {
                const existing = parseContactProfile(c.profile);
                const merged = mergeContactProfile(existing, profilePatch);
                if (!merged.ok) {
                    return NextResponse.json({ error: merged.error }, { status: 400 });
                }
                await prisma.contact.update({
                    where: { id: c.id },
                    data: { profile: merged.profile as Prisma.InputJsonValue },
                });
            }

            const { updateInferredLinksBulk } = await import("@/lib/inference");
            await updateInferredLinksBulk(contactsForProfile.map((c) => c.id));

            return NextResponse.json({ success: true, updatedCount: contactsForProfile.length });
        }

        // ─── Group actions ───────────────────────────────────────────────
        if (!Array.isArray(groups) || (groups as unknown[]).length === 0) {
            return NextResponse.json({ error: "Groups array is required" }, { status: 400 });
        }

        const validGroups = clampGroupsArray(groups);
        if (validGroups.length === 0) {
            return NextResponse.json({ error: "At least one valid group name is required" }, { status: 400 });
        }

        // Fetch contacts to make sure they belong to the user and get their current groups
        const contacts = await prisma.contact.findMany({
            where: {
                id: { in: contactIds as string[] },
                ownerId: userId,
            },
            select: { id: true, groups: true },
        });

        if (contacts.length === 0) {
            return NextResponse.json({ error: "No valid contacts found" }, { status: 404 });
        }

        const updatePromises = contacts.map(contact => {
            const currentGroups = contact.groups || [];
            let newGroups: string[] = [];

            if (action === "add_group") {
                const set = new Set([...currentGroups, ...validGroups]);
                newGroups = Array.from(set);
            } else if (action === "remove_group") {
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
