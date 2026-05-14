"use client";

import * as React from "react";
import { ResponsiveContainer, Tooltip as RechartsTooltip } from "recharts";
import { cn } from "@/lib/utils";

/* ─── Chart colour helpers ─────────────────────────────────────────────── */

/** Resolve a CSS variable string like "var(--chart-1)" to its computed value. */
function resolveColor(raw: string): string {
    if (typeof window === "undefined") return raw;
    if (raw.startsWith("var(")) {
        const varName = raw.slice(4, -1).trim();
        return getComputedStyle(document.documentElement).getPropertyValue(varName).trim() || raw;
    }
    return raw;
}

/** Preset chart palette that maps to the app's CSS variables. */
export const CHART_COLORS = {
    chart1: "var(--chart-1)",
    chart2: "var(--chart-2)",
    chart3: "var(--chart-3)",
    chart4: "var(--chart-4)",
    chart5: "var(--chart-5)",
    primary: "var(--primary)",
    muted: "var(--muted)",
    mutedForeground: "var(--muted-foreground)",
    destructive: "var(--destructive)",
} as const;

/** Returns an array of chart palette colours. Useful for mapping data series. */
export function chartColorPalette(count: number): string[] {
    const base = [
        CHART_COLORS.chart1,
        CHART_COLORS.chart2,
        CHART_COLORS.chart3,
        CHART_COLORS.chart4,
        CHART_COLORS.chart5,
    ];
    const result: string[] = [];
    for (let i = 0; i < count; i++) {
        result.push(base[i % base.length]);
    }
    return result;
}

/* ─── ChartContainer ───────────────────────────────────────────────────── */

type ChartContainerProps = {
    children: React.ReactNode;
    height?: number;
    className?: string;
};

/**
 * Wraps Recharts charts in a responsive container with consistent sizing.
 */
export function ChartContainer({ children, height = 200, className }: ChartContainerProps) {
    return (
        <div className={cn("w-full", className)} style={{ height }}>
            <ResponsiveContainer width="100%" height="100%">
                {children as React.ReactElement}
            </ResponsiveContainer>
        </div>
    );
}

/* ─── ChartTooltip ─────────────────────────────────────────────────────── */

type TooltipPayloadEntry = {
    name?: string;
    value?: number;
    color?: string;
    dataKey?: string;
};

type ChartTooltipContentProps = {
    active?: boolean;
    payload?: TooltipPayloadEntry[];
    label?: string;
    /** Hide the label row. */
    hideLabel?: boolean;
    /** Format the value for display. */
    formatValue?: (value: number) => string;
    /** Override the label text. */
    labelOverride?: string;
};

/**
 * A themed tooltip that matches the app's popover aesthetic.
 * Drop this into any Recharts chart:
 *
 *   <Tooltip content={<ChartTooltipContent />} />
 */
export function ChartTooltipContent({
    active,
    payload,
    label,
    hideLabel,
    formatValue,
    labelOverride,
}: ChartTooltipContentProps) {
    if (!active || !payload?.length) return null;

    return (
        <div className="rounded-lg border bg-popover px-3 py-2 text-xs text-popover-foreground shadow-md">
            {!hideLabel && (
                <p className="mb-1 font-medium">{labelOverride ?? label}</p>
            )}
            <div className="flex flex-col gap-0.5">
                {payload.map((entry: TooltipPayloadEntry, idx: number) => (
                    <div key={idx} className="flex items-center gap-2">
                        <span
                            className="inline-block h-2 w-2 rounded-full shrink-0"
                            style={{ backgroundColor: entry.color }}
                        />
                        <span className="text-muted-foreground">{entry.name}:</span>
                        <span className="font-medium tabular-nums">
                            {formatValue ? formatValue(entry.value as number) : entry.value}
                        </span>
                    </div>
                ))}
            </div>
        </div>
    );
}

/**
 * Pre-configured Recharts <Tooltip> with themed content.
 * Use as: <ChartTooltip />
 */
export function ChartTooltip(props: Omit<ChartTooltipContentProps, "active" | "payload" | "label">) {
    return (
        <RechartsTooltip
            cursor={{ stroke: "var(--muted-foreground)", strokeWidth: 1, strokeDasharray: "4 4" }}
            content={<ChartTooltipContent {...props} />}
        />
    );
}

export { resolveColor };

