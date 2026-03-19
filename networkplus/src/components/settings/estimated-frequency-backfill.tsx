"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, Zap } from "lucide-react";
import { backfillEstimatedFrequency } from "@/app/settings/actions";

interface EstimatedFrequencyBackfillProps {
    contactsToBackfill: number;
    totalContacts: number;
}

export function EstimatedFrequencyBackfill({
    contactsToBackfill,
    totalContacts,
}: EstimatedFrequencyBackfillProps) {
    const [isRunning, setIsRunning] = useState(false);
    const [result, setResult] = useState<{
        success?: string;
        error?: string;
        updatedCount?: number;
    } | null>(null);
    const [remaining, setRemaining] = useState(contactsToBackfill);
    const [, startTransition] = useTransition();

    const handleBackfill = () => {
        setIsRunning(true);
        setResult(null);
        startTransition(async () => {
            try {
                const res = await backfillEstimatedFrequency(remaining === 0);
                setResult(res);
                if (res.updatedCount !== undefined) {
                    setRemaining(prev => Math.max(0, prev - res.updatedCount!));
                }
            } catch {
                setResult({ error: "Something went wrong" });
            } finally {
                setIsRunning(false);
            }
        });
    };

    return (
        <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
                Estimated interaction frequency helps calculate strength scores for contacts
                you interact with regularly but haven&apos;t logged individual interactions for.
            </p>

            <div className="rounded-md border p-3 bg-muted/30 text-sm space-y-1">
                <div className="flex justify-between">
                    <span>Total contacts</span>
                    <span className="font-medium">{totalContacts}</span>
                </div>
                <div className="flex justify-between">
                    <span>Eligible for auto-estimation</span>
                    <span className="font-medium">{remaining}</span>
                </div>
            </div>

            <Button
                onClick={handleBackfill}
                disabled={isRunning || totalContacts === 0}
                className="w-full"
                variant={remaining > 0 ? "default" : "outline"}
            >
                {isRunning ? (
                    <><Loader2 className="size-4 animate-spin mr-2" /> Processing...</>
                ) : remaining > 0 ? (
                    <><Zap className="size-4 mr-2" /> {contactsToBackfill === remaining ? 'Auto-estimate' : 'Refresh estimates'} for {remaining} contacts</>
                ) : (
                    <><Zap className="size-4 mr-2" /> Refresh all estimates</>
                )}
            </Button>

            {result?.success && (
                <p className="text-sm text-emerald-600 dark:text-emerald-400">{result.success}</p>
            )}
            {result?.error && (
                <p className="text-sm text-destructive">{result.error}</p>
            )}

            <p className="text-xs text-muted-foreground">
                This uses each contact&apos;s group classification to auto-assign a default frequency.
                Contacts where you&apos;ve manually set a frequency are <strong>never</strong> overwritten.
                You can refresh this anytime if you change your group categorization rules.
            </p>
        </div>
    );
}
