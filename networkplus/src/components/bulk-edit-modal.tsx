"use client";

import { useState } from "react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Users, Search, Loader2, CheckSquare, Square, Trash2, Calendar as CalendarIcon, Tag, Plus, Activity } from "lucide-react";
import { MultiSelect } from "@/components/ui/multi-select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useContactSelectionWorkspace } from "@/hooks/use-contact-selection-workspace";
import { GROUP_TYPE_LABELS, GROUP_TYPE_COLORS, groupsByType, type GroupType } from "@/lib/group-type-classifier";
import { CADENCE_OPTIONS } from "@/lib/estimated-frequency-defaults";
import {
    NativeSelect,
    NativeSelectOption,
} from "@/components/ui/native-select";

const FREQ_PLATFORMS = [
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

type Contact = {
    id: string;
    name: string;
    groups?: string[];
    email?: string | null;
    phone?: string | null;
    lastInteractionAt?: string;
    strengthScore?: number;
};

type BulkEditIntent =
    | { kind: "default" }
    | {
        kind: "link-selection";
        maxNodes?: number;
        onDone: (selectedIds: string[]) => void;
    };

interface BulkEditModalProps {
    contacts: Contact[];
    allGroups: string[];
    initialGroupFilter?: string[];
    onSuccess: () => void;
    /** Open Reach Out modal on the Other tab with these contact ids (e.g. from "Log interaction" button). */
    onOpenReachOutForLog?: (contactIds: string[]) => void;
    intent?: BulkEditIntent;
    /** When true, the internal trigger button is hidden so the parent controls opening. */
    hideTrigger?: boolean;
    /** Optional controlled open state for embedding inside other dialogs. */
    openOverride?: boolean;
    onOpenChangeOverride?: (open: boolean) => void;
    groupTypeOverrides?: Record<string, GroupType> | null;
}

export function BulkEditModal({
    contacts,
    allGroups,
    initialGroupFilter,
    onSuccess,
    onOpenReachOutForLog,
    intent = { kind: "default" },
    hideTrigger,
    openOverride,
    onOpenChangeOverride,
    groupTypeOverrides,
}: BulkEditModalProps) {
    const [internalOpen, setInternalOpen] = useState(false);
    const {
        searchQuery,
        setSearchQuery,
        selectedGroupFilters,
        setSelectedGroupFilters,
        selectedContactIds,
        setSelectedContactIds,
        filteredContacts,
        isAllSelected,
        toggleSelectAllFiltered,
        toggleContact,
        resetSelectionState,
    } = useContactSelectionWorkspace({
        contacts,
        initialSelectedIds: [],
        initialGroupFilters: initialGroupFilter,
    });

    // Action states
    const [isUpdating, setIsUpdating] = useState(false);
    const [actionGroups, setActionGroups] = useState<string[]>([]);

    // Popover states to close after action
    const [groupsPopoverOpen, setGroupsPopoverOpen] = useState(false);
    const [deletePopoverOpen, setDeletePopoverOpen] = useState(false);
    const [freqPopoverOpen, setFreqPopoverOpen] = useState(false);
    const [freqCount, setFreqCount] = useState("1");
    const [freqCadence, setFreqCadence] = useState("WEEKLY");
    const [freqPlatform, setFreqPlatform] = useState("OTHER");

    const handleSelectAll = () => {
        toggleSelectAllFiltered();
    };

    const handleSelectContact = (id: string) => {
        toggleContact(id);
    };

    const resetStates = () => {
        resetSelectionState();
        setActionGroups([]);
    };

    // Type filters derived from allGroups (with user overrides)
    const typeMap = groupsByType(allGroups, groupTypeOverrides);
    const orderedTypes: GroupType[] = ["school", "employment", "social", "family", "community", "other"];

    async function handleBulkGroupUpdate(action: "add_group" | "remove_group") {
        if (actionGroups.length === 0 || selectedContactIds.size === 0) return;
        setIsUpdating(true);
        try {
            const res = await fetch("/api/contacts/bulk", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    contactIds: Array.from(selectedContactIds),
                    action,
                    groups: actionGroups
                })
            });
            if (!res.ok) throw new Error("Failed to update groups");

            setGroupsPopoverOpen(false);
            setActionGroups([]);
            setSelectedContactIds(new Set());
            onSuccess();
        } catch (err) {
            console.error(err);
            alert("Failed to update groups");
        } finally {
            setIsUpdating(false);
        }
    }

    async function handleBulkDelete() {
        if (selectedContactIds.size === 0) return;
        setIsUpdating(true);
        try {
            const res = await fetch("/api/contacts/bulk", {
                method: "DELETE",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ contactIds: Array.from(selectedContactIds) })
            });
            if (!res.ok) throw new Error("Failed to delete contacts");

            setDeletePopoverOpen(false);
            setSelectedContactIds(new Set());
            onSuccess();
        } catch (err) {
            console.error(err);
            alert("Failed to delete contacts");
        } finally {
            setIsUpdating(false);
        }
    }

    async function handleBulkSetFrequency() {
        if (selectedContactIds.size === 0) return;
        const count = parseInt(freqCount, 10);
        if (isNaN(count) || count < 1) return;
        setIsUpdating(true);
        try {
            const res = await fetch("/api/contacts/bulk", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    contactIds: Array.from(selectedContactIds),
                    action: "set_estimated_frequency",
                    estimatedFrequencyCount: count,
                    estimatedFrequencyCadence: freqCadence,
                    estimatedFrequencyPlatform: freqPlatform,
                })
            });
            if (!res.ok) throw new Error("Failed to set frequency");
            setFreqPopoverOpen(false);
            setSelectedContactIds(new Set());
            onSuccess();
        } catch (err) {
            console.error(err);
            alert("Failed to set estimated frequency");
        } finally {
            setIsUpdating(false);
        }
    }

    async function handleBulkClearFrequency() {
        if (selectedContactIds.size === 0) return;
        setIsUpdating(true);
        try {
            const res = await fetch("/api/contacts/bulk", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    contactIds: Array.from(selectedContactIds),
                    action: "clear_estimated_frequency",
                })
            });
            if (!res.ok) throw new Error("Failed to clear frequency");
            setFreqPopoverOpen(false);
            setSelectedContactIds(new Set());
            onSuccess();
        } catch (err) {
            console.error(err);
            alert("Failed to clear estimated frequency");
        } finally {
            setIsUpdating(false);
        }
    }

    const open = openOverride ?? internalOpen;

    const handleDialogOpenChange = (val: boolean) => {
        if (!val) {
            resetStates();
        } else if (initialGroupFilter && initialGroupFilter.length > 0) {
            setSelectedGroupFilters(initialGroupFilter);
            const preFiltered = contacts.filter(contact => {
                const contactGroups = contact.groups || [];
                return initialGroupFilter.some(g => contactGroups.includes(g));
            });
            setSelectedContactIds(new Set(preFiltered.map(c => c.id)));
        } else {
            setSelectedGroupFilters([]);
            setSelectedContactIds(new Set());
        }

        if (onOpenChangeOverride) {
            onOpenChangeOverride(val);
        } else {
            setInternalOpen(val);
        }
    };

    return (
        <Dialog open={open} onOpenChange={handleDialogOpenChange}>
            {!hideTrigger && (
                <DialogTrigger asChild>
                    <Button variant="outline" className="w-full justify-start gap-2">
                        <Users className="size-4" />
                        Bulk Edit Contacts
                    </Button>
                </DialogTrigger>
            )}
            <DialogContent className="sm:max-w-[800px] h-[85vh] flex flex-col overflow-x-hidden p-4 sm:p-6 border border-border dark:border-border/30">
                <DialogHeader className="shrink-0">
                    <DialogTitle>
                        {intent.kind === "link-selection" ? "Select Contacts to Link" : "Bulk Edit Contacts"}
                    </DialogTitle>
                    <DialogDescription>
                        {intent.kind === "link-selection"
                            ? "Search and filter to choose the contacts you want to link, then confirm."
                            : "Select multiple contacts to apply groups or log interactions simultaneously."}
                    </DialogDescription>
                </DialogHeader>

                {/* Filters */}
                <div className="flex min-w-0 flex-col gap-2 py-4 shrink-0">
                    <div className="flex min-w-0 flex-col gap-3 sm:flex-row">
                        <div className="relative min-w-0 flex-1">
                            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                            <input
                                type="text"
                                placeholder="Search contacts..."
                                className="w-full pl-9 pr-3 py-2 text-sm border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary/20"
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                            />
                        </div>
                        <div className="w-full min-w-0 sm:w-[250px] sm:shrink-0">
                            <MultiSelect
                                options={allGroups}
                                selected={selectedGroupFilters}
                                onChange={filters => setSelectedGroupFilters(filters)}
                                placeholder="Filter by groups..."
                                selectedLayout="scroll-x"
                            />
                        </div>
                    </div>
                    {/* Type filter strip */}
                    <div className="flex flex-nowrap items-center gap-2 text-xs overflow-x-auto max-w-full pb-1">
                        {orderedTypes.map((type) => {
                            const groups = typeMap.get(type) || [];
                            if (!groups.length) return null;
                            const allSelected = groups.length > 0 && groups.every(g => selectedGroupFilters.includes(g));
                            const toggleType = () => {
                                if (allSelected) {
                                    const next = selectedGroupFilters.filter(g => !groups.includes(g));
                                    setSelectedGroupFilters(next);
                                } else {
                                    const next = new Set(selectedGroupFilters);
                                    groups.forEach(g => next.add(g));
                                    setSelectedGroupFilters(Array.from(next));
                                }
                            };
                            return (
                                <button
                                    key={type}
                                    type="button"
                                    onClick={toggleType}
                                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full border text-xs transition-colors ${
                                        allSelected
                                            ? "bg-primary text-primary-foreground border-primary"
                                            : "bg-background text-muted-foreground border-border hover:bg-muted/60"
                                    }`}
                                    style={allSelected ? { borderColor: GROUP_TYPE_COLORS[type] } : undefined}
                                >
                                    <span
                                        className="w-2 h-2 rounded-full"
                                        style={{ backgroundColor: GROUP_TYPE_COLORS[type] }}
                                    />
                                    <span>{GROUP_TYPE_LABELS[type]}</span>
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* Action Bar (Only visible when items selected) */}
                {selectedContactIds.size > 0 && (
                    <div className="bg-primary/10 border border-primary/20 rounded-lg p-3 shrink-0 flex flex-wrap items-center justify-between gap-3 animate-in fade-in slide-in-from-top-4 mb-4">
                        <div className="text-sm font-medium text-primary flex items-center gap-2">
                            <span className="flex size-5 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs">
                                {selectedContactIds.size}
                            </span>
                            {intent.kind === "link-selection"
                                ? `Selected (choose ${intent.maxNodes ?? 2})`
                                : "Selected"}
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                            {intent.kind === "link-selection" ? (
                                (() => {
                                    const required = intent.maxNodes ?? 2;
                                    const tooFew = selectedContactIds.size < required;
                                    const tooMany = selectedContactIds.size > required;
                                    const disabled = tooFew || tooMany;
                                    return (
                                        <>
                                            <Button
                                                size="sm"
                                                className="h-8 gap-1.5"
                                                disabled={disabled}
                                                onClick={() => {
                                                    const ids = Array.from(selectedContactIds);
                                                    intent.onDone(ids);
                                                    handleDialogOpenChange(false);
                                                }}
                                            >
                                                Confirm selection
                                            </Button>
                                            <span className="text-xs text-muted-foreground">
                                                {tooFew && `Select ${required} contacts to continue.`}
                                                {tooMany && `Please select only ${required} contacts.`}
                                            </span>
                                        </>
                                    );
                                })()
                            ) : (
                                <>
                                    {/* Manage Groups */}
                                    <Popover open={groupsPopoverOpen} onOpenChange={setGroupsPopoverOpen}>
                                        <PopoverTrigger asChild>
                                            <Button variant="secondary" size="sm" className="h-8 gap-1.5 border-primary/20">
                                                <Tag className="size-3.5" />
                                                Manage Groups
                                            </Button>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-80 p-4" align="end">
                                            <div className="space-y-4">
                                                <h4 className="font-medium text-sm">Add or Remove Groups</h4>
                                                <MultiSelect
                                                    options={allGroups}
                                                    selected={actionGroups}
                                                    onChange={setActionGroups}
                                                    placeholder="Select groups to apply..."
                                                />
                                                <div className="flex gap-2">
                                                    <Button
                                                        className="flex-1 text-xs h-8"
                                                        onClick={() => handleBulkGroupUpdate("add_group")}
                                                        disabled={actionGroups.length === 0 || isUpdating}
                                                    >
                                                        {isUpdating ? <Loader2 className="size-3.5 animate-spin mr-1" /> : <Plus className="size-3.5 mr-1" />}
                                                        Add to selected
                                                    </Button>
                                                    <Button
                                                        variant="destructive"
                                                        className="flex-1 text-xs h-8"
                                                        onClick={() => handleBulkGroupUpdate("remove_group")}
                                                        disabled={actionGroups.length === 0 || isUpdating}
                                                    >
                                                        Remove from selected
                                                    </Button>
                                                </div>
                                            </div>
                                        </PopoverContent>
                                    </Popover>

                                    {/* Log Interaction — opens Reach Out modal Other tab with selected contacts */}
                                    <Button
                                        variant="secondary"
                                        size="sm"
                                        className="h-8 gap-1.5 border-primary/20"
                                        disabled={selectedContactIds.size === 0}
                                        onClick={() => {
                                            if (onOpenReachOutForLog && selectedContactIds.size > 0) {
                                                onOpenReachOutForLog(Array.from(selectedContactIds));
                                                handleDialogOpenChange(false);
                                            }
                                        }}
                                    >
                                        <CalendarIcon className="size-3.5" />
                                        Log Interaction
                                    </Button>

                                    {/* Set Frequency */}
                                    <Popover open={freqPopoverOpen} onOpenChange={setFreqPopoverOpen}>
                                        <PopoverTrigger asChild>
                                            <Button variant="secondary" size="sm" className="h-8 gap-1.5 border-primary/20">
                                                <Activity className="size-3.5" />
                                                Set Frequency
                                            </Button>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-72 p-4" align="end">
                                            <div className="space-y-3">
                                                <h4 className="font-medium text-sm">Estimated Interaction Frequency</h4>
                                                <p className="text-xs text-muted-foreground">Set how often you typically interact with the selected contacts.</p>
                                                <div className="flex gap-2">
                                                    <div className="flex-1">
                                                        <label className="text-xs text-muted-foreground">Times</label>
                                                        <input
                                                            type="number"
                                                            min={1}
                                                            max={100}
                                                            value={freqCount}
                                                            onChange={(e) => setFreqCount(e.target.value)}
                                                            className="w-full h-8 px-2 text-sm border rounded-md bg-background"
                                                        />
                                                    </div>
                                                    <div className="flex-1">
                                                        <label className="text-xs text-muted-foreground">Per</label>
                                                        <NativeSelect
                                                            value={freqCadence}
                                                            onChange={(e) => setFreqCadence(e.target.value)}
                                                            size="sm"
                                                        >
                                                            {CADENCE_OPTIONS.map(o => (
                                                                <NativeSelectOption key={o.value} value={o.value}>{o.label}</NativeSelectOption>
                                                            ))}
                                                        </NativeSelect>
                                                    </div>
                                                </div>
                                                <div>
                                                    <label className="text-xs text-muted-foreground">Via</label>
                                                    <NativeSelect
                                                        value={freqPlatform}
                                                        onChange={(e) => setFreqPlatform(e.target.value)}
                                                        size="sm"
                                                    >
                                                        {FREQ_PLATFORMS.map(p => (
                                                            <NativeSelectOption key={p.value} value={p.value}>{p.label}</NativeSelectOption>
                                                        ))}
                                                    </NativeSelect>
                                                </div>
                                                <div className="flex gap-2">
                                                    <Button
                                                        className="flex-1 text-xs h-8"
                                                        onClick={handleBulkSetFrequency}
                                                        disabled={isUpdating}
                                                    >
                                                        {isUpdating ? <Loader2 className="size-3.5 animate-spin mr-1" /> : null}
                                                        Apply
                                                    </Button>
                                                    <Button
                                                        variant="outline"
                                                        className="flex-1 text-xs h-8"
                                                        onClick={handleBulkClearFrequency}
                                                        disabled={isUpdating}
                                                    >
                                                        Clear frequency
                                                    </Button>
                                                </div>
                                            </div>
                                        </PopoverContent>
                                    </Popover>

                                    {/* Delete */}
                                    <Popover open={deletePopoverOpen} onOpenChange={setDeletePopoverOpen}>
                                        <PopoverTrigger asChild>
                                            <Button variant="ghost" size="sm" className="h-8 gap-1.5 text-destructive hover:bg-destructive/10 hover:text-destructive">
                                                <Trash2 className="size-3.5" />
                                                Delete
                                            </Button>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-64 p-4" align="end">
                                            <div className="space-y-4">
                                                <p className="text-sm font-medium">Delete {selectedContactIds.size} contacts?</p>
                                                <p className="text-xs text-muted-foreground">This action cannot be undone. All interactions and links will also be removed.</p>
                                                <div className="flex gap-2 justify-end">
                                                    <Button variant="outline" size="sm" className="h-8" onClick={() => setDeletePopoverOpen(false)}>Cancel</Button>
                                                    <Button variant="destructive" size="sm" className="h-8" onClick={handleBulkDelete} disabled={isUpdating}>Delete</Button>
                                                </div>
                                            </div>
                                        </PopoverContent>
                                    </Popover>
                                </>
                            )}
                        </div>
                    </div>
                )}

                {/* Data Table */}
                <div className="flex-1 overflow-auto border rounded-md bg-background min-h-0">
                    <table className="w-full text-sm text-left">
                        <thead className="text-xs text-muted-foreground bg-muted/50 sticky top-0 z-10 shadow-sm">
                            <tr>
                                <th className="p-3 w-10">
                                    <button
                                        className="flex items-center justify-center text-muted-foreground hover:text-foreground"
                                        onClick={handleSelectAll}
                                        disabled={filteredContacts.length === 0}
                                    >
                                        {isAllSelected ? <CheckSquare className="size-4 text-primary" /> : <Square className="size-4" />}
                                    </button>
                                </th>
                                <th className="p-3 font-medium">Name</th>
                                <th className="p-3 font-medium hidden sm:table-cell">Email / Phone</th>
                                <th className="p-3 font-medium hidden md:table-cell">Groups</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y relative">
                            {filteredContacts.length === 0 ? (
                                <tr>
                                    <td colSpan={4} className="p-6 sm:p-8 text-center text-muted-foreground">
                                        No contacts found.
                                    </td>
                                </tr>
                            ) : (
                                filteredContacts.map(contact => {
                                    const isSelected = selectedContactIds.has(contact.id);
                                    return (
                                        <tr
                                            key={contact.id}
                                            className={`hover:bg-muted/50 transition-colors cursor-pointer ${isSelected ? 'bg-primary/5' : ''}`}
                                            onClick={() => handleSelectContact(contact.id)}
                                        >
                                            <td className="p-3 text-center">
                                                <div className="flex items-center justify-center text-muted-foreground">
                                                    {isSelected ? <CheckSquare className="size-4 text-primary" /> : <Square className="size-4" />}
                                                </div>
                                            </td>
                                            <td className="p-3 font-medium">
                                                <div className="flex items-center gap-2">
                                                    {contact.name}
                                                    {contact.strengthScore !== undefined && contact.strengthScore < 20 && (
                                                        <span className="flex size-2 rounded-full bg-destructive flex-shrink-0" />
                                                    )}
                                                </div>
                                            </td>
                                            <td className="p-3 text-muted-foreground text-xs hidden sm:table-cell">
                                                {contact.email || contact.phone || "-"}
                                            </td>
                                            <td className="p-3 hidden md:table-cell">
                                                <div className="flex flex-wrap gap-1">
                                                    {(contact.groups || []).slice(0, 3).map(g => (
                                                        <span key={g} className="px-1.5 py-0.5 rounded-sm bg-secondary text-[10px] font-medium truncate max-w-[100px]">
                                                            {g}
                                                        </span>
                                                    ))}
                                                    {(contact.groups || []).length > 3 && (
                                                        <span className="px-1.5 py-0.5 rounded-sm bg-muted text-[10px] font-medium text-muted-foreground">
                                                            +{(contact.groups || []).length - 3}
                                                        </span>
                                                    )}
                                                    {(!contact.groups || contact.groups.length === 0) && (
                                                        <span className="text-muted-foreground text-xs opacity-50">-</span>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
                <div className="shrink-0 pt-4 text-xs text-muted-foreground flex justify-between items-center">
                    <span>Showing {filteredContacts.length} of {contacts.length} contacts</span>
                    {selectedContactIds.size > 0 && <span>{selectedContactIds.size} selected</span>}
                </div>
            </DialogContent>
        </Dialog>
    );
}
