import prisma from "@lib/prisma";
import { Platform } from "@prisma/client";

// Platform weights
const PLATFORM_WEIGHTS: Record<Platform, number> = {
    IN_PERSON: 5.0,
    CALL: 4.0,
    WHATSAPP: 3.0,
    TELEGRAM: 3.0,
    DISCORD: 2.8,
    SMS: 2.5,
    EMAIL: 2.0,
    LINKEDIN: 1.8,
    INSTAGRAM: 1.5,
    FACEBOOK: 1.3,
    SNAPCHAT: 1.2,
    OTHER: 1.0,
};

// Strength threshold for catch-up list.
// A weekly meaningful call (~4.0 weight) keeps score around 8–12.
export const STRENGTH_THRESHOLD = 10;

// Time decay stepped multipliers
function getTimeDecayMultiplier(daysAgo: number): number {
    if (daysAgo <= 7) return 1.0;
    if (daysAgo <= 30) return 0.7;
    if (daysAgo <= 90) return 0.4;
    if (daysAgo <= 180) return 0.2;
    if (daysAgo <= 365) return 0.1;
    return 0.05; // > 365 days
}

/**
 * Calculates the score for a single interaction based on platform and recency.
 */
export function calculateInteractionScore(
    platform: Platform,
    date: Date
): number {
    const weight = PLATFORM_WEIGHTS[platform] ?? 1.0;

    const now = new Date();
    const diffTime = Math.max(0, now.getTime() - date.getTime());
    const daysAgo = diffTime / (1000 * 60 * 60 * 24);

    const decay = getTimeDecayMultiplier(daysAgo);

    return weight * decay;
}

/**
 * Computes the timeKnownModifier based on monthsKnown.
 * Long-term relationships are more stable; new relationships weaken faster.
 * Clamped between 1.0 and 1.8.
 */
function getTimeKnownModifier(monthsKnown: number): number {
    const modifier = 1 + Math.log(1 + monthsKnown) / 5;
    return Math.min(1.8, Math.max(1, modifier));
}

const MS_PER_DAY = 1000 * 60 * 60 * 24;

/**
 * Generates virtual interaction dates for the last 365 days based on
 * estimated frequency settings. Returns dates in descending order (newest first).
 */
function generateVirtualDates(
    count: number,
    cadence: string,
    now: Date,
): Date[] {
    if (count <= 0) return [];

    let intervalDays: number;
    switch (cadence) {
        case "DAILY":    intervalDays = 1 / count; break;
        case "WEEKLY":   intervalDays = 7 / count; break;
        case "BIWEEKLY": intervalDays = 14 / count; break;
        case "MONTHLY":  intervalDays = 30 / count; break;
        default:         intervalDays = 7 / count; break;
    }

    const dates: Date[] = [];
    const oneYearMs = 365 * MS_PER_DAY;

    for (let offset = intervalDays; offset * MS_PER_DAY <= oneYearMs; offset += intervalDays) {
        dates.push(new Date(now.getTime() - offset * MS_PER_DAY));
    }

    return dates;
}

/**
 * Checks if a virtual date is "covered" by a real interaction within ±1 day.
 */
function isDateCoveredByReal(
    virtualDate: Date,
    realDatesMs: number[],
): boolean {
    const vMs = virtualDate.getTime();
    const threshold = MS_PER_DAY;
    for (const rMs of realDatesMs) {
        if (Math.abs(vMs - rMs) <= threshold) return true;
    }
    return false;
}

/**
 * Recalculates and updates the strengthScore for a given contact.
 * It sums up weighted interaction scores from the last 365 days
 * and applies the timeKnownModifier based on monthsKnown.
 *
 * When estimatedFrequency fields are set, virtual interactions are generated
 * and scored. Real interactions within ±1 day of a virtual one replace it
 * (no double-counting).
 *
 * Clamped between 0 and 100.
 */
export async function recalculateContactScore(
    contactId: string,
    tx?: any
) {
    const db = tx || prisma;

    const now = new Date();
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(now.getFullYear() - 1);

    const contact = await db.contact.findUnique({
        where: { id: contactId },
        select: {
            monthsKnown: true,
            estimatedFrequencyCount: true,
            estimatedFrequencyCadence: true,
            estimatedFrequencyPlatform: true,
        },
    });

    if (!contact) return;

    const interactions = await db.interaction.findMany({
        where: {
            contacts: { some: { id: contactId } },
            date: { gte: oneYearAgo },
        },
        select: { platform: true, date: true },
    });

    let rawScore = 0;
    for (const interaction of interactions) {
        rawScore += calculateInteractionScore(interaction.platform, interaction.date);
    }

    // Add virtual interaction score from estimated frequency
    if (
        contact.estimatedFrequencyCount &&
        contact.estimatedFrequencyCadence &&
        contact.estimatedFrequencyPlatform
    ) {
        const virtualDates = generateVirtualDates(
            contact.estimatedFrequencyCount,
            contact.estimatedFrequencyCadence,
            now,
        );

        const realDatesMs = interactions.map(
            (i: { date: Date }) => i.date.getTime(),
        );

        for (const vDate of virtualDates) {
            if (!isDateCoveredByReal(vDate, realDatesMs)) {
                rawScore += calculateInteractionScore(
                    contact.estimatedFrequencyPlatform,
                    vDate,
                );
            }
        }
    }

    const modifier = getTimeKnownModifier(contact.monthsKnown || 0);
    let finalScore = rawScore * modifier;

    finalScore = Math.min(100, Math.max(0, finalScore));

    await db.contact.update({
        where: { id: contactId },
        data: { strengthScore: finalScore },
    });
}
