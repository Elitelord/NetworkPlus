import prisma from "@/lib/prisma";
import { Platform } from "../generated/prisma/client";

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
 * Recalculates and updates the strengthScore for a given contact.
 * It sums up weighted interaction scores from the last 365 days 
 * and adds the manualStrengthBias.
 * 
 * Clamped between 0 and 100.
 */
export async function recalculateContactScore(
    contactId: string,
    tx?: any // Optional transaction client
) {
    const db = tx || prisma;

    const now = new Date();
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(now.getFullYear() - 1);

    // Fetch interactions from the last 365 days
    // We fetch a bit more than 365 days if we want to include older ones with low weight, 
    // but requirements said "sum(weighted interaction scores from last 365 days)".
    // However, "365 days: ignore or apply 0.05" implies we might want to check them.
    // "sum(weighted interaction scores from last 365 days)" assumes strictly < 365.
    // I will stick to fetching all interactions to be safe but filtering in query is better for perf.
    // Let's fetch all relevant interactions. Since decay for >365 is 0.05, maybe we should include them?
    // "strengthScore = sum(weighted interaction scores from last 365 days) + manualStrengthBias"
    // This line contradicts "365 days: ignore or apply 0.05". 
    // I will follow the explicit formula: "sum(... from last 365 days)".
    // So I'll filter >= 365 days ago.

    const contact = await db.contact.findUnique({
        where: { id: contactId },
        select: { manualStrengthBias: true },
    });

    if (!contact) return;

    const interactions = await db.interaction.findMany({
        where: {
            contacts: { some: { id: contactId } }, // Ensure this matches schema relation
            date: { gte: oneYearAgo },
        },
        select: { platform: true, date: true },
    });
    console.log(`Found ${interactions.length} interactions for scoring`);

    let rawScore = 0;
    for (const interaction of interactions) {
        rawScore += calculateInteractionScore(interaction.platform, interaction.date);
    }

    // Add manual bias
    let finalScore = rawScore + (contact.manualStrengthBias || 0);

    // Clamp to 0-100
    finalScore = Math.min(100, Math.max(0, finalScore));

    await db.contact.update({
        where: { id: contactId },
        data: { strengthScore: finalScore },
    });
}
