"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    NativeSelect,
    NativeSelectOption,
} from "@/components/ui/native-select"

import { MultiSelect } from "@/components/ui/multi-select";
import { getDefaultEstimatedFrequency, CADENCE_OPTIONS, formatEstimatedFrequency } from "@/lib/estimated-frequency-defaults";
import { classifyGroupTypeWithOverrides, GROUP_TYPE_LABELS, type GroupType } from "@/lib/group-type-classifier";
import type { ContactProfile } from "@/lib/contact-profile";
import {
  ContactProfileEditor,
  type ContactProfileEditorRef,
} from "@/components/contact-profile-editor";

const PLATFORMS = [
    { value: "SMS", label: "SMS" },
    { value: "CALL", label: "Call" },
    { value: "EMAIL", label: "Email" },
    { value: "INSTAGRAM", label: "Instagram" },
    { value: "DISCORD", label: "Discord" },
    { value: "WHATSAPP", label: "WhatsApp" },
    { value: "FACEBOOK", label: "Facebook" },
    { value: "LINKEDIN", label: "LinkedIn" },
    { value: "SNAPCHAT", label: "Snapchat" },
    { value: "TELEGRAM", label: "Telegram" },
    { value: "IN_PERSON", label: "In Person" },
    { value: "OTHER", label: "Other" },
];

export type EditContactData = {
    id: string;
    name: string;
    description?: string;
    groups?: string[];
    phone?: string;
    email?: string;
    instagram?: string;
    commonPlatform?: string;
    monthsKnown?: number;
    strengthScore?: number;
    estimatedFrequencyCount?: number | null;
    estimatedFrequencyCadence?: string | null;
    estimatedFrequencyPlatform?: string | null;
    estimatedFrequencyIsAuto?: boolean;
    profile?: ContactProfile | null;
};

interface EditNodeDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    node: EditContactData | null;
    groups: string[];
    onSave: (id: string, updates: Partial<EditContactData>) => Promise<void>;
    groupTypeOverrides?: Record<string, GroupType> | null;
    userGroups?: string[];
}

