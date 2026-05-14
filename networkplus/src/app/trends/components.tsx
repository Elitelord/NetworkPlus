"use client";

import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChartContainer, ChartTooltip, CHART_COLORS, chartColorPalette } from "@/components/ui/chart";
import Link from "next/link";
import {
    AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
    RadialBarChart, RadialBar, PolarAngleAxis, Cell,
    LineChart as RLineChart, Line, Legend,
    ResponsiveContainer, Tooltip,
} from "recharts";

/* ─── Types ────────────────────────────────────────────────────────────── */

export type TrendsData = {
    range: string;
    overview: {
        totalContacts: number; activeLast30d: number; avgStrength: number;
        atRiskCount: number; atRiskWeighted: number;
        weeklyTouches: number; prevWeeklyTouches: number;
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
    previous?: TrendsData;
};

/* ─── Helpers ──────────────────────────────────────────────────────────── */

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const PLATFORM_COLORS: Record<string, string> = {
    CALL: "#3b82f6", IN_PERSON: "#22c55e", EMAIL: "#f97316", DISCORD: "#6366f1",
    WHATSAPP: "#10b981", SMS: "#14b8a6", LINKEDIN: "#0ea5e9", INSTAGRAM: "#ec4899",
    TELEGRAM: "#06b6d4", FACEBOOK: "#1d4ed8", SNAPCHAT: "#eab308", OTHER: "#6b7280",
};

const CATEGORY_COLORS: Record<string, string> = {
    FRIEND: "#10b981", FAMILY: "#f43f5e", WORK: "#3b82f6", MUTUAL: "#8b5cf6", OTHER: "#6b7280",
};

export function formatWeekLabel(iso: string) {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return iso;
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function formatMonthLabel(m: string) {
    const [yStr, moStr] = m.split("-");
    const y = parseInt(yStr, 10);
    const mo = parseInt(moStr, 10);
    if (!Number.isFinite(y) || !Number.isFinite(mo)) return m;
    return new Date(y, mo - 1, 1).toLocaleDateString(undefined, { month: "short", year: "2-digit" });
}

function formatDelta(curr: number, prev: number): { label: string; positive: boolean | null } {
    if (prev === 0 && curr === 0) return { label: "no change", positive: null };
    if (prev === 0) return { label: "new activity", positive: true };
    const pct = Math.round(((curr - prev) / prev) * 100);
    if (pct === 0) return { label: "no change", positive: null };
    return { label: `${pct > 0 ? "+" : ""}${pct}% vs. last week`, positive: pct > 0 };
}

/* ─── Empty State ──────────────────────────────────────────────────────── */

export function EmptyHint({ children, cta }: { children: React.ReactNode; cta?: { label: string; href: string } }) {
    return (
        <div className="flex flex-col items-center justify-center py-6 gap-2 text-center">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-muted-foreground/40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
            </svg>
            <p className="text-xs text-muted-foreground">{children}</p>
            {cta && (
                <Link href={cta.href}>
                    <Button variant="outline" size="sm" className="text-xs h-7 mt-1">{cta.label}</Button>
                </Link>
            )}
        </div>
    );
}

/* ─── Stat Card ────────────────────────────────────────────────────────── */

export function StatCard({ label, value, sub, tone, sparkData, streak, prevValue }: {
    label: string; value: number | string; sub?: string;
    tone?: "good" | "warn";
    sparkData?: number[];
    streak?: number;
    prevValue?: number | string;
}) {
    return (
        <Card className="relative overflow-hidden">
            <CardHeader className="pb-2">
                <CardDescription className="text-xs">{label}</CardDescription>
                <div className="flex items-baseline gap-2">
                    <CardTitle className={cn("text-2xl sm:text-3xl tabular-nums",
                        tone === "good" && "text-emerald-600 dark:text-emerald-400",
                        tone === "warn" && "text-amber-600 dark:text-amber-400",
                    )}>
                        {value}
                    </CardTitle>
                    {streak !== undefined && streak > 0 && (
                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                            🔥 {streak}w streak
                        </Badge>
                    )}
                </div>
            </CardHeader>
            <CardContent className="pt-0">
                <div className="flex items-end justify-between gap-2">
                    <div>
                        {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
                        {prevValue !== undefined && (
                            <p className="text-[10px] text-muted-foreground/70 mt-0.5">prev: {prevValue}</p>
                        )}
                    </div>
                    {sparkData && sparkData.length > 1 && (
                        <MiniSparkline data={sparkData} />
                    )}
                </div>
            </CardContent>
        </Card>
    );
}

function MiniSparkline({ data }: { data: number[] }) {
    const max = Math.max(...data, 1);
    const w = 60; const h = 24;
    const points = data.map((v, i) => {
        const x = (i / (data.length - 1)) * w;
        const y = h - (v / max) * (h - 2) - 1;
        return `${x},${y}`;
    }).join(" ");
    return (
        <svg width={w} height={h} className="shrink-0 opacity-60">
            <polyline points={points} fill="none" stroke="var(--primary)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
        </svg>
    );
}

/* ─── Health Score Gauge ───────────────────────────────────────────────── */

export function HealthScoreGauge({ score, prev }: { score: number; prev?: number }) {
    const color = score >= 70 ? "#22c55e" : score >= 40 ? "#eab308" : "#ef4444";
    const data = [{ value: score, fill: color }];
    return (
        <Card className="lg:col-span-4">
            <CardHeader className="pb-0">
                <CardTitle className="text-base">Network Health Score</CardTitle>
                <CardDescription>
                    Composite score from activity, strength, streak, and at-risk ratio.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <div className="flex flex-col sm:flex-row items-center gap-4">
                    <div className="w-[160px] h-[160px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <RadialBarChart cx="50%" cy="50%" innerRadius="70%" outerRadius="100%" data={data} startAngle={90} endAngle={-270} barSize={14}>
                                <PolarAngleAxis type="number" domain={[0, 100]} angleAxisId={0} tick={false} />
                                <RadialBar background={{ fill: "var(--muted)" }} dataKey="value" angleAxisId={0} cornerRadius={8} />
                            </RadialBarChart>
                        </ResponsiveContainer>
                    </div>
                    <div className="flex flex-col items-center sm:items-start gap-1">
                        <span className="text-4xl font-bold tabular-nums" style={{ color }}>{score}</span>
                        <span className="text-xs text-muted-foreground">out of 100</span>
                        {prev !== undefined && (
                            <span className="text-xs text-muted-foreground/70">prev period: {prev}</span>
                        )}
                        <span className="text-xs mt-1" style={{ color }}>
                            {score >= 70 ? "Healthy — keep it up!" : score >= 40 ? "Needs attention" : "At risk — reach out!"}
                        </span>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}

/* ─── Heatmap ──────────────────────────────────────────────────────────── */

export function Heatmap({ heatmap }: { heatmap: number[][] }) {
    const max = Math.max(...heatmap.flat(), 1);
    const CELL = 14; const GAP = 2;
    return (
        <div className="overflow-x-auto">
            <div className="flex items-start gap-2 w-fit">
                <div className="flex flex-col" style={{ gap: `${GAP}px` }}>
                    {DAY_LABELS.map((d) => (
                        <div key={d} className="text-[10px] text-muted-foreground text-right pr-1 flex items-center justify-end" style={{ height: CELL }}>{d}</div>
                    ))}
                </div>
                <div>
                    <div className="grid" style={{ gap: `${GAP}px`, gridTemplateColumns: `repeat(24, ${CELL}px)`, gridTemplateRows: `repeat(7, ${CELL}px)` }}>
                        {heatmap.flatMap((row, d) =>
                            row.map((v, h) => {
                                const intensity = max > 0 ? v / max : 0;
                                return (
                                    <div key={`${d}-${h}`} title={`${DAY_LABELS[d]} ${h}:00 — ${v}`}
                                        className="rounded-[2px] transition-colors"
                                        style={{
                                            width: CELL, height: CELL,
                                            backgroundColor: v === 0 ? "var(--muted)"
                                                : `color-mix(in oklch, var(--chart-1) ${Math.max(15, intensity * 100)}%, transparent)`,
                                        }}
                                    />
                                );
                            })
                        )}
                    </div>
                    <div className="grid mt-1 text-[10px] text-muted-foreground" style={{ gap: `${GAP}px`, gridTemplateColumns: `repeat(24, ${CELL}px)` }}>
                        {Array.from({ length: 24 }).map((_, h) => (
                            <span key={h} className="text-center">{h % 6 === 0 ? h : ""}</span>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}

/* ─── Recharts-based Charts ────────────────────────────────────────────── */

export function WeeklyActivityChart({ data, prevData }: { data: { week: string; count: number }[]; prevData?: { week: string; count: number }[] }) {
    const chartData = data.map((d, i) => ({
        label: formatWeekLabel(d.week),
        count: d.count,
        prev: prevData?.[i]?.count,
    }));
    return (
        <ChartContainer height={140}>
            <AreaChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                <defs>
                    <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.3} />
                        <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0.02} />
                    </linearGradient>
                    <linearGradient id="areaGradPrev" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="var(--muted-foreground)" stopOpacity={0.15} />
                        <stop offset="100%" stopColor="var(--muted-foreground)" stopOpacity={0.02} />
                    </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                <YAxis tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} tickLine={false} axisLine={false} width={28} />
                <ChartTooltip />
                {prevData && <Area type="monotone" dataKey="prev" name="Previous" stroke="var(--muted-foreground)" strokeDasharray="4 4" strokeWidth={1.5} fill="url(#areaGradPrev)" />}
                <Area type="monotone" dataKey="count" name="Interactions" stroke="var(--chart-1)" strokeWidth={2} fill="url(#areaGrad)" />
            </AreaChart>
        </ChartContainer>
    );
}

export function PlatformMixChart({ data }: { data: { platform: string; count: number; weighted: number }[] }) {
    return (
        <ChartContainer height={Math.max(120, data.length * 32)}>
            <BarChart data={data} layout="vertical" margin={{ top: 0, right: 8, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} tickLine={false} axisLine={false} />
                <YAxis type="category" dataKey="platform" tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} tickLine={false} axisLine={false} width={80}
                    tickFormatter={(v: string) => v.replace("_", " ")} />
                <ChartTooltip />
                <Bar dataKey="count" name="Count" radius={[0, 4, 4, 0]}>
                    {data.map((entry) => (
                        <Cell key={entry.platform} fill={PLATFORM_COLORS[entry.platform] || "#6b7280"} />
                    ))}
                </Bar>
            </BarChart>
        </ChartContainer>
    );
}

export function StrengthDistChart({ data }: { data: number[] }) {
    const chartData = data.map((v, i) => ({ range: `${i * 10}`, count: v }));
    return (
        <ChartContainer height={160}>
            <BarChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal vertical={false} />
                <XAxis dataKey="range" tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} tickLine={false} axisLine={false} width={28} allowDecimals={false} />
                <ChartTooltip />
                <Bar dataKey="count" name="Contacts" fill="var(--chart-1)" radius={[4, 4, 0, 0]} />
            </BarChart>
        </ChartContainer>
    );
}

export function CategoryBreakdownChart({ data }: { data: { category: string; count: number; avgStrength: number }[] }) {
    const sorted = [...data].sort((a, b) => b.count - a.count);
    return (
        <ChartContainer height={Math.max(100, sorted.length * 36)}>
            <BarChart data={sorted} layout="vertical" margin={{ top: 0, right: 8, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} tickLine={false} axisLine={false} />
                <YAxis type="category" dataKey="category" tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} tickLine={false} axisLine={false} width={65} />
                <ChartTooltip />
                <Bar dataKey="count" name="Count" radius={[0, 4, 4, 0]}>
                    {sorted.map((entry) => (
                        <Cell key={entry.category} fill={CATEGORY_COLORS[entry.category] || "#6b7280"} />
                    ))}
                </Bar>
            </BarChart>
        </ChartContainer>
    );
}

export function RecencyChart({ recency }: { recency: { lt7: number; lt30: number; lt90: number; lt180: number; dormant: number; never: number } }) {
    const segments = [
        { name: "<7d", value: recency.lt7, fill: "#22c55e" },
        { name: "<30d", value: recency.lt30, fill: "#84cc16" },
        { name: "<90d", value: recency.lt90, fill: "#eab308" },
        { name: "<180d", value: recency.lt180, fill: "#f97316" },
        { name: "180d+", value: recency.dormant, fill: "#ef4444" },
        { name: "Never", value: recency.never, fill: "#71717a" },
    ].filter((s) => s.value > 0);
    const total = segments.reduce((s, x) => s + x.value, 0);
    if (total === 0) return <EmptyHint>No contacts yet.</EmptyHint>;
    return (
        <div className="flex flex-col gap-3">
            <div className="flex h-4 rounded-full overflow-hidden">
                {segments.map((s) => (
                    <div key={s.name} title={`${s.name}: ${s.value}`} style={{ width: `${(s.value / total) * 100}%`, backgroundColor: s.fill }} />
                ))}
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-1 text-xs">
                {segments.map((s) => (
                    <div key={s.name} className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: s.fill }} />
                        <span className="text-muted-foreground">{s.name}</span>
                        <span className="ml-auto tabular-nums">{s.value}</span>
                    </div>
                ))}
            </div>
        </div>
    );
}

export function GrowthChart({ data, prevData }: { data: { month: string; added: number; cumulative: number }[]; prevData?: { month: string; added: number; cumulative: number }[] }) {
    const chartData = data.map((g, i) => ({
        label: formatMonthLabel(g.month),
        cumulative: g.cumulative,
        added: g.added,
        prev: prevData?.[i]?.cumulative,
    }));
    return (
        <ChartContainer height={140}>
            <AreaChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                <defs>
                    <linearGradient id="growthGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#22c55e" stopOpacity={0.3} />
                        <stop offset="100%" stopColor="#22c55e" stopOpacity={0.02} />
                    </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                <YAxis tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} tickLine={false} axisLine={false} width={32} />
                <ChartTooltip />
                <Area type="monotone" dataKey="cumulative" name="Total" stroke="#22c55e" strokeWidth={2} fill="url(#growthGrad)" />
            </AreaChart>
        </ChartContainer>
    );
}

export function PlatformTimelineChart({ data }: { data: Record<string, string | number>[] }) {
    if (data.length === 0) return <EmptyHint>No data yet.</EmptyHint>;
    const platforms = Object.keys(data[0]).filter((k) => k !== "month");
    const chartData = data.map((d) => ({ ...d, label: formatMonthLabel(d.month as string) }));
    return (
        <ChartContainer height={180}>
            <AreaChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                <YAxis tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} tickLine={false} axisLine={false} width={28} />
                <ChartTooltip />
                {platforms.map((p, i) => (
                    <Area key={p} type="monotone" dataKey={p} name={p.replace("_", " ")} stackId="1"
                        stroke={PLATFORM_COLORS[p] || chartColorPalette(platforms.length)[i]}
                        fill={PLATFORM_COLORS[p] || chartColorPalette(platforms.length)[i]}
                        fillOpacity={0.6} />
                ))}
            </AreaChart>
        </ChartContainer>
    );
}

