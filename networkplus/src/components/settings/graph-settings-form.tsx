"use client"

import { useGraphSettings } from "@/hooks/use-graph-settings"
import { Slider } from "@/components/ui/slider"
import { Label } from "@/components/ui/label"
import { Loader2 } from "lucide-react"

export function GraphSettingsForm() {
    const { settings, updateSettings, isLoaded } = useGraphSettings()

    if (!isLoaded) {
        return (
            <div className="flex h-[100px] items-center justify-center border rounded-lg p-4">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
        )
    }

    const value = settings.clusterThreshold

    // Helper text describing the threshold
    let description = "Automatically collapses large groups at certain zoom levels."
    if (value === 0) {
        description = "Never cluster groups."
    } else if (value >= 5) {
        description = "Always cluster groups."
    } else if (value < 1.0) {
        description = "Clusters disappear easily; you must zoom out very far to see them."
    } else if (value > 3.0) {
        description = "Clusters appear easily; groups will stay clustered even when zoomed in."
    }

    return (
        <div className="space-y-6 rounded-lg border p-4">
            <div className="space-y-4">
                <div className="flex items-center justify-between">
                    <Label className="text-base font-medium">Cluster Zoom Threshold</Label>
                    <span className="text-sm text-muted-foreground font-mono w-12 text-right">
                        {value === 0 ? "Never" : value === 5 ? "Always" : `${value.toFixed(1)}x`}
                    </span>
                </div>

                <Slider
                    value={[value]}
                    min={0}
                    max={5}
                    step={0.1}
                    onValueChange={([val]: number[]) => updateSettings({ clusterThreshold: val })}
                    className="py-4"
                />

                <p className="text-sm text-muted-foreground min-h-10">
                    {description}
                </p>
            </div>
        </div>
    )
}