export function EditNodeDialog({
    open,
    onOpenChange,
    node,
    groups,
    onSave,
    groupTypeOverrides,
    userGroups = [],
}: EditNodeDialogProps) {
    const [formData, setFormData] = useState<Partial<EditContactData>>({});
    const [profilePatch, setProfilePatch] = useState<Record<string, unknown> | null>(null);
    const [monthsKnownInput, setMonthsKnownInput] = useState("0");
    const [loading, setLoading] = useState(false);
    const [saveError, setSaveError] = useState<string | null>(null);
    const profileEditorRef = useRef<ContactProfileEditorRef>(null);

    // Estimated frequency local state
    const [freqEnabled, setFreqEnabled] = useState(false);
    const [freqCount, setFreqCount] = useState("1");
    const [freqCadence, setFreqCadence] = useState("WEEKLY");
    const [freqPlatform, setFreqPlatform] = useState("OTHER");
    const [freqAutoLabel, setFreqAutoLabel] = useState<string | null>(null);

    useEffect(() => {
        if (open) setSaveError(null);
    }, [open]);

    useEffect(() => {
        if (open && node) {
            setProfilePatch(null);
            setFormData({
                name: node.name,
                description: node.description || "",
                groups: node.groups || [],
                phone: node.phone || "",
                email: node.email || "",
                instagram: node.instagram || "",
                commonPlatform: node.commonPlatform || "",
                monthsKnown: node.monthsKnown || 0,
            });
            setMonthsKnownInput((node.monthsKnown ?? 0).toString());

            const hasFreq = node.estimatedFrequencyCount != null && node.estimatedFrequencyCount > 0;
            setFreqEnabled(hasFreq);
            setFreqCount(hasFreq ? String(node.estimatedFrequencyCount) : "1");
            setFreqCadence(node.estimatedFrequencyCadence || "WEEKLY");
            setFreqPlatform(node.estimatedFrequencyPlatform || "OTHER");
            
            // If it's currently 'auto' in the DB, show the label
            if (node.estimatedFrequencyIsAuto && hasFreq) {
                setFreqAutoLabel("Auto-estimated based on current settings.");
            } else {
                setFreqAutoLabel(null);
            }
        }
    }, [open]); // ONLY initialize when opening the dialog

    const handleChange = (field: keyof EditContactData, value: any) => {
        setFormData((prev) => ({ ...prev, [field]: value }));
    };

    const handleGroupsChange = useCallback((newGroups: string[]) => {
        handleChange("groups", newGroups);

        // If frequency is not manually enabled, suggest defaults from groups
        if (!freqEnabled && newGroups.length > 0) {
            const defaults = getDefaultEstimatedFrequency(newGroups, groupTypeOverrides, userGroups);
            if (defaults) {
                setFreqEnabled(true);
                setFreqCount(String(defaults.count));
                setFreqCadence(defaults.cadence);
                setFreqPlatform(defaults.platform);

                // Determine the group type that drove the suggestion
                let bestType: GroupType = "other";
                const priority = ["employment", "school", "family", "social", "community", "other"] as GroupType[];
                for (const g of newGroups) {
                    const t = classifyGroupTypeWithOverrides(g, groupTypeOverrides);
                    if (priority.indexOf(t) < priority.indexOf(bestType)) bestType = t;
                }
                setFreqAutoLabel(`Auto-estimated based on group type (${GROUP_TYPE_LABELS[bestType]})`);
            }
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [freqEnabled, groupTypeOverrides]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!node) return;

        setLoading(true);
        setSaveError(null);
        try {
            const finalMonths = parseInt(monthsKnownInput, 10);
            const parsedCount = parseInt(freqCount, 10);

            const effectiveProfilePatch = profilePatch ?? profileEditorRef.current?.getProfilePatch();
            if (effectiveProfilePatch === undefined) {
                setSaveError("Profile editor is not ready. Close the dialog and try again.");
                return;
            }

            // Compute only changed fields to avoid overwriting backend flags like isAuto
            const updates: Partial<EditContactData> = {};
            
            if (formData.name !== node.name) updates.name = formData.name;
            if (formData.description !== (node.description || "")) updates.description = formData.description;
            if (JSON.stringify(formData.groups) !== JSON.stringify(node.groups || [])) updates.groups = formData.groups;
            if (formData.phone !== (node.phone || "")) updates.phone = formData.phone;
            if (formData.email !== (node.email || "")) updates.email = formData.email;
            const rawIg = (formData.instagram || "").replace(/^@/, "");
            if (rawIg !== (node.instagram || "")) updates.instagram = rawIg || undefined;
            if (formData.commonPlatform !== (node.commonPlatform || "")) updates.commonPlatform = formData.commonPlatform;
            
            const monthsVal = isNaN(finalMonths) ? 0 : Math.max(0, finalMonths);
            if (monthsVal !== (node.monthsKnown || 0)) updates.monthsKnown = monthsVal;

            // Frequency fields
            const hasFreq = node.estimatedFrequencyCount != null && node.estimatedFrequencyCount > 0;
            const newFreqCount = freqEnabled && !isNaN(parsedCount) && parsedCount > 0 ? parsedCount : null;
            const newFreqCadence = freqEnabled ? freqCadence : null;
            const newFreqPlatform = freqEnabled ? freqPlatform : null;

            if (newFreqCount !== node.estimatedFrequencyCount) updates.estimatedFrequencyCount = newFreqCount;
            if (newFreqCadence !== node.estimatedFrequencyCadence) updates.estimatedFrequencyCadence = newFreqCadence;
            if (newFreqPlatform !== node.estimatedFrequencyPlatform) updates.estimatedFrequencyPlatform = newFreqPlatform;

            // Profile - always check if patch has content if we're sending it
            if (effectiveProfilePatch && Object.keys(effectiveProfilePatch).length > 0) {
                updates.profile = effectiveProfilePatch;
            }

            if (Object.keys(updates).length === 0) {
                onOpenChange(false);
                return;
            }

            await onSave(node.id, updates);
            onOpenChange(false);
        } catch (error) {
            console.error("Failed to save contact:", error);
            setSaveError(
                error instanceof Error ? error.message : "Could not save changes."
            );
        } finally {
            setLoading(false);
        }
    };

    const monthsValue = parseInt(monthsKnownInput, 10) || 0;
    const yearsDisplay = monthsValue >= 12
        ? `≈ ${(monthsValue / 12).toFixed(1)} years`
        : "";

    const parsedFreqCount = parseInt(freqCount, 10) || 0;
    const freqPreview = freqEnabled && parsedFreqCount > 0
        ? formatEstimatedFrequency(parsedFreqCount, freqCadence, freqPlatform)
        : null;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent
                forceMount
                className="sm:max-w-[520px] border border-border dark:border-border/30 max-h-[90vh] overflow-y-auto"
            >
                <DialogHeader>
                    <DialogTitle>Edit Contact</DialogTitle>
                    <DialogDescription>
                        Make changes to the contact details here. Click save when you&apos;re done.
                    </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="grid gap-4 py-4">
                    <div className="border rounded-lg p-3 space-y-3">
                        <div className="text-sm font-medium">Basics</div>
                        <div className="space-y-2">
                            <div className="space-y-1">
                                <Label htmlFor="name" className="text-xs text-muted-foreground">Name</Label>
                                <Input
                                    id="name"
                                    value={formData.name || ""}
                                    onChange={(e) => handleChange("name", e.target.value)}
                                    className="h-9"
                                    required
                                />
                            </div>
                            <div className="space-y-1">
                                <Label htmlFor="description" className="text-xs text-muted-foreground">Description</Label>
                                <Input
                                    id="description"
                                    value={formData.description || ""}
                                    onChange={(e) => handleChange("description", e.target.value)}
                                    className="h-9"
                                    placeholder="Optional"
                                />
                            </div>
                        </div>
                    </div>

                    <div className="border rounded-lg p-3 space-y-3">
                        <div className="text-sm font-medium">Groups</div>
                        <MultiSelect
                            options={groups}
                            selected={formData.groups || []}
                            onChange={handleGroupsChange}
                            placeholder="Select groups..."
                        />
                    </div>

                    <div className="border rounded-lg p-3 space-y-3">
                        <div className="text-sm font-medium">How to reach them</div>
                        <p className="text-[11px] text-muted-foreground -mt-1">
                            Used for reach-out and logging.
                        </p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div className="space-y-1">
                                <Label htmlFor="phone" className="text-xs text-muted-foreground">Phone</Label>
                                <Input
                                    id="phone"
                                    value={formData.phone || ""}
                                    onChange={(e) => handleChange("phone", e.target.value)}
                                    className="h-9"
                                />
                            </div>
                            <div className="space-y-1">
                                <Label htmlFor="email" className="text-xs text-muted-foreground">Email</Label>
                                <Input
                                    id="email"
                                    type="email"
                                    value={formData.email || ""}
                                    onChange={(e) => handleChange("email", e.target.value)}
                                    className="h-9"
                                />
                            </div>
                            <div className="space-y-1">
                                <Label htmlFor="instagram" className="text-xs text-muted-foreground">Instagram</Label>
                                <Input
                                    id="instagram"
                                    value={formData.instagram || ""}
                                    onChange={(e) => handleChange("instagram", e.target.value)}
                                    className="h-9"
                                    placeholder="@username or DM link (…/direct/t/…)"
                                />
                            </div>
                            <div className="space-y-1 sm:col-span-2">
                                <Label htmlFor="commonPlatform" className="text-xs text-muted-foreground">Primary platform</Label>
                                <NativeSelect
                                    id="commonPlatform"
                                    value={formData.commonPlatform || ""}
                                    onChange={(e) => handleChange("commonPlatform", e.target.value)}
                                    className="h-9 w-full"
                                >
                                    <NativeSelectOption value="">None</NativeSelectOption>
                                    {PLATFORMS.map(p => (
                                        <NativeSelectOption key={p.value} value={p.value}>{p.label}</NativeSelectOption>
                                    ))}
                                </NativeSelect>
                            </div>
                        </div>
                    </div>

                    <div className="border rounded-lg p-3 space-y-3">
                        <div className="text-sm font-medium">Relationship</div>
                        <div className="space-y-1">
                            <Label htmlFor="monthsKnown" className="text-xs text-muted-foreground">Known for (months)</Label>
                            <Input
                                id="monthsKnown"
                                type="number"
                                min={0}
                                value={monthsKnownInput}
                                onChange={(e) => setMonthsKnownInput(e.target.value)}
                                placeholder="0"
                                className="h-9 max-w-[12rem]"
                            />
                            <p className="text-[10px] text-muted-foreground">
                                How long you have known this person. {yearsDisplay}
                            </p>
                        </div>
                    </div>

                    {/* ── Estimated Frequency Section ── */}
                    <div className="border rounded-lg p-3 space-y-3">
                        <div className="flex items-center justify-between">
                            <Label className="text-sm font-medium">Estimated Interaction Frequency</Label>
                            <button
                                type="button"
                                role="switch"
                                aria-checked={freqEnabled}
                                onClick={() => {
                                    setFreqEnabled(!freqEnabled);
                                    if (!freqEnabled) setFreqAutoLabel(null);
                                }}
                                className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${
                                    freqEnabled ? "bg-primary" : "bg-muted"
                                }`}
                            >
                                <span
                                    className={`pointer-events-none inline-block h-4 w-4 rounded-full bg-background shadow-lg ring-0 transition-transform ${
                                        freqEnabled ? "translate-x-4" : "translate-x-0"
                                    }`}
                                />
                            </button>
                        </div>

                        {freqAutoLabel && freqEnabled && (
                            <p className="text-xs text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/30 rounded px-2 py-1">
                                {freqAutoLabel}. You can adjust or clear this.
                            </p>
                        )}

                        {freqEnabled && (
                            <div className="space-y-2">
                                <div className="flex gap-2">
                                    <div className="flex-1">
                                        <Label className="text-xs text-muted-foreground">Times</Label>
                                        <Input
                                            type="number"
                                            min={1}
                                            max={100}
                                            value={freqCount}
                                            onChange={(e) => {
                                                setFreqCount(e.target.value);
                                                setFreqAutoLabel(null);
                                            }}
                                            className="h-8"
                                        />
                                    </div>
                                    <div className="flex-1">
                                        <Label className="text-xs text-muted-foreground">Per</Label>
                                        <NativeSelect
                                            value={freqCadence}
                                            onChange={(e) => {
                                                setFreqCadence(e.target.value);
                                                setFreqAutoLabel(null);
                                            }}
                                            size="sm"
                                        >
                                            {CADENCE_OPTIONS.map(o => (
                                                <NativeSelectOption key={o.value} value={o.value}>{o.label}</NativeSelectOption>
                                            ))}
                                        </NativeSelect>
                                    </div>
                                    <div className="flex-1">
                                        <Label className="text-xs text-muted-foreground">Via</Label>
                                        <NativeSelect
                                            value={freqPlatform}
                                            onChange={(e) => {
                                                setFreqPlatform(e.target.value);
                                                setFreqAutoLabel(null);
                                            }}
                                            size="sm"
                                        >
                                            {PLATFORMS.map(p => (
                                                <NativeSelectOption key={p.value} value={p.value}>{p.label}</NativeSelectOption>
                                            ))}
                                        </NativeSelect>
                                    </div>
                                </div>
                                {freqPreview && (
                                    <p className="text-xs text-muted-foreground">
                                        Preview: {freqPreview}
                                    </p>
                                )}
                                <p className="text-[10px] text-muted-foreground">
                                    This supplements your logged interactions for strength scoring. Logged interactions within the same day replace estimated ones.
                                </p>
                            </div>
                        )}
                    </div>

                    {node && (
                        <ContactProfileEditor
                            ref={profileEditorRef}
                            profileKey={node.id}
                            profile={node.profile}
                            open={open}
                            onPatchChange={setProfilePatch}
                        />
                    )}

                    {saveError && (
                        <p className="text-sm text-destructive" role="alert">
                            {saveError}
                        </p>
                    )}

                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                            Cancel
                        </Button>
                        <Button type="submit" disabled={loading}>
                            {loading ? "Saving..." : "Save changes"}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog >
    );
}