export function CategoryTrendChart({ data }: { data: Record<string, string | number>[] }) {
    if (data.length === 0) return <EmptyHint>No data yet.</EmptyHint>;
    const categories = Object.keys(data[0]).filter((k) => k !== "month");
    const chartData = data.map((d) => ({ ...d, label: formatMonthLabel(d.month as string) }));
    return (
        <ChartContainer height={180}>
            <RLineChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                <YAxis tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} tickLine={false} axisLine={false} width={28} />
                <ChartTooltip />
                {categories.map((c) => (
                    <Line key={c} type="monotone" dataKey={c} name={c} dot={false}
                        stroke={CATEGORY_COLORS[c] || "#6b7280"} strokeWidth={2} />
                ))}
            </RLineChart>
        </ChartContainer>
    );
}

export function TopContactsList({ contacts, type }: {
    contacts: { id: string; name: string; strengthScore: number; category: string }[];
    type: "strongest" | "weakest";
}) {
    if (contacts.length === 0) return <EmptyHint>No contacts yet.</EmptyHint>;
    const maxScore = Math.max(...contacts.map((c) => c.strengthScore), 1);
    return (
        <ul className="flex flex-col gap-2">
            {contacts.map((c) => (
                <li key={c.id}>
                    <Link href={`/dashboard?contact=${c.id}`} className="flex items-center gap-3 text-xs group hover:bg-muted/50 rounded-md px-2 py-1.5 -mx-2 transition-colors">
                        <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: CATEGORY_COLORS[c.category] || "#6b7280" }} />
                        <span className="truncate font-medium group-hover:text-foreground">{c.name}</span>
                        <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden ml-auto max-w-[80px]">
                            <div className="h-full rounded-full transition-all" style={{
                                width: `${(c.strengthScore / maxScore) * 100}%`,
                                backgroundColor: type === "strongest" ? "#22c55e" : "#f97316",
                            }} />
                        </div>
                        <span className="tabular-nums text-muted-foreground w-8 text-right">{c.strengthScore}</span>
                    </Link>
                </li>
            ))}
        </ul>
    );
}
