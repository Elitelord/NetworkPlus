"use client";

import { useState, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Search, X, Check } from "lucide-react";
import { cn } from "@/lib/utils";

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
    onFocusNode: (nodeId: string) => void;
}

export function GraphLegendPanel({
    nodes,
    groups,
    selectedGroupFilters,
    onGroupFiltersChange,
    onFocusNode,
}: GraphLegendPanelProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [activeTab, setActiveTab] = useState<"individual" | "groups">("individual");
    const [individualSearch, setIndividualSearch] = useState("");
    const [groupSearch, setGroupSearch] = useState("");
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

    const clearAllFilters = useCallback(() => {
        onGroupFiltersChange([]);
        setGroupSearch("");
    }, [onGroupFiltersChange]);

    const handleNodeSelect = useCallback(
        (nodeId: string) => {
            onFocusNode(nodeId);
            setIndividualSearch("");
        },
        [onFocusNode]
    );

    // Count contacts per group
    const groupCounts = groups.reduce<Record<string, number>>((acc, g) => {
        acc[g] = nodes.filter(
            (n) => n.groups?.includes(g)
        ).length;
        return acc;
    }, {});

    return (
        <div className="absolute bottom-6 left-6 z-10 flex flex-col items-start gap-2">
            {/* Expanded Panel */}
            <div
                className={cn(
                    "bg-background/60 backdrop-blur-lg border shadow-lg rounded-xl overflow-hidden transition-all duration-300 origin-bottom-left",
                    isOpen
                        ? "opacity-100 scale-100 mb-2 translate-y-0"
                        : "opacity-0 scale-95 translate-y-4 pointer-events-none absolute bottom-14"
                )}
                style={{ width: 320 }}
            >
                {/* Tab Switcher */}
                <div className="flex border-b">
                    <button
                        className={cn(
                            "flex-1 py-2.5 text-sm font-medium transition-colors relative",
                            activeTab === "individual"
                                ? "text-foreground"
                                : "text-muted-foreground hover:text-foreground/70"
                        )}
                        onClick={() => {
                            setActiveTab("individual");
                            setTimeout(() => inputRef.current?.focus(), 50);
                        }}
                    >
                        Individual
                        {activeTab === "individual" && (
                            <div className="absolute bottom-0 left-2 right-2 h-0.5 bg-primary rounded-full" />
                        )}
                    </button>
                    <button
                        className={cn(
                            "flex-1 py-2.5 text-sm font-medium transition-colors relative",
                            activeTab === "groups"
                                ? "text-foreground"
                                : "text-muted-foreground hover:text-foreground/70"
                        )}
                        onClick={() => setActiveTab("groups")}
                    >
                        Groups
                        {selectedGroupFilters.length > 0 && (
                            <Badge
                                variant="secondary"
                                className="ml-1.5 h-5 min-w-5 px-1.5 text-[10px] font-semibold"
                            >
                                {selectedGroupFilters.length}
                            </Badge>
                        )}
                        {activeTab === "groups" && (
                            <div className="absolute bottom-0 left-2 right-2 h-0.5 bg-primary rounded-full" />
                        )}
                    </button>
                </div>

                {/* Tab Content */}
                <div className="p-3">
                    {activeTab === "individual" ? (
                        /* Individual Search Tab */
                        <div>
                            <div className="relative">
                                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
                                <input
                                    ref={inputRef}
                                    id="legend-individual-search"
                                    type="text"
                                    value={individualSearch}
                                    onChange={(e) => setIndividualSearch(e.target.value)}
                                    placeholder="Search contacts..."
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
                            {individualSearch.trim() !== "" && (
                                <div className="mt-2 max-h-52 overflow-y-auto rounded-lg border bg-background/60">
                                    {filteredNodes.length > 0 ? (
                                        filteredNodes.map((n) => (
                                            <button
                                                key={n.id}
                                                className="w-full text-left px-3 py-2 text-sm hover:bg-accent transition-colors border-b last:border-b-0"
                                                onClick={() => handleNodeSelect(n.id)}
                                            >
                                                <p className="font-medium truncate">{n.name}</p>
                                                {n.groups && n.groups.length > 0 && (
                                                    <p className="text-xs text-muted-foreground truncate">
                                                        {n.groups.join(", ")}
                                                    </p>
                                                )}
                                            </button>
                                        ))
                                    ) : (
                                        <div className="px-3 py-3 text-sm text-muted-foreground text-center">
                                            No contacts found
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    ) : (
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
                                    <div className="px-3 py-3 text-sm text-muted-foreground text-center">
                                        {groups.length === 0
                                            ? "No groups yet"
                                            : "No groups match your search"}
                                    </div>
                                )}
                            </div>
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
                    "w-12 h-12 rounded-full shadow-lg bg-background hover:bg-accent transition-all duration-300",
                    isOpen
                        ? "rotate-90 bg-accent text-accent-foreground border-primary/50"
                        : ""
                )}
                onClick={() => {
                    setIsOpen(!isOpen);
                    if (!isOpen && activeTab === "individual") {
                        setTimeout(() => inputRef.current?.focus(), 100);
                    }
                }}
            >
                <Search className="w-5 h-5" />
            </Button>
        </div>
    );
}
