"use client";

import { useState, useMemo } from "react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Users, Search, Loader2, CheckSquare, Square, Trash2, Calendar as CalendarIcon, Tag, Plus } from "lucide-react";
import { MultiSelect } from "@/components/ui/multi-select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

type Contact = {
    id: string;
    name: string;
    groups?: string[];
    email?: string | null;
    phone?: string | null;
    lastInteractionAt?: string;
    strengthScore?: number;
};

interface BulkEditModalProps {
    contacts: Contact[];
    allGroups: string[];
    initialGroupFilter?: string[];
    onSuccess: () => void;
    /** Open Reach Out modal on the Other tab with these contact ids (e.g. from "Log interaction" button). */
    onOpenReachOutForLog?: (contactIds: string[]) => void;
}

export function BulkEditModal({ contacts, allGroups, initialGroupFilter, onSuccess, onOpenReachOutForLog }: BulkEditModalProps) {
    const [open, setOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedGroupFilters, setSelectedGroupFilters] = useState<string[]>([]);
    const [selectedContactIds, setSelectedContactIds] = useState<Set<string>>(new Set());

    // Action states
    const [isUpdating, setIsUpdating] = useState(false);
    const [actionGroups, setActionGroups] = useState<string[]>([]);

    // Popover states to close after action
    const [groupsPopoverOpen, setGroupsPopoverOpen] = useState(false);
    const [deletePopoverOpen, setDeletePopoverOpen] = useState(false);

    // Filter contacts
    const filteredContacts = useMemo(() => {
        return contacts.filter(contact => {
            const matchesSearch = contact.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                (contact.email?.toLowerCase() || "").includes(searchQuery.toLowerCase());

            // If filters are selected, contact must have ALL selected filter groups (or ANY? ANY is usually better for multiselect filtering)
            // Let's do ANY: contact matches if it has at least one of the selected groups
            const contactGroups = contact.groups || [];
            const matchesGroups = selectedGroupFilters.length === 0 ||
                selectedGroupFilters.some(g => contactGroups.includes(g));

            return matchesSearch && matchesGroups;
        });
    }, [contacts, searchQuery, selectedGroupFilters]);

    const isAllSelected = filteredContacts.length > 0 && selectedContactIds.size === filteredContacts.length;

    const handleSelectAll = () => {
        if (isAllSelected) {
            setSelectedContactIds(new Set());
        } else {
            setSelectedContactIds(new Set(filteredContacts.map(c => c.id)));
        }
    };

    const handleSelectContact = (id: string) => {
        const newSet = new Set(selectedContactIds);
        if (newSet.has(id)) {
            newSet.delete(id);
        } else {
            newSet.add(id);
        }
        setSelectedContactIds(newSet);
    };

    const resetStates = () => {
        setSearchQuery("");
        setSelectedGroupFilters([]);
        setSelectedContactIds(new Set());
        setActionGroups([]);
    };

    const applyFiltersAndAutoSelect = (query: string, groupFilters: string[]) => {
        setSearchQuery(query);
        setSelectedGroupFilters(groupFilters);

        const newFiltered = contacts.filter(contact => {
            const matchesSearch = contact.name.toLowerCase().includes(query.toLowerCase()) ||
                (contact.email?.toLowerCase() || "").includes(query.toLowerCase());

            const contactGroups = contact.groups || [];
            const matchesGroups = groupFilters.length === 0 ||
                groupFilters.some(g => contactGroups.includes(g));

            return matchesSearch && matchesGroups;
        });

        if (query.trim() !== "" || groupFilters.length > 0) {
            setSelectedContactIds(new Set(newFiltered.map(c => c.id)));
        } else {
            setSelectedContactIds(new Set());
        }
    };

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

    return (
        <Dialog open={open} onOpenChange={(val) => {
            if (!val) {
                resetStates();
            } else {
                if (initialGroupFilter && initialGroupFilter.length > 0) {
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
            }
            setOpen(val);
        }}>
            <DialogTrigger asChild>
                <Button variant="outline" className="w-full justify-start gap-2">
                    <Users className="size-4" />
                    Bulk Edit Contacts
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[800px] h-[85vh] flex flex-col p-6 bg-background/70 backdrop-blur-xl border-border/30">
                <DialogHeader className="shrink-0">
                    <DialogTitle>Bulk Edit Contacts</DialogTitle>
                    <DialogDescription>
                        Select multiple contacts to apply groups or log interactions simultaneously.
                    </DialogDescription>
                </DialogHeader>

                {/* Filters */}
                <div className="flex flex-col sm:flex-row gap-3 py-4 shrink-0">
                    <div className="relative flex-1">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                        <input
                            type="text"
                            placeholder="Search contacts..."
                            className="w-full pl-9 pr-3 py-2 text-sm border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary/20"
                            value={searchQuery}
                            onChange={e => applyFiltersAndAutoSelect(e.target.value, selectedGroupFilters)}
                        />
                    </div>
                    <div className="w-full sm:w-[250px]">
                        <MultiSelect
                            options={allGroups}
                            selected={selectedGroupFilters}
                            onChange={filters => applyFiltersAndAutoSelect(searchQuery, filters)}
                            placeholder="Filter by groups..."
                            className="h-9 min-h-9"
                            creatable={false}
                        />
                    </div>
                </div>

                {/* Action Bar (Only visible when items selected) */}
                {selectedContactIds.size > 0 && (
                    <div className="bg-primary/10 border border-primary/20 rounded-lg p-3 shrink-0 flex flex-wrap items-center justify-between gap-3 animate-in fade-in slide-in-from-top-4 mb-4">
                        <div className="text-sm font-medium text-primary flex items-center gap-2">
                            <span className="flex size-5 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs">
                                {selectedContactIds.size}
                            </span>
                            Selected
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
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
                                        setOpen(false);
                                    }
                                }}
                            >
                                <CalendarIcon className="size-3.5" />
                                Log Interaction
                            </Button>

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
                                <th className="p-3 font-medium">Email / Phone</th>
                                <th className="p-3 font-medium">Groups</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y relative">
                            {filteredContacts.length === 0 ? (
                                <tr>
                                    <td colSpan={4} className="p-8 text-center text-muted-foreground">
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
                                            <td className="p-3 text-muted-foreground text-xs">
                                                {contact.email || contact.phone || "-"}
                                            </td>
                                            <td className="p-3">
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
