"use client";

import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { X, Loader2, Plus, Search, Check } from "lucide-react";
import { updateUserGroups } from "@/app/settings/actions";
import { toast } from "sonner";
import { 
  ALL_GROUP_TYPES, 
  GROUP_TYPE_LABELS, 
  GROUP_TYPE_COLORS, 
  type GroupType 
} from "@/lib/group-type-classifier";
import { cn } from "@/lib/utils";

interface UserGroupsEditorProps {
  initialGroups: string[];
  availableGroupsWithType?: { name: string; type: GroupType }[];
}

export function UserGroupsEditor({ initialGroups, availableGroupsWithType = [] }: UserGroupsEditorProps) {
  const [groups, setGroups] = useState<string[]>(initialGroups);
  const [inputValue, setInputValue] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedType, setSelectedType] = useState<GroupType | "all">("all");
  const [saving, setSaving] = useState(false);

  const handleAddGroup = (groupName: string) => {
    const trimmed = groupName.trim();
    if (trimmed && !groups.includes(trimmed)) {
      setGroups([...groups, trimmed]);
      setInputValue("");
    }
  };

  const handleRemoveGroup = (group: string) => {
    setGroups(groups.filter((g) => g !== group));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await updateUserGroups(groups);
      if (res.error) {
        toast.error(res.error);
      } else {
        toast.success("Your groups updated successfully");
      }
    } catch (error) {
      toast.error("Failed to update groups");
    } finally {
      setSaving(false);
    }
  };

  const filteredAvailable = useMemo(() => {
    return availableGroupsWithType.filter((g) => {
      const matchesSearch = g.name.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesType = selectedType === "all" || g.type === selectedType;
      const notAlreadyIn = !groups.includes(g.name);
      return matchesSearch && matchesType && notAlreadyIn;
    });
  }, [availableGroupsWithType, searchQuery, selectedType, groups]);

  return (
    <div className="space-y-6 rounded-lg border p-6 bg-card">
      <div className="space-y-1">
        <h3 className="text-lg font-semibold">Your Shared Groups</h3>
        <p className="text-sm text-muted-foreground">
          Define groups you belong to. When a contact shares these groups, interaction frequency analysis treats them as closer connections (e.g. colleagues at the same company).
        </p>
      </div>

      <div className="space-y-3">
        <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Your Selected Groups</label>
        <div className="flex flex-wrap gap-2 min-h-[50px] max-h-40 overflow-y-auto p-3 rounded-md border bg-muted/30 scrollbar-thin scrollbar-thumb-muted">
          {groups.length === 0 ? (
            <span className="text-sm text-muted-foreground italic">No groups selected yet...</span>
          ) : (
            groups.map((group) => {
              const info = availableGroupsWithType.find(g => g.name === group);
              const color = info ? GROUP_TYPE_COLORS[info.type] : undefined;
              return (
                <Badge 
                  key={group} 
                  variant="secondary" 
                  className="pl-3 pr-1.5 py-1 gap-2 text-sm font-medium"
                >
                  <span className="flex items-center gap-1.5">
                    {color && <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: color }} />}
                    <span className="truncate max-w-[150px]">{group}</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => handleRemoveGroup(group)}
                    className="hover:bg-muted-foreground/20 rounded-full p-0.5 transition-colors shrink-0"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              );
            })
          )}
        </div>
      </div>

      <div className="space-y-4 pt-4 border-t">
        <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
          <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Add from your Contacts</label>
          <div className="flex flex-wrap gap-1">
            <Button
              variant={selectedType === "all" ? "secondary" : "ghost"}
              size="sm"
              className="h-7 text-[10px] px-2"
              onClick={() => setSelectedType("all")}
            >
              All
            </Button>
            {ALL_GROUP_TYPES.map(type => (
              <Button
                key={type}
                variant={selectedType === type ? "secondary" : "ghost"}
                size="sm"
                className="h-7 text-[10px] px-2"
                onClick={() => setSelectedType(type)}
              >
                {GROUP_TYPE_LABELS[type]}
              </Button>
            ))}
          </div>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search through contact groups..."
            className="pl-9 h-10"
          />
        </div>

        <div className="max-h-48 overflow-y-auto rounded-md border bg-background/50 scrollbar-thin scrollbar-thumb-muted">
          {filteredAvailable.length === 0 ? (
            <div className="p-4 text-center text-sm text-muted-foreground italic">
              {searchQuery ? "No matching groups found" : "No more groups to add from your contacts"}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-1 p-2">
              {filteredAvailable.map((g) => (
                <button
                  key={g.name}
                  onClick={() => handleAddGroup(g.name)}
                  className="flex items-center gap-2 p-2 rounded-md hover:bg-accent hover:text-accent-foreground text-left transition-colors text-sm group min-w-0"
                >
                  <span 
                    className="w-2.5 h-2.5 rounded-full shrink-0" 
                    style={{ backgroundColor: GROUP_TYPE_COLORS[g.type] }} 
                  />
                  <span className="truncate flex-1 min-w-0">{g.name}</span>
                  <Plus className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex gap-2">
          <Input
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), handleAddGroup(inputValue))}
            placeholder="Or type a custom group name..."
            className="h-10"
          />
          <Button
            type="button"
            onClick={() => handleAddGroup(inputValue)}
            disabled={!inputValue.trim()}
          >
            Add Custom
          </Button>
        </div>
      </div>

      <div className="flex justify-end pt-6 border-t">
        <Button
          type="button"
          size="lg"
          onClick={handleSave}
          disabled={saving || JSON.stringify(groups.sort()) === JSON.stringify(initialGroups.sort())}
          className="min-w-[150px]"
        >
          {saving ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Check className="mr-2 h-4 w-4" />
          )}
          Save Changes
        </Button>
      </div>
    </div>
  );
}
