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
import { EditNodeDialog, EditNodeData } from "@/components/edit-node-dialog";
import { LogInteractionModal } from "@/components/log-interaction-modal";
// import { ScrollArea } from "@/components/ui/scroll-area";

// We need to redefine or import types used in the Sheet. 
// Ideally these should be in a shared types file, but for now I'll duplicate/adapt locally 
// or accept them as generic props to avoid strict dependency loop.

// Adapting to what the Dashboard passes
type NodeData = {
    id: string;
    name: string;
    description?: string;
    group?: string | null;
    email?: string | null;
    phone?: string | null;
    commonPlatform?: string | null;
    metadata?: any;
    lastInteractionAt?: string;
    interactions?: { date: string }[];
};

type Interaction = {
    id: string;
    type: string;
    platform: string;
    date: string;
    content?: string;
};

interface ContactDetailSheetProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    node: NodeData | null;
    groups: string[];
    dueNodeIds: Set<string>; // To show alert
    onLogInteraction: (contactName: string) => void; // Legacy/Quick action from alert? We might repurpose this or use it to refresh
    onUpdateNode: (id: string, updates: Partial<NodeData>) => Promise<void>;
    onFocusNode: (id: string) => void;
    // Passing "connectedNeighbors" or "links/nodes" to calculate them?
    // It's cleaner to pass computed neighbors.
    connectedNeighbors: NodeData[];
}

function GroupEditor({
    initialGroup,
    groups,
    onSave
}: {
    initialGroup: string;
    groups: string[];
    onSave: (newGroup: string) => void;
}) {
    const [value, setValue] = useState(initialGroup);

    // Reset value when the node (represented by initialGroup) changes externally
    // Simple useEffect sync
    useMemo(() => {
        setValue(initialGroup);
    }, [initialGroup]);

    return (
        <div className="relative">
            <input
                list="group-suggestions-edit-sheet"
                className="inline-flex items-center rounded-md bg-secondary px-2 py-1 text-xs font-medium text-secondary-foreground ring-1 ring-inset ring-gray-500/10 border-0 focus:ring-2 focus:ring-primary w-40"
                placeholder="None"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                onBlur={() => {
                    if (value !== initialGroup) {
                        onSave(value);
                    }
                }}
                onKeyDown={(e) => {
                    if (e.key === "Enter") {
                        e.currentTarget.blur();
                    }
                }}
            />
            <datalist id="group-suggestions-edit-sheet">
                {groups.map((g) => (
                    <option key={g} value={g} />
                ))}
            </datalist>
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
    onUpdateNode,
    onFocusNode,
    connectedNeighbors,
}: ContactDetailSheetProps) {
    const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
    const [isLogInteractionOpen, setIsLogInteractionOpen] = useState(false);
    const [interactions, setInteractions] = useState<Interaction[]>([]);
    const [loadingHistory, setLoadingHistory] = useState(false);

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

    const refreshHistory = () => {
        if (node?.id) {
            fetch(`/api/contacts/${node.id}/interactions`)
                .then((res) => res.ok ? res.json() : [])
                .then((data) => setInteractions(data))
                .catch((err) => console.error("Failed to fetch history:", err));

            // Also trigger parent refresh if needed, for "Due Soon" list
            // We can call onLogInteraction to trigger the optimistic update in parent 
            // effectively clearing the alert if it was due.
            onLogInteraction(node.name);
        }
    };

    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent side="right" className="w-[400px] sm:w-[540px] flex flex-col h-full">
                <SheetHeader className="shrink-0 mb-4">
                    <div className="flex items-center justify-between">
                        <SheetTitle>{node?.name}</SheetTitle>
                        <div className="flex gap-2">
                            <Button variant="outline" size="sm" onClick={() => setIsLogInteractionOpen(true)}>
                                Log Interaction
                            </Button>
                            <Button variant="outline" size="sm" onClick={() => setIsEditDialogOpen(true)}>
                                Edit
                            </Button>
                        </div>
                    </div>
                    <SheetDescription>
                        {node?.description || "No description provided."}
                    </SheetDescription>
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
                                    group: node.group || "",
                                    email: node.email || "",
                                    phone: node.phone || "",
                                    commonPlatform: node.commonPlatform || "",
                                }}
                                groups={groups}
                                onSave={async (id, updates) => {
                                    await onUpdateNode(id, updates);
                                }}
                            />

                            <LogInteractionModal
                                open={isLogInteractionOpen}
                                onOpenChange={setIsLogInteractionOpen}
                                contactId={node.id}
                                onSuccess={refreshHistory}
                            />

                            <div className="mt-2">
                                {dueNodeIds.has(node.id) && (
                                    <div className="mb-6 p-4 border border-red-200 bg-red-50 dark:bg-red-900/10 rounded-lg flex items-center justify-between">
                                        <div>
                                            <h4 className="text-sm font-semibold text-red-700 dark:text-red-400">Due for follow-up</h4>
                                            <p className="text-xs text-red-600/80">Last interaction was over 30 days ago.</p>
                                        </div>
                                        <Button size="sm" variant="secondary" onClick={() => setIsLogInteractionOpen(true)}>
                                            Log Interaction
                                        </Button>
                                    </div>
                                )}

                                <div className="flex items-center gap-2 mb-4">
                                    <span className="text-sm font-medium text-muted-foreground">Group:</span>
                                    <GroupEditor
                                        key={node?.id}
                                        initialGroup={node?.group ?? node?.metadata?.group ?? ""}
                                        groups={groups}
                                        onSave={(newGroup) => onUpdateNode(node.id, { group: newGroup })}
                                    />
                                </div>

                                {/* Contact Details Section (Email, Phone, Platform) */}
                                <div className="grid grid-cols-2 gap-4 mb-6">
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
                                    <h3 className="font-semibold text-sm mb-3">Interaction History</h3>
                                    {loadingHistory ? (
                                        <p className="text-xs text-muted-foreground">Loading history...</p>
                                    ) : interactions.length === 0 ? (
                                        <p className="text-xs text-muted-foreground">No interactions logged yet.</p>
                                    ) : (
                                        <div className="space-y-3">
                                            {interactions.map((interaction) => (
                                                <div key={interaction.id} className="text-sm border-l-2 border-muted pl-3 py-1">
                                                    <div className="flex items-center justify-between">
                                                        <span className="font-medium">{interaction.type}</span>
                                                        <span className="text-xs text-muted-foreground">
                                                            {new Date(interaction.date).toLocaleDateString()}
                                                        </span>
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

                                <h3 className="font-semibold text-sm mb-3">Connected Nodes ({connectedNeighbors.length})</h3>
                                {connectedNeighbors.length === 0 ? (
                                    <p className="text-sm text-muted-foreground">No connections found.</p>
                                ) : (
                                    <ul className="space-y-2 mb-6">
                                        {connectedNeighbors.map((neighbor) => (
                                            <li
                                                key={neighbor.id}
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
