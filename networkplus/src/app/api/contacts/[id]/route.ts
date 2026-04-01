import { NextResponse } from "next/server";
import { after } from "next/server";
import { type Session } from "next-auth";
import { auth } from "@/auth";
import prisma from "@lib/prisma";
import { Platform, Prisma } from "@prisma/client";
import { parseJsonBody, apiError, LIMITS, clampString, clampGroupsArray } from "@/lib/api-utils";
import { getDefaultEstimatedFrequency } from "@/lib/estimated-frequency-defaults";
import { mergeContactProfile, parseContactProfile } from "@/lib/contact-profile";

const PLATFORM_VALUES = new Set<string>(Object.values(Platform));
const VALID_CADENCES = new Set(["DAILY", "WEEKLY", "BIWEEKLY", "MONTHLY"]);
function toPlatform(value: unknown): Platform | null | undefined {
  if (value === undefined) return undefined;
  if (value === "" || value === null) return null;
  const s = String(value).trim().toUpperCase();
  return PLATFORM_VALUES.has(s) ? (s as Platform) : undefined;
}

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
        const existing = await prisma.contact.findFirst({
            where: { id, ownerId: session.user.id },
        });
        if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

        const parsed = await parseJsonBody(req);
        if (!parsed.ok) return parsed.response;
        const body = parsed.data as Record<string, unknown>;

        // Partial update: only override fields present in body; validate when provided
        const { group } = body;
        const commonPlatform = body.commonPlatform !== undefined ? toPlatform(body.commonPlatform) : undefined;
        const groupsFromBody = body.groups !== undefined ? clampGroupsArray(body.groups) : undefined;
        let validGroups: string[] | undefined = groupsFromBody;
        if (groupsFromBody !== undefined && group && typeof group === "string") {
            const g = clampString(group, LIMITS.groupItem);
            if (g && !groupsFromBody.includes(g)) validGroups = [...groupsFromBody, g];
        }

        let profileUpdate: object | null | undefined = undefined;
        if (body.profile === null) {
            profileUpdate = null;
        } else if (body.profile !== undefined) {
            const existingProfile = parseContactProfile(existing.profile);
            const merged = mergeContactProfile(existingProfile, body.profile);
            if (!merged.ok) {
                return NextResponse.json({ error: merged.error }, { status: 400 });
            }
            profileUpdate = merged.profile as object;
        }

        const nameFromBody = body.name !== undefined ? clampString(body.name, LIMITS.name) : undefined;
        if (nameFromBody !== undefined && (nameFromBody === null || nameFromBody.length === 0)) {
            return NextResponse.json({ error: "Name cannot be empty" }, { status: 400 });
        }

        const description = body.description !== undefined
            ? (clampString(body.description, LIMITS.description) ?? null)
            : undefined;
        const email = body.email !== undefined
            ? (clampString(body.email, LIMITS.email) ?? null)
            : undefined;
        const phone = body.phone !== undefined
            ? (clampString(body.phone, LIMITS.phone) ?? null)
            : undefined;
        const instagram = body.instagram !== undefined
            ? (clampString(body.instagram, LIMITS.phone) ?? null)
            : undefined;

        let monthsKnown: number | undefined;
        if (body.monthsKnown !== undefined) {
            if (typeof body.monthsKnown === "number" && Number.isInteger(body.monthsKnown) && body.monthsKnown >= 0 && body.monthsKnown <= 1200) {
                monthsKnown = body.monthsKnown;
            } else {
                return NextResponse.json({ error: "monthsKnown must be an integer between 0 and 1200" }, { status: 400 });
            }
        }

        // Estimated frequency fields
        let estCount: number | null | undefined = undefined;
        let estCadence: string | null | undefined = undefined;
        let estPlatform: Platform | null | undefined = undefined;

        if (body.estimatedFrequencyCount !== undefined) {
            estCount = (typeof body.estimatedFrequencyCount === "number" && body.estimatedFrequencyCount >= 0)
                ? body.estimatedFrequencyCount : null;
        }
        if (body.estimatedFrequencyCadence !== undefined) {
            estCadence = (typeof body.estimatedFrequencyCadence === "string" && VALID_CADENCES.has(body.estimatedFrequencyCadence))
                ? body.estimatedFrequencyCadence : null;
        }
        if (body.estimatedFrequencyPlatform !== undefined) {
            estPlatform = (typeof body.estimatedFrequencyPlatform === "string" && PLATFORM_VALUES.has(body.estimatedFrequencyPlatform.toUpperCase()))
                ? body.estimatedFrequencyPlatform.toUpperCase() as Platform : null;
        }

        const frequencyExplicitlyProvided = estCount !== undefined || estCadence !== undefined || estPlatform !== undefined;

        // If groups changed and user didn't explicitly set frequency, auto-fill from new groups 
        // ONLY if the contact is currently in "Auto" mode (not manual).
        if (validGroups !== undefined && !frequencyExplicitlyProvided) {
            const isCurrentlyAuto = existing.estimatedFrequencyIsAuto;
            const hasNoFrequency = existing.estimatedFrequencyCount === null;
            
            if (isCurrentlyAuto || hasNoFrequency) {
                const user = await (prisma.user as any).findUnique({
                    where: { id: (session as any).user.id },
                    select: { groupTypeOverrides: true, groups: true },
                });
                const overrides = (user as any)?.groupTypeOverrides as Record<string, string> | null;
                const userGroups = (user as any)?.groups || [];
                const defaults = getDefaultEstimatedFrequency(validGroups, overrides as any, userGroups);
                if (defaults) {
                    estCount = defaults.count;
                    estCadence = defaults.cadence;
                    estPlatform = defaults.platform;
                }
            }
        }

        const hasUpdates =
            nameFromBody !== undefined ||
            description !== undefined ||
            validGroups !== undefined ||
            profileUpdate !== undefined ||
            email !== undefined ||
            phone !== undefined ||
            instagram !== undefined ||
            commonPlatform !== undefined ||
            monthsKnown !== undefined ||
            estCount !== undefined ||
            estCadence !== undefined ||
            estPlatform !== undefined;
        if (!hasUpdates) {
            return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
        }

        const contact = await prisma.contact.update({
            where: {
                id,
                ownerId: session.user.id
            },
            data: {
                ...(nameFromBody !== undefined && { name: nameFromBody }),
                ...(description !== undefined && { description }),
                ...(validGroups !== undefined && { groups: validGroups }),
                ...(profileUpdate !== undefined && {
                    profile:
                        profileUpdate === null
                            ? Prisma.DbNull
                            : (profileUpdate as Prisma.InputJsonValue),
                }),
                ...(email !== undefined && { email }),
                ...(phone !== undefined && { phone }),
                ...(instagram !== undefined && { instagram }),
                ...(commonPlatform !== undefined && { commonPlatform }),
                ...(monthsKnown !== undefined && { monthsKnown }),
                ...(estCount !== undefined && { estimatedFrequencyCount: estCount }),
                ...(estCadence !== undefined && { estimatedFrequencyCadence: estCadence }),
                ...(estPlatform !== undefined && { estimatedFrequencyPlatform: estPlatform }),
                ...(frequencyExplicitlyProvided && { estimatedFrequencyIsAuto: false as any }),
                ...(!frequencyExplicitlyProvided && estCount !== undefined && { estimatedFrequencyIsAuto: true as any }),
            },
        });

        // Inference scans all owner contacts and can take seconds; defer so PATCH returns quickly.
        after(async () => {
            try {
                const { updateInferredLinks, updateInferredProfile } = await import("@/lib/inference");
                // Update links and AI bio in parallel
                await Promise.all([
                    updateInferredLinks(contact.id),
                    updateInferredProfile(contact.id)
                ]);
            } catch (e) {
                console.error("Deferred inferred-link update failed:", e);
            }
        });

        // Score recalculation can be expensive; defer to keep PATCH latency low.
        const needsScoreRecalc =
            monthsKnown !== undefined ||
            estCount !== undefined ||
            estCadence !== undefined ||
            estPlatform !== undefined;
        if (needsScoreRecalc) {
            after(async () => {
                try {
                    const { recalculateContactScore } = await import("@/lib/strength-scoring");
                    await recalculateContactScore(contact.id);
                } catch (scoreErr) {
                    console.error("Deferred score recalculation failed:", scoreErr);
                }
            });
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
