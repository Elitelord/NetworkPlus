"use client";

import { useMemo, useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
    SheetDescription,
} from "@/components/ui/sheet";
import { EditNodeDialog } from "@/components/edit-node-dialog";
import { LogInteractionModal, EditInteractionData } from "@/components/log-interaction-modal";
import { formatEstimatedFrequency } from "@/lib/estimated-frequency-defaults";
import type { GroupType } from "@/lib/group-type-classifier";
// import { ScrollArea } from "@/components/ui/scroll-area";

// We need to redefine or import types used in the Sheet. 
// Ideally these should be in a shared types file, but for now I'll duplicate/adapt locally 
// or accept them as generic props to avoid strict dependency loop.

// Adapting to what the Dashboard passes
type NodeData = {
    id: string;
    name: string;
    description?: string;
    groups?: string[];
    profile?: ContactProfile | null;
    email?: string | null;
    phone?: string | null;
    commonPlatform?: string | null;
    metadata?: any;
    lastInteractionAt?: string;
    interactions?: { date: string }[];
    strengthScore?: number;
    monthsKnown?: number;
    estimatedFrequencyCount?: number | null;
    estimatedFrequencyCadence?: string | null;
    estimatedFrequencyPlatform?: string | null;
    estimatedFrequencyIsAuto?: boolean;
};

type Interaction = {
    id: string;
    type: string;
    platform: string;
    date: string;
    content?: string;
    isRecurring?: boolean;
    parentInteractionId?: string;
    durationSeconds?: number;
    messageCount?: number;
};

interface ContactDetailSheetProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    node: NodeData | null;
    groups: string[];
    dueNodeIds: Set<string>; // To show alert
    onLogInteraction: (contactIds: string[]) => void;
    /** Open Reach Out modal on the Other tab with these contact ids (for "Log interaction" / new log). */
    onOpenReachOutForLog?: (contactIds: string[]) => void;
    onUpdateNode: (id: string, updates: Partial<NodeData>) => Promise<void>;
    onFocusNode: (id: string) => void;
    // Passing "connectedNeighbors" or "links/nodes" to calculate them?
    // It's cleaner to pass computed neighbors.
    connectedNeighbors: NodeData[];
    groupTypeOverrides?: Record<string, GroupType> | null;
    userGroups?: string[];
}

import { MultiSelect } from "@/components/ui/multi-select";
import { ContactProfileSummary } from "@/components/contact-profile-summary";
import type { ContactProfile } from "@/lib/contact-profile";

function GroupsEditor({
    initialGroups,
    groups,
    onSave
}: {
    initialGroups: string[];
    groups: string[];
    onSave: (newGroups: string[]) => void;
}) {
    // MultiSelect handles state internally given controlled props, but we need to trigger onSave only when needed?
    // MultiSelect onChange triggers immediately. To avoid too many updates, we could debounce or just accept immediate updates for sheet.
    // Dashboard sheet is kind of separate from "Edit Dialog". "GroupsEditor" here is an inline editor.
    // Immediate save is fine for inline editing.
    return (
        <div className="w-full max-w-xs">
            <MultiSelect
                options={groups}
                selected={initialGroups}
                onChange={onSave}
                placeholder="No groups"
                className="min-h-8 h-auto"
            />
        </div>
    );
}

