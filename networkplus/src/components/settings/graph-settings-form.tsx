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

    const clusterValue = settings.clusterThreshold
    const spacingValue = settings.contactSpacing

    // Helper text describing the threshold
    let description = "Automatically collapses large groups at certain zoom levels."
    if (clusterValue === 0) {
        description = "Never cluster groups."
    } else if (clusterValue >= 5) {
        description = "Always cluster groups."
    } else if (clusterValue < 1.0) {
        description = "Clusters disappear easily; you must zoom out very far to see them."
    } else if (clusterValue > 3.0) {
        description = "Clusters appear easily; groups will stay clustered even when zoomed in."
    }

    let spacingDescription = "Adjusts contact spacing in the graph."
    if (spacingValue < 35) {
        spacingDescription = "Keeps contacts closer together."
    } else if (spacingValue > 65) {
        spacingDescription = "Spreads contacts out more across the graph."
    }

    return (
        <div className="space-y-6 rounded-lg border p-4">
            <div className="space-y-4">
                <div className="flex items-center justify-between">
                    <Label className="text-base font-medium">Cluster Zoom Threshold</Label>
                    <span className="text-sm text-muted-foreground font-mono w-12 text-right">
                        {clusterValue === 0 ? "Never" : clusterValue === 5 ? "Always" : `${clusterValue.toFixed(1)}x`}
                    </span>
                </div>

                <Slider
                    value={[clusterValue]}
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

            <div className="space-y-4">
                <div className="flex items-center justify-between">
                    <Label className="text-base font-medium">Contact Spacing</Label>
                    <span className="text-sm text-muted-foreground font-mono tabular-nums w-10 text-right">
                        {spacingValue}
                    </span>
                </div>

                <Slider
                    value={[spacingValue]}
                    min={0}
                    max={100}
                    step={1}
                    onValueChange={([val]: number[]) => updateSettings({ contactSpacing: val })}
                    className="py-4"
                />

                <p className="text-sm text-muted-foreground min-h-10">
                    {spacingDescription}
                </p>
            </div>
        </div>
    )
}
