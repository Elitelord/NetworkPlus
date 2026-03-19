"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import {
  ALL_GROUP_TYPES,
  GROUP_TYPE_COLORS,
  GROUP_TYPE_LABELS,
  classifyGroupType,
  classifyGroupTypeWithOverrides,
  type GroupType,
} from "@/lib/group-type-classifier";
import { updateGroupTypeOverrides } from "@/app/settings/actions";

interface GroupTypeOverridesEditorProps {
  groups: string[];
  initialOverrides: Record<string, GroupType> | null;
}

export function GroupTypeOverridesEditor({ groups, initialOverrides }: GroupTypeOverridesEditorProps) {
  const [overrides, setOverrides] = useState<Record<string, GroupType>>(initialOverrides ?? {});
  const [query, setQuery] = useState("");
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<{ ok?: string; err?: string } | null>(null);

  const filteredGroups = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return groups;
    return groups.filter((g) => g.toLowerCase().includes(q));
  }, [groups, query]);

  const persist = async (next: Record<string, GroupType>) => {
    setSaving(true);
    setStatus(null);
    try {
      const res = await updateGroupTypeOverrides(next as any);
      if ((res as any)?.error) {
        setStatus({ err: (res as any).error });
      } else {
        setStatus({ ok: "Saved" });
      }
    } finally {
      setSaving(false);
    }
  };

  const setGroupType = (group: string, newType: GroupType) => {
    const autoType = classifyGroupType(group);
    setOverrides((prev) => {
      const next = { ...prev };
      if (newType === autoType) {
        delete next[group];
      } else {
        next[group] = newType;
      }
      void persist(next);
      return next;
    });
  };

  const resetGroup = (group: string) => {
    setOverrides((prev) => {
      if (!(group in prev)) return prev;
      const next = { ...prev };
      delete next[group];
      void persist(next);
      return next;
    });
  };

  return (
    <div className="space-y-3 rounded-lg border p-4">
      <p className="text-sm text-muted-foreground">
        Group types are auto-classified from the group name. You can override any group here.
        These overrides affect default estimated frequency and type-based filtering.
      </p>

      <Input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search groups..."
      />

      <div className="max-h-[340px] overflow-y-auto rounded-md border bg-background">
        {filteredGroups.length === 0 ? (
          <div className="p-3 text-sm text-muted-foreground text-center">No groups match your search</div>
        ) : (
          filteredGroups.map((g) => {
            const current = classifyGroupTypeWithOverrides(g, overrides);
            const isOverridden = g in overrides;
            return (
              <div key={g} className="flex flex-col sm:flex-row items-start sm:items-center gap-3 px-3 py-3 border-b last:border-b-0 min-w-0">
                <div className="flex items-center gap-2 min-w-0 flex-1 w-full">
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: GROUP_TYPE_COLORS[current] }}
                    title={GROUP_TYPE_LABELS[current]}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium truncate" title={g}>{g}</div>
                    <div className="text-[10px] text-muted-foreground uppercase tracking-wider">
                      Auto: {GROUP_TYPE_LABELS[classifyGroupType(g)]}
                      {isOverridden ? " • overridden" : ""}
                    </div>
                  </div>

                  {isOverridden && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-[10px] shrink-0"
                      disabled={saving}
                      onClick={() => resetGroup(g)}
                    >
                      Reset
                    </Button>
                  )}
                </div>

                <div className="w-full sm:w-[160px] shrink-0">
                  <NativeSelect
                    value={current}
                    onChange={(e) => setGroupType(g, e.target.value as GroupType)}
                    size="sm"
                    disabled={saving}
                    className="h-8 text-xs w-full"
                  >
                    {ALL_GROUP_TYPES.map((t) => (
                      <NativeSelectOption key={t} value={t}>
                        {GROUP_TYPE_LABELS[t]}
                      </NativeSelectOption>
                    ))}
                  </NativeSelect>
                </div>
              </div>
            );
          })
        )}
      </div>

      <div className="flex items-center justify-between">
        <div className="text-xs text-muted-foreground">
          {saving ? "Saving…" : status?.ok ? status.ok : status?.err ? status.err : ""}
        </div>
        <div className="text-xs text-muted-foreground">
          {Object.keys(overrides).length} override{Object.keys(overrides).length === 1 ? "" : "s"}
        </div>
      </div>
    </div>
  );
}

