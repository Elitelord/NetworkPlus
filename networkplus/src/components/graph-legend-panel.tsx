"use client";

import { useState, useRef, useCallback, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Filter, X, Check, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import {
    classifyGroupType,
    classifyGroupTypeWithOverrides,
    GROUP_TYPE_LABELS,
    GROUP_TYPE_COLORS,
    groupsByType,
    ALL_GROUP_TYPES,
    type GroupType,
} from "@/lib/group-type-classifier";
import {
    NativeSelect,
    NativeSelectOption,
} from "@/components/ui/native-select";

interface NodeType {
    id: string;
    name: string;
    groups?: string[];
}

interface GraphLegendPanelProps {
    nodes: NodeType[];
    groups: string[];
    selectedGroupFilters: string[];
    onGroupFiltersChange: (filters: string[]) => void;
    selectedPeopleFilters: Set<string>;
    onPeopleFiltersChange: (filters: Set<string>) => void;
    onFocusNode: (nodeId: string) => void;
    className?: string;
    groupTypeOverrides?: Record<string, GroupType> | null;
    onUpdateGroupTypeOverrides?: (overrides: Record<string, GroupType>) => void;
}

type TabId = "people" | "groups" | "types";

export function GraphLegendPanel({
    nodes,
    groups,
    selectedGroupFilters,
    onGroupFiltersChange,
    selectedPeopleFilters,
    onPeopleFiltersChange,
    onFocusNode,
    className,
    groupTypeOverrides,
    onUpdateGroupTypeOverrides,
}: GraphLegendPanelProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [activeTab, setActiveTab] = useState<TabId>("people");
    const [individualSearch, setIndividualSearch] = useState("");
    const [groupSearch, setGroupSearch] = useState("");
    const [customGroupInput, setCustomGroupInput] = useState("");
    const inputRef = useRef<HTMLInputElement>(null);

    // Individual search results
    const filteredNodes = individualSearch.trim()
        ? nodes
            .filter((n) =>
                n.name.toLowerCase().includes(individualSearch.toLowerCase())
            )
            .slice(0, 8)
        : [];

    // Group search results
    const filteredGroups = groupSearch.trim()
        ? groups.filter((g) =>
            g.toLowerCase().includes(groupSearch.toLowerCase())
        )
        : groups;

    // Group type classification (uses overrides when available)
    const typeMap = useMemo(() => groupsByType(groups, groupTypeOverrides), [groups, groupTypeOverrides]);

    // All group types present in the data + their groups
    const presentTypes = useMemo(() => {
        const types: { type: GroupType; label: string; color: string; groups: string[] }[] = [];
        const order: GroupType[] = ["school", "employment", "social", "family", "community", "other"];
        for (const t of order) {
            const gs = typeMap.get(t);
            if (gs && gs.length > 0) {
                types.push({
                    type: t,
                    label: GROUP_TYPE_LABELS[t],
                    color: GROUP_TYPE_COLORS[t],
                    groups: gs,
                });
            }
        }
        return types;
    }, [typeMap]);

    // Determine which types are "selected" (all groups of that type are in the filter)
    const selectedTypes = useMemo(() => {
        const selected = new Set<GroupType>();
        for (const pt of presentTypes) {
            if (pt.groups.length > 0 && pt.groups.every(g => selectedGroupFilters.includes(g))) {
                selected.add(pt.type);
            }
        }
        return selected;
    }, [presentTypes, selectedGroupFilters]);

    const toggleGroupFilter = useCallback(
        (group: string) => {
            if (selectedGroupFilters.includes(group)) {
                onGroupFiltersChange(selectedGroupFilters.filter((g) => g !== group));
            } else {
                onGroupFiltersChange([...selectedGroupFilters, group]);
            }
        },
        [selectedGroupFilters, onGroupFiltersChange]
    );

    const toggleTypeFilter = useCallback(
        (type: GroupType) => {
            const typeEntry = presentTypes.find(pt => pt.type === type);
            if (!typeEntry) return;

            if (selectedTypes.has(type)) {
                // Deselect: remove all groups of this type
                onGroupFiltersChange(
                    selectedGroupFilters.filter(g => !typeEntry.groups.includes(g))
                );
            } else {
                // Select: add all groups of this type (dedup)
                const newFilters = new Set(selectedGroupFilters);
                typeEntry.groups.forEach(g => newFilters.add(g));
                onGroupFiltersChange(Array.from(newFilters));
            }
        },
        [presentTypes, selectedTypes, selectedGroupFilters, onGroupFiltersChange]
    );

    const clearAllFilters = useCallback(() => {
        onGroupFiltersChange([]);
        setGroupSearch("");
        setCustomGroupInput("");
    }, [onGroupFiltersChange]);

    const addCustomGroupFilter = useCallback(() => {
        const name = customGroupInput.trim();
        if (!name) return;
        if (!selectedGroupFilters.includes(name)) {
            onGroupFiltersChange([...selectedGroupFilters, name]);
        }
        setCustomGroupInput("");
    }, [customGroupInput, selectedGroupFilters, onGroupFiltersChange]);

    const togglePersonFilter = useCallback(
        (id: string) => {
            const next = new Set(selectedPeopleFilters);
            if (next.has(id)) {
                next.delete(id);
            } else {
                next.add(id);
            }
            onPeopleFiltersChange(next);
        },
        [selectedPeopleFilters, onPeopleFiltersChange]
    );

    const handleNodeSelect = useCallback(
        (nodeId: string) => {
            // In the new 'Filter' mode, clicking a person toggles their visibility
            togglePersonFilter(nodeId);
            // We can still focus them optionally, but the user requested 'Filter by people'
            onFocusNode(nodeId);
        },
        [togglePersonFilter, onFocusNode]
    );

    const groupCounts = useMemo(() => {
        const counts: Record<string, number> = {};
        for (const node of nodes) {
            if (node.groups) {
                for (const g of node.groups) {
                    counts[g] = (counts[g] || 0) + 1;
                }
            }
        }
        return counts;
    }, [nodes]);

    return (
        <div id="tour-legend" className={cn("absolute bottom-4 left-3 sm:bottom-6 sm:left-6 z-10 flex flex-col items-start gap-2", className)}>
            {/* Expanded Panel */}
            <div
                className={cn(
                    "bg-background/60 backdrop-blur-xl border shadow-lg rounded-xl overflow-hidden transition-all duration-300 origin-bottom-left w-[320px] max-w-[calc(100vw-1.5rem)] sm:max-w-[calc(100vw-3rem)]",
                    isOpen
                        ? "opacity-100 scale-100 mb-2 translate-y-0"
                        : "opacity-0 scale-95 translate-y-4 pointer-events-none absolute bottom-14"
                )}
            >
                {/* Tab Switcher */}
                <div className="flex border-b">
                    {(["people", "groups", "types"] as TabId[]).map((tab) => (
                        <button
                            key={tab}
                            className={cn(
                                "flex-1 py-2.5 text-sm font-medium transition-colors relative",
                                activeTab === tab
                                    ? "text-foreground"
                                    : "text-muted-foreground hover:text-foreground/70"
                            )}
                            onClick={() => {
                                setActiveTab(tab);
                                if (tab === "people") {
                                    setTimeout(() => inputRef.current?.focus(), 50);
                                }
                            }}
                        >
                            {tab === "people" ? "People" : tab === "groups" ? "Groups" : "Types"}
                            {(tab === "groups" && selectedGroupFilters.length > 0) && (
                                <Badge
                                    variant="secondary"
                                    className="ml-1.5 h-5 min-w-5 px-1.5 text-[10px] font-semibold"
                                >
                                    {selectedGroupFilters.length}
                                </Badge>
                            )}
                            {(tab === "people" && selectedPeopleFilters.size > 0) && (
                                <Badge
                                    variant="secondary"
                                    className="ml-1.5 h-5 min-w-5 px-1.5 text-[10px] font-semibold"
                                >
                                    {selectedPeopleFilters.size}
                                </Badge>
                            )}
                            {activeTab === tab && (
                                <div className="absolute bottom-0 left-2 right-2 h-0.5 bg-primary rounded-full" />
                            )}
                        </button>
                    ))}
                </div>

                {/* Tab Content */}
                <div className="min-w-0 overflow-x-hidden p-3">
                    {activeTab === "people" ? (
                        /* People Filter Tab */
                        <div>
                            <div className="relative">
                                <Filter className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
                                <input
                                    ref={inputRef}
                                    id="legend-individual-search"
                                    type="text"
                                    value={individualSearch}
                                    onChange={(e) => setIndividualSearch(e.target.value)}
                                    placeholder="Select people to filter..."
                                    className="w-full py-2 pl-8 pr-8 border rounded-lg text-sm bg-background/60 focus:outline-none focus:ring-1 focus:ring-primary/40 transition-all"
                                />
                                {individualSearch && (
                                    <button
                                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                                        onClick={() => setIndividualSearch("")}
                                    >
                                        <X className="w-3.5 h-3.5" />
                                    </button>
                                )}
                            </div>

                            {/* Selected people badges */}
                            {selectedPeopleFilters.size > 0 && (
                                <div className="flex flex-wrap gap-1.5 mt-2.5">
                                    {Array.from(selectedPeopleFilters).map((id) => {
                                        const name = nodes.find(n => n.id === id)?.name || id;
                                        return (
                                            <Badge
                                                key={id}
                                                variant="secondary"
                                                className="cursor-pointer hover:bg-destructive/20 hover:text-destructive transition-colors text-xs"
                                                onClick={() => togglePersonFilter(id)}
                                            >
                                                {name}
                                                <X className="ml-1 h-3 w-3" />
                                            </Badge>
                                        );
                                    })}
                                    <button
                                        className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2 px-1"
                                        onClick={() => onPeopleFiltersChange(new Set())}
                                    >
                                        Clear
                                    </button>
                                </div>
                            )}

                            <div className="mt-2 max-h-52 overflow-y-auto rounded-lg border bg-background/60">
                                {nodes
                                    .filter((n) => 
                                        !individualSearch || n.name.toLowerCase().includes(individualSearch.toLowerCase())
                                    )
                                    .slice(0, individualSearch ? 50 : 20) // Show more if searching
                                    .map((n) => (
                                        <button
                                            key={n.id}
                                            className={cn(
                                                "w-full flex items-center gap-2.5 px-3 py-2 text-sm hover:bg-accent transition-colors border-b last:border-b-0",
                                                selectedPeopleFilters.has(n.id) && "bg-accent/50"
                                            )}
                                            onClick={() => togglePersonFilter(n.id)}
                                        >
                                            <div
                                                className={cn(
                                                    "w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition-colors",
                                                    selectedPeopleFilters.has(n.id)
                                                        ? "bg-primary border-primary"
                                                        : "border-muted-foreground/40"
                                                )}
                                            >
                                                {selectedPeopleFilters.has(n.id) && (
                                                    <Check className="w-3 h-3 text-primary-foreground" />
                                                )}
                                            </div>
                                            <div className="min-w-0 flex-1 text-left">
                                                <p className="font-medium truncate">{n.name}</p>
                                                {n.groups && n.groups.length > 0 && (
                                                    <p className="text-[10px] text-muted-foreground truncate">
                                                        {n.groups.join(", ")}
                                                    </p>
                                                )}
                                            </div>
                                        </button>
                                    ))
                                }
                            </div>
                        </div>
                    ) : activeTab === "groups" ? (
                        /* Groups Filter Tab */
                        <div>
                            <div className="relative">
                                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
                                <input
                                    id="legend-group-search"
                                    type="text"
                                    value={groupSearch}
                                    onChange={(e) => setGroupSearch(e.target.value)}
                                    placeholder="Search groups..."
                                    className="w-full py-2 pl-8 pr-8 border rounded-lg text-sm bg-background/60 focus:outline-none focus:ring-1 focus:ring-primary/40 transition-all"
                                />
                                {groupSearch && (
                                    <button
                                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                                        onClick={() => setGroupSearch("")}
                                    >
                                        <X className="w-3.5 h-3.5" />
                                    </button>
                                )}
                            </div>

                            {/* Selected group badges */}
                            {selectedGroupFilters.length > 0 && (
                                <div className="flex flex-wrap gap-1.5 mt-2.5">
                                    {selectedGroupFilters.map((g) => (
                                        <Badge
                                            key={g}
                                            variant="secondary"
                                            className="cursor-pointer hover:bg-destructive/20 hover:text-destructive transition-colors text-xs"
                                            onClick={() => toggleGroupFilter(g)}
                                        >
                                            {g}
                                            <X className="ml-1 h-3 w-3" />
                                        </Badge>
                                    ))}
                                    <button
                                        className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2 px-1"
                                        onClick={clearAllFilters}
                                    >
                                        Clear all
                                    </button>
                                </div>
                            )}

                            {/* Group list */}
                            <div className="mt-2.5 max-h-52 overflow-y-auto rounded-lg border bg-background/60">
                                {filteredGroups.length > 0 ? (
                                    filteredGroups.map((g) => (
                                        <button
                                            key={g}
                                            className={cn(
                                                "w-full flex items-center gap-2.5 px-3 py-2 text-sm hover:bg-accent transition-colors border-b last:border-b-0",
                                                selectedGroupFilters.includes(g) && "bg-accent/50"
                                            )}
                                            onClick={() => toggleGroupFilter(g)}
                                        >
                                            <div
                                                className={cn(
                                                    "w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition-colors",
                                                    selectedGroupFilters.includes(g)
                                                        ? "bg-primary border-primary"
                                                        : "border-muted-foreground/40"
                                                )}
                                            >
                                                {selectedGroupFilters.includes(g) && (
                                                    <Check className="w-3 h-3 text-primary-foreground" />
                                                )}
                                            </div>
                                            <span className="truncate flex-1 text-left">{g}</span>
                                            <span className="text-xs text-muted-foreground tabular-nums shrink-0">
                                                {groupCounts[g] || 0}
                                            </span>
                                        </button>
                                    ))
                                ) : (
                                    <div className="px-3 py-3 text-sm text-muted-foreground text-center space-y-2">
                                        <p>
                                            {groups.length === 0
                                                ? "No groups yet"
                                                : "No groups match your search"}
                                        </p>
                                        {groups.length === 0 && (
                                            <div className="flex flex-col gap-2 pt-1 text-left">
                                                <label className="text-[11px] text-muted-foreground">
                                                    Add a filter by name (e.g. before you tag contacts):
                                                </label>
                                                <div className="flex gap-2">
                                                    <input
                                                        type="text"
                                                        value={customGroupInput}
                                                        onChange={(e) => setCustomGroupInput(e.target.value)}
                                                        onKeyDown={(e) => {
                                                            if (e.key === "Enter") {
                                                                e.preventDefault();
                                                                addCustomGroupFilter();
                                                            }
                                                        }}
                                                        placeholder="Group name"
                                                        className="flex-1 min-w-0 py-1.5 px-2 text-sm border rounded-md bg-background"
                                                    />
                                                    <Button
                                                        type="button"
                                                        size="sm"
                                                        variant="secondary"
                                                        className="shrink-0 h-8"
                                                        disabled={!customGroupInput.trim()}
                                                        onClick={addCustomGroupFilter}
                                                    >
                                                        Add
                                                    </Button>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    ) : (
                        /* Types Filter Tab */
                        <div>
                            <p className="text-xs text-muted-foreground mb-2.5">
                                Auto-classified by group name keywords
                            </p>

                            {/* Selected type badges */}
                            {selectedGroupFilters.length > 0 && (
                                <div className="flex flex-wrap gap-1.5 mb-2.5">
                                    {Array.from(selectedTypes).map((t) => (
                                        <Badge
                                            key={t}
                                            variant="secondary"
                                            className="cursor-pointer hover:bg-destructive/20 hover:text-destructive transition-colors text-xs"
                                            style={{ borderLeft: `3px solid ${GROUP_TYPE_COLORS[t]}` }}
                                            onClick={() => toggleTypeFilter(t)}
                                        >
                                            {GROUP_TYPE_LABELS[t]}
                                            <X className="ml-1 h-3 w-3" />
                                        </Badge>
                                    ))}
                                    {selectedGroupFilters.length > 0 && (
                                        <button
                                            className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2 px-1"
                                            onClick={clearAllFilters}
                                        >
                                            Clear all
                                        </button>
                                    )}
                                </div>
                            )}

                            {/* Type list */}
                            <div className="max-h-64 overflow-y-auto rounded-lg border bg-background/60">
                                {presentTypes.length > 0 ? (
                                    presentTypes.map((pt) => {
                                        const preview = pt.groups.slice(0, 3);
                                        const remaining = pt.groups.length - preview.length;
                                        return (
                                        <button
                                            key={pt.type}
                                            className={cn(
                                                "w-full flex items-center gap-2.5 px-3 py-2.5 text-sm hover:bg-accent transition-colors border-b last:border-b-0",
                                                selectedTypes.has(pt.type) && "bg-accent/50"
                                            )}
                                            onClick={() => toggleTypeFilter(pt.type)}
                                        >
                                            <div
                                                className={cn(
                                                    "w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition-colors",
                                                    selectedTypes.has(pt.type)
                                                        ? "border-transparent"
                                                        : "border-muted-foreground/40"
                                                )}
                                                style={selectedTypes.has(pt.type) ? { backgroundColor: pt.color, borderColor: pt.color } : undefined}
                                            >
                                                {selectedTypes.has(pt.type) && (
                                                    <Check className="w-3 h-3 text-white" />
                                                )}
                                            </div>
                                            <div
                                                className="w-2.5 h-2.5 rounded-full shrink-0"
                                                style={{ backgroundColor: pt.color }}
                                            />
                                            <div className="flex-1 text-left min-w-0">
                                                <div className="truncate">{pt.label}</div>
                                                <div className="text-[10px] text-muted-foreground truncate">
                                                    {preview.join(", ")}
                                                    {remaining > 0 ? ` +${remaining} more` : ""}
                                                </div>
                                            </div>
                                            <span className="text-xs text-muted-foreground tabular-nums shrink-0">
                                                {pt.groups.length} {pt.groups.length === 1 ? "group" : "groups"}
                                            </span>
                                        </button>
                                    )})
                                ) : (
                                    <div className="px-3 py-3 text-sm text-muted-foreground text-center">
                                        No groups to classify
                                    </div>
                                )}
                            </div>

                            {/* Show which groups belong to each selected type */}
                            {selectedTypes.size > 0 && (
                                <div className="mt-2 space-y-1.5">
                                    {Array.from(selectedTypes).map((t) => {
                                        const pt = presentTypes.find(p => p.type === t);
                                        if (!pt) return null;
                                        return (
                                            <div key={t} className="text-xs text-muted-foreground">
                                                <span className="font-medium" style={{ color: pt.color }}>
                                                    {pt.label}:
                                                </span>{" "}
                                                {pt.groups.join(", ")}
                                            </div>
                                        );
                                    })}
                                </div>
                            )}

                            {/* Group type reassignment editor */}
                            {onUpdateGroupTypeOverrides && (
                                <div className="mt-3 pt-3 border-t">
                                    <p className="text-xs text-muted-foreground">
                                        Manage group type assignments in <span className="font-medium">Settings</span>.
                                    </p>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* FAB Trigger */}
            <Button
                id="legend-toggle-button"
                variant="outline"
                size="icon"
                className={cn(
                    "w-10 h-10 sm:w-12 sm:h-12 rounded-full shadow-lg bg-background/60 backdrop-blur-xl border hover:bg-accent/80 transition-all duration-300",
                    isOpen
                        ? "rotate-90 bg-accent text-accent-foreground border-primary/50"
                        : ""
                )}
                onClick={() => {
                    setIsOpen(!isOpen);
                    if (!isOpen && activeTab === "people") {
                        setTimeout(() => inputRef.current?.focus(), 100);
                    }
                }}
            >
                <Filter className="w-5 h-5" />
            </Button>
        </div>
    );
}