export function ContactDetailSheet({
    open,
    onOpenChange,
    node,
    groups,
    dueNodeIds,
    onLogInteraction,
    onOpenReachOutForLog,
    onUpdateNode,
    onFocusNode,
    connectedNeighbors,
    groupTypeOverrides,
    userGroups = [],
}: ContactDetailSheetProps) {
    const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
    const [interactions, setInteractions] = useState<Interaction[]>([]);
    const [loadingHistory, setLoadingHistory] = useState(false);
    const [editingInteraction, setEditingInteraction] = useState<EditInteractionData | undefined>(undefined);

    useEffect(() => {
        if (node?.id && open) {
            setLoadingHistory(true);
            fetch(`/api/contacts/${node.id}/interactions`)
                .then((res) => res.ok ? res.json() : [])
                .then((data) => setInteractions(data))
                .catch((err) => console.error("Failed to fetch history:", err))
                .finally(() => setLoadingHistory(false));
        } else {
            setInteractions([]);
        }
    }, [node?.id, open]);

    const refreshHistory = (contactIds: string[]) => {
        if (node?.id) {
            fetch(`/api/contacts/${node.id}/interactions`)
                .then((res) => res.ok ? res.json() : [])
                .then((data) => setInteractions(data))
                .catch((err) => console.error("Failed to fetch history:", err));

            // Also trigger parent refresh if needed, for "Due Soon" list
            // We can call onLogInteraction to trigger the optimistic update in parent 
            // effectively clearing the alert if it was due.
            onLogInteraction(contactIds);
        }
    };

    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent
                side="right"
                className="!w-full sm:!w-[400px] md:!w-[540px] flex flex-col h-full bg-white border border-border shadow-xl dark:bg-background/70 dark:backdrop-blur-xl dark:border-border/30"
            >
                <SheetHeader className="shrink-0 mb-4">
                    <div className="flex items-start justify-between gap-2">
                        <SheetTitle className="truncate min-w-0">{node?.name}</SheetTitle>
                        <div className="flex gap-2 shrink-0">
                            <Button variant="outline" size="sm" className="text-xs sm:text-sm" onClick={() => node && onOpenReachOutForLog?.([node.id])}>
                                <span className="hidden sm:inline">Log Interaction</span>
                                <span className="sm:hidden">Log</span>
                            </Button>
                            <Button variant="outline" size="sm" onClick={() => setIsEditDialogOpen(true)}>
                                Edit
                            </Button>
                        </div>
                    </div>
                    <SheetDescription asChild>
                        <span>{node?.description || "No description provided."}</span>
                    </SheetDescription>
                    {node?.strengthScore !== undefined && (
                        <div className="flex items-center gap-2 mt-2" aria-hidden>
                            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Relationship Strength</span>
                            <div className="h-2 w-24 bg-secondary rounded-full overflow-hidden">
                                <div
                                    className="h-full bg-primary"
                                    style={{ width: `${Math.min(100, Math.max(0, node.strengthScore))}%` }}
                                />
                            </div>
                            <span className="text-xs font-mono">{node.strengthScore.toFixed(1)}</span>
                        </div>
                    )}
                    {node?.estimatedFrequencyCount != null && node.estimatedFrequencyCount > 0 && node.estimatedFrequencyCadence && node.estimatedFrequencyPlatform && (
                        <div className="flex items-center gap-1.5 mt-1.5">
                            <span className="text-xs text-muted-foreground">
                                {formatEstimatedFrequency(node.estimatedFrequencyCount, node.estimatedFrequencyCadence, node.estimatedFrequencyPlatform)}
                            </span>
                            {node.estimatedFrequencyIsAuto && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 font-medium">
                                    auto
                                </span>
                            )}
                        </div>
                    )}
                </SheetHeader>

                <div className="flex-1 -mx-6 px-6 overflow-y-auto">
                    {node && (
                        <>
                            <EditNodeDialog
                                open={isEditDialogOpen}
                                onOpenChange={setIsEditDialogOpen}
                                node={{
                                    id: node.id,
                                    name: node.name,
                                    description: node.description || "",
                                    groups: node.groups || [],
                                    email: node.email || "",
                                    phone: node.phone || "",
                                    instagram: node.instagram || "",
                                    commonPlatform: node.commonPlatform || "",
                                    strengthScore: node.strengthScore,
                                    monthsKnown: node.monthsKnown,
                                    estimatedFrequencyCount: node.estimatedFrequencyCount,
                                    estimatedFrequencyCadence: node.estimatedFrequencyCadence,
                                    estimatedFrequencyPlatform: node.estimatedFrequencyPlatform,
                                    estimatedFrequencyIsAuto: node.estimatedFrequencyIsAuto,
                                    profile: node.profile,
                                }}
                                groups={groups}
                                onSave={async (id, updates) => {
                                    await onUpdateNode(id, updates);
                                }}
                                groupTypeOverrides={groupTypeOverrides}
                                userGroups={userGroups}
                            />

                            {/* Only for editing an existing interaction; new log uses Reach Out via onOpenReachOutForLog */}
                            <LogInteractionModal
                                open={!!editingInteraction}
                                onOpenChange={(open) => {
                                    if (!open) setEditingInteraction(undefined);
                                }}
                                contactId={node.id}
                                onSuccess={refreshHistory}
                                editInteraction={editingInteraction}
                                onDelete={() => refreshHistory([node.id])}
                            />

                            <div className="mt-2">
                                {dueNodeIds.has(node.id) && (
                                    <div className="mb-6 p-3 sm:p-4 border border-red-200 bg-red-50 dark:bg-red-900/10 rounded-lg flex items-center justify-between gap-3">
                                        <div>
                                            <h4 className="text-sm font-semibold text-red-700 dark:text-red-400">Consider catching up</h4>
                                            <p className="text-xs text-red-600/80">Relationship strength is low.</p>
                                        </div>
                                        <Button size="sm" variant="secondary" onClick={() => node && onOpenReachOutForLog?.([node.id])}>
                                            Log Interaction
                                        </Button>
                                    </div>
                                )}

                                <ContactProfileSummary profile={node.profile} />

                                <div className="flex items-center gap-2 mb-4">
                                    <span className="text-sm font-medium text-muted-foreground">Groups:</span>
                                    <GroupsEditor
                                        key={node?.id}
                                        initialGroups={node?.groups ?? node?.metadata?.groups ?? []}
                                        groups={groups}
                                        onSave={(newGroups) => {
                                            void onUpdateNode(node.id, { groups: newGroups }).catch(() => {});
                                        }}
                                    />
                                </div>

                                {/* Contact Details Section (Email, Phone, Platform) */}
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                                    {node?.email && (
                                        <div className="text-sm">
                                            <span className="block text-muted-foreground text-xs">Email</span>
                                            <span className="font-medium select-all">{node.email}</span>
                                        </div>
                                    )}
                                    {node?.phone && (
                                        <div className="text-sm">
                                            <span className="block text-muted-foreground text-xs">Phone</span>
                                            <span className="font-medium select-all">{node.phone}</span>
                                        </div>
                                    )}
                                    {node?.commonPlatform && (
                                        <div className="text-sm">
                                            <span className="block text-muted-foreground text-xs">Platform</span>
                                            <span className="font-medium">{node.commonPlatform}</span>
                                        </div>
                                    )}
                                </div>

                                <div className="mb-6">
                                    {/* Upcoming interactions */}
                                    {(() => {
                                        const upcoming = interactions.filter(i => new Date(i.date) > new Date());
                                        if (upcoming.length > 0) {
                                            return (
                                                <>
                                                    <h3 className="font-semibold text-sm mb-3">Upcoming</h3>
                                                    <div className="space-y-3 mb-6">
                                                        {upcoming.map((interaction) => (
                                                            <div key={interaction.id} className="text-sm border-l-2 border-blue-400 pl-3 py-1 bg-blue-50/50 dark:bg-blue-950/20 rounded-r">
                                                                <div className="flex items-center justify-between">
                                                                    <span className="font-medium">
                                                                        {interaction.isRecurring && "🔁 "}
                                                                        {interaction.type}
                                                                    </span>
                                                                    <div className="flex items-center gap-1">
                                                                        <button
                                                                            type="button"
                                                                            className="p-0.5 rounded hover:bg-accent transition-colors"
                                                                            title="Edit interaction"
                                                                            onClick={() => {
                                                                                setEditingInteraction({
                                                                                    id: interaction.id,
                                                                                    type: interaction.type,
                                                                                    platform: interaction.platform,
                                                                                    content: interaction.content,
                                                                                    date: interaction.date,
                                                                                    durationMinutes: interaction.durationSeconds ? String(Math.round(interaction.durationSeconds / 60)) : undefined,
                                                                                    messageCount: interaction.messageCount ? String(interaction.messageCount) : undefined,
                                                                                    contactIds: [node.id],
                                                                                });
                                                                            }}
                                                                        >
                                                                            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
                                                                        </button>
                                                                        <span className="text-xs text-muted-foreground">
                                                                            {new Date(interaction.date).toLocaleDateString()}
                                                                        </span>
                                                                    </div>
                                                                </div>
                                                                <div className="text-xs text-muted-foreground flex gap-2">
                                                                    <span>via {interaction.platform}</span>
                                                                </div>
                                                                {interaction.content && (
                                                                    <p className="mt-1 text-muted-foreground/90">{interaction.content}</p>
                                                                )}
                                                            </div>
                                                        ))}
                                                    </div>
                                                </>
                                            );
                                        }
                                        return null;
                                    })()}

                                    <h3 className="font-semibold text-sm mb-3">Interaction History</h3>
                                    {loadingHistory ? (
                                        <p className="text-xs text-muted-foreground">Loading history...</p>
                                    ) : interactions.filter(i => new Date(i.date) <= new Date()).length === 0 ? (
                                        <p className="text-xs text-muted-foreground">No interactions logged yet.</p>
                                    ) : (
                                        <div className="space-y-3">
                                            {interactions.filter(i => new Date(i.date) <= new Date()).map((interaction) => (
                                                <div key={interaction.id} className="text-sm border-l-2 border-muted pl-3 py-1">
                                                    <div className="flex items-center justify-between">
                                                        <span className="font-medium">
                                                            {(interaction.isRecurring || interaction.parentInteractionId) && "🔁 "}
                                                            {interaction.type}
                                                        </span>
                                                        <div className="flex items-center gap-1">
                                                            <button
                                                                type="button"
                                                                className="p-0.5 rounded hover:bg-accent transition-colors"
                                                                title="Edit interaction"
                                                                onClick={() => {
                                                                    setEditingInteraction({
                                                                        id: interaction.id,
                                                                        type: interaction.type,
                                                                        platform: interaction.platform,
                                                                        content: interaction.content,
                                                                        date: interaction.date,
                                                                        durationMinutes: interaction.durationSeconds ? String(Math.round(interaction.durationSeconds / 60)) : undefined,
                                                                        messageCount: interaction.messageCount ? String(interaction.messageCount) : undefined,
                                                                        contactIds: [node.id],
                                                                    });
                                                                }}
                                                            >
                                                                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
                                                            </button>
                                                            <span className="text-xs text-muted-foreground">
                                                                {new Date(interaction.date).toLocaleDateString()}
                                                            </span>
                                                        </div>
                                                    </div>
                                                    <div className="text-xs text-muted-foreground flex gap-2">
                                                        <span>via {interaction.platform}</span>
                                                    </div>
                                                    {interaction.content && (
                                                        <p className="mt-1 text-muted-foreground/90">{interaction.content}</p>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                <h3 className="font-semibold text-sm mb-3">Connected Contacts ({connectedNeighbors.length})</h3>
                                {connectedNeighbors.length === 0 ? (
                                    <p className="text-sm text-muted-foreground">No connections found.</p>
                                ) : (
                                    <ul className="space-y-2 mb-6">
                                        {connectedNeighbors.map((neighbor, index) => (
                                            <li
                                                key={`${neighbor.id}-${index}`}
                                                className="flex flex-col gap-1 p-3 rounded-lg border bg-card text-card-foreground shadow-sm hover:bg-accent hover:text-accent-foreground transition-colors cursor-pointer"
                                                onClick={() => onFocusNode(neighbor.id)}
                                            >
                                                <span className="font-medium text-sm">{neighbor.name}</span>
                                                {neighbor.description && (
                                                    <span className="text-xs text-muted-foreground line-clamp-1">{neighbor.description}</span>
                                                )}
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </div>
                        </>
                    )}
                </div>
            </SheetContent>
        </Sheet>
    );
}
