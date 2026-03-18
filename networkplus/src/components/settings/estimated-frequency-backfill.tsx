"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, Zap } from "lucide-react";
import { backfillEstimatedFrequency } from "@/app/settings/actions";

interface EstimatedFrequencyBackfillProps {
    contactsWithoutFrequency: number;
    totalContacts: number;
}

export function EstimatedFrequencyBackfill({
    contactsWithoutFrequency,
    totalContacts,
}: EstimatedFrequencyBackfillProps) {
    const [isRunning, setIsRunning] = useState(false);
    const [result, setResult] = useState<{
        success?: string;
        error?: string;
        updatedCount?: number;
    } | null>(null);
    const [remaining, setRemaining] = useState(contactsWithoutFrequency);

    const handleBackfill = async () => {
        setIsRunning(true);
        setResult(null);
        try {
            const res = await backfillEstimatedFrequency();
            setResult(res);
            if (res.updatedCount !== undefined) {
                setRemaining(prev => Math.max(0, prev - res.updatedCount!));
            }
        } catch {
            setResult({ error: "Something went wrong" });
        } finally {
            setIsRunning(false);
        }
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
                    <span>Without estimated frequency</span>
                    <span className="font-medium">{remaining}</span>
                </div>
            </div>

            {remaining > 0 ? (
                <Button
                    onClick={handleBackfill}
                    disabled={isRunning}
                    className="w-full"
                    variant="outline"
                >
                    {isRunning ? (
                        <><Loader2 className="size-4 animate-spin mr-2" /> Backfilling...</>
                    ) : (
                        <><Zap className="size-4 mr-2" /> Auto-estimate for {remaining} contacts</>
                    )}
                </Button>
            ) : (
                <p className="text-sm text-emerald-600 dark:text-emerald-400">
                    All contacts with groups have estimated frequency set.
                </p>
            )}

            {result?.success && (
                <p className="text-sm text-emerald-600 dark:text-emerald-400">{result.success}</p>
            )}
            {result?.error && (
                <p className="text-sm text-destructive">{result.error}</p>
            )}

            <p className="text-xs text-muted-foreground">
                This uses each contact&apos;s group classification to auto-assign a default frequency.
                Contacts that already have an estimated frequency will not be changed. You can
                always adjust individual contacts from the edit dialog or use the bulk editor.
            </p>
        </div>
    );
}
