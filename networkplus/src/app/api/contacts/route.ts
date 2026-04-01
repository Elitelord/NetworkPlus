import { NextResponse } from "next/server";
import { type Session } from "next-auth";
import { auth } from "@/auth";
import prisma from "@lib/prisma";
import { Platform, Prisma } from "@prisma/client";
import { parseJsonBody, apiError, LIMITS, clampString, clampGroupsArray } from "@/lib/api-utils";
import { getDefaultEstimatedFrequency } from "@/lib/estimated-frequency-defaults";
import { mergeContactProfile } from "@/lib/contact-profile";

const VALID_CADENCES = new Set(["DAILY", "WEEKLY", "BIWEEKLY", "MONTHLY"]);
const VALID_PLATFORMS = new Set<string>(Object.values(Platform));

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

        // Parse explicit estimated frequency fields from body
        let estCount = body.estimatedFrequencyCount !== undefined
            ? (typeof body.estimatedFrequencyCount === "number" ? body.estimatedFrequencyCount : null)
            : undefined;
        let estCadence = body.estimatedFrequencyCadence !== undefined
            ? (typeof body.estimatedFrequencyCadence === "string" && VALID_CADENCES.has(body.estimatedFrequencyCadence) ? body.estimatedFrequencyCadence : null)
            : undefined;
        let estPlatform = body.estimatedFrequencyPlatform !== undefined
            ? (typeof body.estimatedFrequencyPlatform === "string" && VALID_PLATFORMS.has(body.estimatedFrequencyPlatform) ? body.estimatedFrequencyPlatform as Platform : null)
            : undefined;

        // Auto-fill from group type if not explicitly provided
        const explicitlyProvided = estCount !== undefined || estCadence !== undefined || estPlatform !== undefined;
        if (!explicitlyProvided && validGroups.length > 0) {
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

        let profileJson: Prisma.InputJsonValue | undefined = undefined;
        if (body.profile !== undefined && body.profile !== null) {
            const merged = mergeContactProfile(null, body.profile);
            if (!merged.ok) {
                return NextResponse.json({ error: merged.error }, { status: 400 });
            }
            profileJson = merged.profile as Prisma.InputJsonValue;
        }

        const newContact = await prisma.contact.create({
            data: {
                ownerId: session.user.id,
                name,
                description: description ?? null,
                groups: validGroups,
                email: email ?? null,
                phone: phone ?? null,
                ...(profileJson !== undefined && { profile: profileJson }),
                ...(estCount !== undefined && { estimatedFrequencyCount: estCount }),
                ...(estCadence !== undefined && { estimatedFrequencyCadence: estCadence }),
                ...(estPlatform !== undefined && { estimatedFrequencyPlatform: estPlatform }),
                estimatedFrequencyIsAuto: (!explicitlyProvided && estCount !== undefined) as any,
            },
        });

        // Recalculate score if estimated frequency was set
        if (newContact.estimatedFrequencyCount) {
            const { recalculateContactScore } = await import("@/lib/strength-scoring");
            await recalculateContactScore(newContact.id);
        }

        // Trigger inference
        const { updateInferredLinks } = await import("@/lib/inference");
        await updateInferredLinks(newContact.id);

        // Re-fetch to get updated score
        const finalContact = await prisma.contact.findUnique({ where: { id: newContact.id } });

        // Trigger AI profile enrichment
        const { updateInferredProfile } = await import("@/lib/inference");
        // We use a background-like approach here, avoiding blocking the main response
        updateInferredProfile(newContact.id).catch(e => console.error("Initial AI Enrichment failed:", e));

        return NextResponse.json(finalContact ?? newContact);
    } catch (err) {
        console.error("Create contact failed:", err);
        return apiError(err);
    }
}
