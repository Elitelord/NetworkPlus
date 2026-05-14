"use client";

import { useEffect, useMemo, useState } from "react";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
    TrendsData, StatCard, HealthScoreGauge, EmptyHint, Heatmap,
    WeeklyActivityChart, PlatformMixChart, StrengthDistChart,
    CategoryBreakdownChart, RecencyChart, GrowthChart,
    PlatformTimelineChart, CategoryTrendChart, TopContactsList,
    formatWeekLabel,
} from "./components";

type Range = "30d" | "90d" | "1y" | "all";

function formatDelta(curr: number, prev: number): { label: string; positive: boolean | null } {
    if (prev === 0 && curr === 0) return { label: "no change", positive: null };
    if (prev === 0) return { label: "new activity", positive: true };
    const pct = Math.round(((curr - prev) / prev) * 100);
    if (pct === 0) return { label: "no change", positive: null };
    return { label: `${pct > 0 ? "+" : ""}${pct}% vs. last week`, positive: pct > 0 };
}

export default function TrendsPage() {
    const [data, setData] = useState<TrendsData | null>(null);
    const [range, setRange] = useState<Range>("90d");
    const [compare, setCompare] = useState(false);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;
        setLoading(true);
        setError(null);
        const params = new URLSearchParams({ range });
        if (compare && range !== "all") params.set("compare", "true");
        fetch(`/api/trends?${params}`, { credentials: "include" })
            .then(async (res) => {
                if (!res.ok) throw new Error(`Request failed (${res.status})`);
                return res.json();
            })
            .then((json: TrendsData) => { if (!cancelled) setData(json); })
            .catch((err) => { if (!cancelled) setError(String(err)); })
            .finally(() => { if (!cancelled) setLoading(false); });
        return () => { cancelled = true; };
    }, [range, compare]);

    const weeklyDelta = useMemo(() => {
        if (!data) return { label: "", positive: null as boolean | null };
        return formatDelta(data.overview.weeklyTouches, data.overview.prevWeeklyTouches);
    }, [data]);

    const maxHeat = useMemo(() => {
        if (!data) return 0;
        let m = 0;
        for (const row of data.communication.heatmap) for (const v of row) if (v > m) m = v;
        return m;
    }, [data]);

    const sparkData = useMemo(() => {
        if (!data?.communication.timeline) return [];
        return data.communication.timeline.slice(-8).map((t) => t.count);
    }, [data]);

    const prev = data?.previous;

    return (
        <div className="container mx-auto max-w-screen-xl px-4 sm:px-6 py-6 sm:py-10 overflow-y-auto">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 mb-6">
                <div>
                    <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Trends</h1>
                    <p className="text-sm text-muted-foreground mt-1">
                        A read-only mirror of how your network is evolving.
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <div className="flex gap-1 rounded-md border p-1 bg-card w-fit">
                        {(["30d", "90d", "1y", "all"] as Range[]).map((r) => (
                            <Button key={r} variant={range === r ? "default" : "ghost"} size="sm"
                                onClick={() => setRange(r)} className="h-7 px-3 text-xs">
                                {r === "all" ? "All time" : r}
                            </Button>
                        ))}
                    </div>
                    {range !== "all" && (
                        <Button variant={compare ? "default" : "outline"} size="sm"
                            onClick={() => setCompare(!compare)} className="h-7 px-3 text-xs">
                            {compare ? "Comparing" : "Compare"}
                        </Button>
                    )}
                </div>
            </div>

            {error && (
                <div className="mb-4 p-3 rounded-md border border-destructive/30 bg-destructive/10 text-sm text-destructive">
                    {error}
                </div>
            )}

            {loading && !data && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                    {Array.from({ length: 4 }).map((_, i) => (
                        <div key={i} className="h-24 rounded-xl bg-muted/50 animate-pulse" />
                    ))}
                </div>
            )}

            {data && (
                <>
                    {/* Health Score */}
                    <section className="grid grid-cols-1 lg:grid-cols-4 gap-3 sm:gap-4 mb-8 animate-chart-enter">
                        <HealthScoreGauge score={data.healthScore} prev={prev?.healthScore} />
                    </section>

                    {/* Overview strip */}
                    <section className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-8 animate-chart-enter" style={{ animationDelay: "0.05s" }}>
                        <StatCard label="Active (30d)" value={data.overview.activeLast30d}
                            sub={`of ${data.overview.totalContacts} contacts`}
                            sparkData={sparkData}
                            prevValue={prev?.overview.activeLast30d} />
                        <StatCard label="Avg strength" value={data.overview.avgStrength}
                            sub="out of 100"
                            prevValue={prev?.overview.avgStrength} />
                        <StatCard label="At risk" value={data.overview.atRiskCount}
                            sub="no contact 90d+"
                            tone={data.overview.atRiskCount > 0 ? "warn" : undefined}
                            prevValue={prev?.overview.atRiskCount} />
                        <StatCard label="This week" value={data.overview.weeklyTouches}
                            sub={weeklyDelta.label}
                            tone={weeklyDelta.positive === true ? "good" : weeklyDelta.positive === false ? "warn" : undefined}
                            streak={data.streak}
                            sparkData={sparkData}
                            prevValue={prev?.overview.weeklyTouches} />
                    </section>

                    {/* Interaction Velocity */}
                    <section className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-8 animate-chart-enter" style={{ animationDelay: "0.1s" }}>
                        <StatCard label="Avg. days between interactions"
                            value={data.interactionVelocity.avgDaysBetween || "—"}
                            sub={data.interactionVelocity.prevAvgDaysBetween
                                ? `was ${data.interactionVelocity.prevAvgDaysBetween}d in first half`
                                : "not enough data"}
                            tone={data.interactionVelocity.avgDaysBetween > 0 && data.interactionVelocity.prevAvgDaysBetween > 0
                                ? data.interactionVelocity.avgDaysBetween < data.interactionVelocity.prevAvgDaysBetween ? "good" : "warn"
                                : undefined}
                        />
                    </section>

                    {/* Communication */}
                    <section className="mb-8 animate-chart-enter" style={{ animationDelay: "0.15s" }}>
                        <h2 className="text-lg font-semibold mb-3">Communication patterns</h2>
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                            <Card>
                                <CardHeader>
                                    <CardTitle className="text-base">Platform mix</CardTitle>
                                    <CardDescription>Interactions by platform in the selected range.</CardDescription>
                                </CardHeader>
                                <CardContent>
                                    {data.communication.platformMix.length === 0
                                        ? <EmptyHint cta={{ label: "Log an interaction →", href: "/dashboard" }}>No interactions logged in this range yet.</EmptyHint>
                                        : <PlatformMixChart data={data.communication.platformMix} />}
                                </CardContent>
                            </Card>

                            <Card>
                                <CardHeader>
                                    <CardTitle className="text-base">When you reach out</CardTitle>
                                    <CardDescription>Activity by day of week × hour.</CardDescription>
                                </CardHeader>
                                <CardContent>
                                    {maxHeat === 0
                                        ? <EmptyHint>No interactions to chart yet.</EmptyHint>
                                        : <Heatmap heatmap={data.communication.heatmap} />}
                                </CardContent>
                            </Card>

                            <Card className="lg:col-span-2">
                                <CardHeader>
                                    <CardTitle className="text-base">Weekly activity</CardTitle>
                                    <CardDescription>Interactions logged per week over the selected range.</CardDescription>
                                </CardHeader>
                                <CardContent>
                                    {data.communication.timeline.length === 0
                                        ? <EmptyHint>No activity yet.</EmptyHint>
                                        : <WeeklyActivityChart data={data.communication.timeline} prevData={prev?.communication.timeline} />}
                                </CardContent>
                            </Card>

                            <Card className="lg:col-span-2">
                                <CardHeader>
                                    <CardTitle className="text-base">Platform trend</CardTitle>
                                    <CardDescription>How your platform usage has shifted over time.</CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <PlatformTimelineChart data={data.platformTimeline} />
                                </CardContent>
                            </Card>
                        </div>
                    </section>

                    {/* Portfolio */}
                    <section className="mb-8 animate-chart-enter" style={{ animationDelay: "0.2s" }}>
                        <h2 className="text-lg font-semibold mb-3">Relationship portfolio</h2>
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                            <Card>
                                <CardHeader>
                                    <CardTitle className="text-base">Strength distribution</CardTitle>
                                    <CardDescription>How many contacts sit at each strength score (0–100).</CardDescription>
                                </CardHeader>
                                <CardContent>
                                    {data.portfolio.strengthBuckets.every((v) => v === 0)
                                        ? <EmptyHint>No contacts yet.</EmptyHint>
                                        : <StrengthDistChart data={data.portfolio.strengthBuckets} />}
                                </CardContent>
                            </Card>

                            <Card>
                                <CardHeader>
                                    <CardTitle className="text-base">By category</CardTitle>
                                    <CardDescription>Count per relationship category.</CardDescription>
                                </CardHeader>
                                <CardContent>
                                    {data.portfolio.categoryBreakdown.length === 0
                                        ? <EmptyHint>No contacts yet.</EmptyHint>
                                        : <CategoryBreakdownChart data={data.portfolio.categoryBreakdown} />}
                                </CardContent>
                            </Card>

                            <Card>
                                <CardHeader>
                                    <CardTitle className="text-base">Recency</CardTitle>
                                    <CardDescription>When you last talked to each contact.</CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <RecencyChart recency={data.portfolio.recency} />
                                </CardContent>
                            </Card>

                            <Card>
                                <CardHeader>
                                    <CardTitle className="text-base">Top groups</CardTitle>
                                    <CardDescription>Your largest groups by contact count.</CardDescription>
                                </CardHeader>
                                <CardContent>
                                    {data.portfolio.groups.length === 0
                                        ? <EmptyHint>Tag contacts with groups to see them here.</EmptyHint>
                                        : (
                                            <ul className={cn("flex flex-col gap-2 text-xs",
                                                data.portfolio.groups.length > 5 && "max-h-[170px] overflow-y-auto pr-1"
                                            )}>
                                                {data.portfolio.groups.map((g) => (
                                                    <li key={g.name} className="flex items-center justify-between gap-2">
                                                        <span className="truncate font-medium">{g.name}</span>
                                                        <div className="flex items-center gap-2 shrink-0">
                                                            <Badge variant="secondary" className="tabular-nums">{g.count}</Badge>
                                                            <span className="text-muted-foreground tabular-nums">{g.avgStrength} avg</span>
                                                        </div>
                                                    </li>
                                                ))}
                                            </ul>
                                        )}
                                </CardContent>
                            </Card>

                            <Card>
                                <CardHeader>
                                    <CardTitle className="text-base">Strongest contacts</CardTitle>
                                    <CardDescription>Your top relationships by strength score.</CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <TopContactsList contacts={data.topContacts.strongest} type="strongest" />
                                </CardContent>
                            </Card>

                            <Card>
                                <CardHeader>
                                    <CardTitle className="text-base">Needs attention</CardTitle>
                                    <CardDescription>Active contacts with the lowest strength — reach out!</CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <TopContactsList contacts={data.topContacts.weakest} type="weakest" />
                                </CardContent>
                            </Card>

                            <Card className="lg:col-span-2">
                                <CardHeader>
                                    <CardTitle className="text-base">Network growth</CardTitle>
                                    <CardDescription>Cumulative contacts over time. Flat stretches = growth plateaus.</CardDescription>
                                </CardHeader>
                                <CardContent>
                                    {data.portfolio.growth.length === 0
                                        ? <EmptyHint>No contacts yet.</EmptyHint>
                                        : <GrowthChart data={data.portfolio.growth} prevData={prev?.portfolio.growth} />}
                                </CardContent>
                            </Card>

                            <Card className="lg:col-span-2">
                                <CardHeader>
                                    <CardTitle className="text-base">Category strength trend</CardTitle>
                                    <CardDescription>Average strength per category over time.</CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <CategoryTrendChart data={data.categoryTrend} />
                                </CardContent>
                            </Card>
                        </div>
                    </section>
                </>
            )}
        </div>
    );
}
