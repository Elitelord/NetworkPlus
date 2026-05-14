import { NextResponse } from "next/server";
import { type Session } from "next-auth";
import { auth } from "@/auth";
import prisma from "@lib/prisma";
import { Platform, Category } from "@prisma/client";
import { apiError } from "@/lib/api-utils";

// Mirrors strength-scoring.ts so trend numbers match the rest of the app.
const PLATFORM_WEIGHTS: Record<Platform, number> = {
    IN_PERSON: 4.5,
    CALL: 3.5,
    WHATSAPP: 2.5,
    TELEGRAM: 2.5,
    DISCORD: 2.3,
    SMS: 2.0,
    EMAIL: 1.5,
    LINKEDIN: 1.3,
    INSTAGRAM: 1.0,
    FACEBOOK: 0.8,
    SNAPCHAT: 0.7,
    OTHER: 0.5,
};

type Range = "30d" | "90d" | "1y" | "all";

function rangeToDays(range: Range): number | null {
    if (range === "30d") return 30;
    if (range === "90d") return 90;
    if (range === "1y") return 365;
    return null; // "all"
}

function rangeToSince(range: Range): Date | null {
    const days = rangeToDays(range);
    if (days === null) return null;
    return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

function daysSince(date: Date | null | undefined): number {
    if (!date) return 9999;
    return Math.max(0, Math.floor((Date.now() - date.getTime()) / (24 * 60 * 60 * 1000)));
}

// ── Core computation shared between main and comparison periods ──────

type PeriodResult = {
    overview: {
        totalContacts: number;
        activeLast30d: number;
        avgStrength: number;
        atRiskCount: number;
        atRiskWeighted: number;
        weeklyTouches: number;
        prevWeeklyTouches: number;
    };
    communication: {
        platformMix: { platform: string; count: number; weighted: number }[];
        heatmap: number[][];
        timeline: { week: string; count: number }[];
    };
    portfolio: {
        strengthBuckets: number[];
        categoryBreakdown: { category: string; count: number; avgStrength: number }[];
        groups: { name: string; count: number; avgStrength: number }[];
        recency: { lt7: number; lt30: number; lt90: number; lt180: number; dormant: number; never: number };
        growth: { month: string; added: number; cumulative: number }[];
    };
    streak: number;
    topContacts: {
        strongest: { id: string; name: string; strengthScore: number; category: string; lastInteractionAt: string | null }[];
        weakest: { id: string; name: string; strengthScore: number; category: string; lastInteractionAt: string | null }[];
    };
    interactionVelocity: { avgDaysBetween: number; prevAvgDaysBetween: number };
    platformTimeline: Record<string, string | number>[];
    categoryTrend: Record<string, string | number>[];
    healthScore: number;
};

function computePeriod(
    contacts: {
        id: string;
        name: string;
        category: Category;
        groups: string[];
        strengthScore: number;
        lastInteractionAt: Date | null;
        createdAt: Date;
    }[],
    interactions: { id: string; platform: Platform; date: Date }[],
    recentInteractions: { date: Date }[],
    now: number,
): PeriodResult {
    const day = 24 * 60 * 60 * 1000;
    const last7Start = new Date(now - 7 * day);
    const prev7Start = new Date(now - 14 * day);
    const prev7End = last7Start;

    const weeklyTouches = recentInteractions.filter((i) => i.date >= last7Start).length;
    const prevWeeklyTouches = recentInteractions.filter(
        (i) => i.date >= prev7Start && i.date < prev7End
    ).length;

    /* ── Overview ──────────────────────────────────────── */
    const totalContacts = contacts.length;
    const activeLast30d = contacts.filter(
        (c) => c.lastInteractionAt && daysSince(c.lastInteractionAt) <= 30
    ).length;
    const avgStrength =
        totalContacts > 0
            ? contacts.reduce((acc, c) => acc + (c.strengthScore || 0), 0) / totalContacts
            : 0;

    const atRiskContacts = contacts.filter((c) => {
        if (!c.lastInteractionAt) return false;
        return daysSince(c.lastInteractionAt) >= 90;
    });
    const atRiskCount = atRiskContacts.length;
    const atRiskWeighted = atRiskContacts.reduce(
        (acc, c) => acc + Math.max(1, c.strengthScore || 0),
        0
    );

    /* ── Communication patterns ───────────────────────── */
    const platformCounts: Record<string, number> = {};
    const platformWeighted: Record<string, number> = {};
    for (const i of interactions) {
        platformCounts[i.platform] = (platformCounts[i.platform] || 0) + 1;
        platformWeighted[i.platform] =
            (platformWeighted[i.platform] || 0) + (PLATFORM_WEIGHTS[i.platform] ?? 1);
    }
    const platformMix = Object.keys(platformCounts)
        .map((p) => ({
            platform: p,
            count: platformCounts[p],
            weighted: Math.round(platformWeighted[p] * 10) / 10,
        }))
        .sort((a, b) => b.count - a.count);

    // Heatmap: 7 days × 24 hours.
    const heatmap: number[][] = Array.from({ length: 7 }, () => Array(24).fill(0));
    for (const i of interactions) {
        const d = new Date(i.date);
        heatmap[d.getDay()][d.getHours()] += 1;
    }

    // Weekly timeline.
    const weekBuckets: Record<string, number> = {};
    for (const i of interactions) {
        const d = new Date(i.date);
        const weekStart = new Date(d);
        weekStart.setHours(0, 0, 0, 0);
        weekStart.setDate(d.getDate() - d.getDay());
        const key = weekStart.toISOString().slice(0, 10);
        weekBuckets[key] = (weekBuckets[key] || 0) + 1;
    }
    const timeline = Object.keys(weekBuckets)
        .sort()
        .map((k) => ({ week: k, count: weekBuckets[k] }));

    /* ── Streak ────────────────────────────────────────── */
    let streak = 0;
    if (timeline.length > 0) {
        const nowDate = new Date(now);
        const currentWeekStart = new Date(nowDate);
        currentWeekStart.setHours(0, 0, 0, 0);
        currentWeekStart.setDate(nowDate.getDate() - nowDate.getDay());

        const weekSet = new Set(Object.keys(weekBuckets));
        let checkDate = new Date(currentWeekStart);
        while (true) {
            const key = checkDate.toISOString().slice(0, 10);
            if (weekSet.has(key)) {
                streak++;
                checkDate.setDate(checkDate.getDate() - 7);
            } else {
                break;
            }
        }
    }

    /* ── Portfolio ────────────────────────────────────── */
    const strengthBuckets = Array(10).fill(0) as number[];
    for (const c of contacts) {
        const s = Math.max(0, Math.min(99, Math.round(c.strengthScore || 0)));
        strengthBuckets[Math.floor(s / 10)] += 1;
    }

    const categoryStats: Record<string, { count: number; totalStrength: number }> = {};
    for (const c of contacts) {
        const k = c.category;
        if (!categoryStats[k]) categoryStats[k] = { count: 0, totalStrength: 0 };
        categoryStats[k].count += 1;
        categoryStats[k].totalStrength += c.strengthScore || 0;
    }
    const categoryBreakdown = (Object.keys(categoryStats) as Category[]).map((k) => ({
        category: k,
        count: categoryStats[k].count,
        avgStrength:
            categoryStats[k].count > 0
                ? Math.round((categoryStats[k].totalStrength / categoryStats[k].count) * 10) / 10
                : 0,
    }));

    // Groups leaderboard.
    const groupStats: Record<string, { count: number; totalStrength: number }> = {};
    for (const c of contacts) {
        for (const g of c.groups || []) {
            if (!g) continue;
            if (!groupStats[g]) groupStats[g] = { count: 0, totalStrength: 0 };
            groupStats[g].count += 1;
            groupStats[g].totalStrength += c.strengthScore || 0;
        }
    }
    const groups = Object.keys(groupStats)
        .map((name) => ({
            name,
            count: groupStats[name].count,
            avgStrength:
                Math.round((groupStats[name].totalStrength / groupStats[name].count) * 10) /
                10,
        }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);

    // Recency buckets.
    const recency = { lt7: 0, lt30: 0, lt90: 0, lt180: 0, dormant: 0, never: 0 };
    for (const c of contacts) {
        if (!c.lastInteractionAt) {
            recency.never += 1;
            continue;
        }
        const d = daysSince(c.lastInteractionAt);
        if (d < 7) recency.lt7 += 1;
        else if (d < 30) recency.lt30 += 1;
        else if (d < 90) recency.lt90 += 1;
        else if (d < 180) recency.lt180 += 1;
        else recency.dormant += 1;
    }

    // Network growth.
    const monthBuckets: Record<string, number> = {};
    for (const c of contacts) {
        const d = new Date(c.createdAt);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        monthBuckets[key] = (monthBuckets[key] || 0) + 1;
    }
    const monthsSorted = Object.keys(monthBuckets).sort();
    let running = 0;
    const growth = monthsSorted.map((m) => {
        running += monthBuckets[m];
        return { month: m, added: monthBuckets[m], cumulative: running };
    });

    /* ── Top contacts ─────────────────────────────────── */
    const sorted = [...contacts].sort((a, b) => b.strengthScore - a.strengthScore);
    const strongest = sorted.slice(0, 5).map((c) => ({
        id: c.id,
        name: c.name,
        strengthScore: Math.round(c.strengthScore * 10) / 10,
        category: c.category,
        lastInteractionAt: c.lastInteractionAt?.toISOString() ?? null,
    }));
    const nonZero = sorted.filter((c) => c.strengthScore > 0);
    const weakest = nonZero
        .slice(-5)
        .reverse()
        .map((c) => ({
            id: c.id,
            name: c.name,
            strengthScore: Math.round(c.strengthScore * 10) / 10,
            category: c.category,
            lastInteractionAt: c.lastInteractionAt?.toISOString() ?? null,
        }));

    /* ── Interaction velocity ─────────────────────────── */
    const sortedDates = interactions
        .map((i) => i.date.getTime())
        .sort((a, b) => a - b);

    let avgDaysBetween = 0;
    if (sortedDates.length >= 2) {
        let totalGap = 0;
        for (let i = 1; i < sortedDates.length; i++) {
            totalGap += sortedDates[i] - sortedDates[i - 1];
        }
        avgDaysBetween = Math.round((totalGap / (sortedDates.length - 1) / day) * 10) / 10;
    }

    // Previous equivalent period for velocity comparison
    const halfIdx = Math.floor(sortedDates.length / 2);
    let prevAvgDaysBetween = 0;
    if (halfIdx >= 2) {
        const firstHalf = sortedDates.slice(0, halfIdx);
        let totalGap = 0;
        for (let i = 1; i < firstHalf.length; i++) {
            totalGap += firstHalf[i] - firstHalf[i - 1];
        }
        prevAvgDaysBetween = Math.round((totalGap / (firstHalf.length - 1) / day) * 10) / 10;
    }

    /* ── Platform timeline ────────────────────────────── */
    const platformMonthMap: Record<string, Record<string, number>> = {};
    for (const i of interactions) {
        const d = new Date(i.date);
        const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        if (!platformMonthMap[monthKey]) platformMonthMap[monthKey] = {};
        platformMonthMap[monthKey][i.platform] = (platformMonthMap[monthKey][i.platform] || 0) + 1;
    }
    const allPlatforms = new Set(interactions.map((i) => i.platform));
    const platformTimeline = Object.keys(platformMonthMap)
        .sort()
        .map((month) => {
            const entry: Record<string, string | number> = { month };
            for (const p of allPlatforms) {
                entry[p] = platformMonthMap[month][p] || 0;
            }
            return entry;
        });

    /* ── Category strength trend ──────────────────────── */
    // Group interactions by month and count per category to approximate engagement trend.
    const catMonthMap: Record<string, Record<string, number>> = {};
    // We need contact category lookup.
    const contactCategoryMap = new Map(contacts.map((c) => [c.id, c.category]));
    // We can't easily map interactions to contacts here without the junction data,
    // so instead we'll provide the category breakdown per-month using contacts' createdAt and strengthScore.
    // Use a simpler approach: for each month, compute the avg strength of contacts created up to that point.
    const allMonths = [...new Set([
        ...Object.keys(monthBuckets),
        ...Object.keys(platformMonthMap),
    ])].sort();

    const categoryTrend: Record<string, string | number>[] = [];
    const allCategories = [...new Set(contacts.map((c) => c.category))];
    for (const month of allMonths) {
        const [yStr, mStr] = month.split("-");
        const endOfMonth = new Date(parseInt(yStr), parseInt(mStr), 0, 23, 59, 59);
        const entry: Record<string, string | number> = { month };
        for (const cat of allCategories) {
            const catContacts = contacts.filter(
                (c) => c.category === cat && c.createdAt <= endOfMonth
            );
            if (catContacts.length > 0) {
                entry[cat] = Math.round(
                    (catContacts.reduce((s, c) => s + c.strengthScore, 0) / catContacts.length) * 10
                ) / 10;
            } else {
                entry[cat] = 0;
            }
        }
        categoryTrend.push(entry);
    }

    /* ── Health score ─────────────────────────────────── */
    const activeRatio = totalContacts > 0 ? activeLast30d / totalContacts : 0;
    const strengthRatio = avgStrength / 100;
    const streakRatio = Math.min(streak / 12, 1);
    const safeRatio = totalContacts > 0 ? 1 - atRiskCount / totalContacts : 1;
    const healthScore = Math.round(
        (activeRatio * 25 + strengthRatio * 25 + streakRatio * 25 + safeRatio * 25)
    );

    return {
        overview: {
            totalContacts,
            activeLast30d,
            avgStrength: Math.round(avgStrength * 10) / 10,
            atRiskCount,
            atRiskWeighted: Math.round(atRiskWeighted),
            weeklyTouches,
            prevWeeklyTouches,
        },
        communication: {
            platformMix,
            heatmap,
            timeline,
        },
        portfolio: {
            strengthBuckets,
            categoryBreakdown,
            groups,
            recency,
            growth,
        },
        streak,
        topContacts: { strongest, weakest },
        interactionVelocity: { avgDaysBetween, prevAvgDaysBetween },
        platformTimeline,
        categoryTrend,
        healthScore,
    };
}

export async function GET(req: Request) {
    try {
        const session = (await auth()) as Session | null;
        if (!session?.user?.id) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }
        const ownerId = session.user.id;

        const url = new URL(req.url);
        const rangeParam = (url.searchParams.get("range") || "90d") as Range;
        const range: Range = ["30d", "90d", "1y", "all"].includes(rangeParam) ? rangeParam : "90d";
        const since = rangeToSince(range);
        const compareMode = url.searchParams.get("compare") === "true";

        // Fetch user's contacts (lightweight fields for aggregation).
        const contacts = await prisma.contact.findMany({
            where: { ownerId },
            select: {
                id: true,
                name: true,
                category: true,
                groups: true,
                strengthScore: true,
                lastInteractionAt: true,
                createdAt: true,
            },
        });

        const contactIds = contacts.map((c) => c.id);

        // Interactions in the selected range (for the current user's contacts).
        const interactions = contactIds.length
            ? await prisma.interaction.findMany({
                  where: {
                      contacts: { some: { ownerId } },
                      ...(since ? { date: { gte: since } } : {}),
                  },
                  select: { id: true, platform: true, date: true },
                  orderBy: { date: "asc" },
              })
            : [];

        // Prior-week comparison: touches in last 7d vs. previous 7d (independent of range).
        const now = Date.now();
        const day = 24 * 60 * 60 * 1000;
        const prev7Start = new Date(now - 14 * day);

        const recentInteractions = contactIds.length
            ? await prisma.interaction.findMany({
                  where: {
                      contacts: { some: { ownerId } },
                      date: { gte: prev7Start },
                  },
                  select: { date: true },
              })
            : [];

        const mainResult = computePeriod(contacts, interactions, recentInteractions, now);

        // ── Comparison period ────────────────────────────────
        let previous: PeriodResult | null = null;
        if (compareMode && since) {
            const days = rangeToDays(range);
            if (days !== null) {
                const prevEnd = since;
                const prevStart = new Date(since.getTime() - days * day);

                const prevInteractions = contactIds.length
                    ? await prisma.interaction.findMany({
                          where: {
                              contacts: { some: { ownerId } },
                              date: { gte: prevStart, lt: prevEnd },
                          },
                          select: { id: true, platform: true, date: true },
                          orderBy: { date: "asc" },
                      })
                    : [];

                const prevRecentStart = new Date(prevEnd.getTime() - 14 * day);
                const prevRecentInteractions = contactIds.length
                    ? await prisma.interaction.findMany({
                          where: {
                              contacts: { some: { ownerId } },
                              date: { gte: prevRecentStart, lt: prevEnd },
                          },
                          select: { date: true },
                      })
                    : [];

                previous = computePeriod(
                    contacts,
                    prevInteractions,
                    prevRecentInteractions,
                    prevEnd.getTime()
                );
            }
        }

        return NextResponse.json({
            range,
            ...mainResult,
            ...(previous ? { previous } : {}),
        });
    } catch (err) {
        return apiError(err);
    }
}
