"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ContactProfile } from "@/lib/contact-profile";
import { PROFILE_MAX_PRIOR_ENTRIES } from "@/lib/contact-profile";

type PriorCompany = NonNullable<ContactProfile["priorCompanies"]>[number];
type PriorEdu = NonNullable<ContactProfile["priorEducation"]>[number];

const emptyCompany = (): PriorCompany => ({
  organization: "",
  role: undefined,
  startYear: undefined,
  endYear: undefined,
  notes: undefined,
});

const emptyEdu = (): PriorEdu => ({
  institution: "",
  degree: undefined,
  startYear: undefined,
  endYear: undefined,
  notes: undefined,
});

export function ContactProfileSection({
  contactId,
  profile,
  onSave,
}: {
  contactId: string;
  profile: ContactProfile | null | undefined;
  onSave: (patch: Record<string, unknown>) => Promise<void>;
}) {
  const [city, setCity] = useState("");
  const [currentCompany, setCurrentCompany] = useState("");
  const [currentSchool, setCurrentSchool] = useState("");
  const [priorCompanies, setPriorCompanies] = useState<PriorCompany[]>([]);
  const [priorEducation, setPriorEducation] = useState<PriorEdu[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setCity(profile?.city ?? "");
    setCurrentCompany(profile?.currentCompany ?? "");
    setCurrentSchool(profile?.currentSchool ?? "");
    setPriorCompanies(
      profile?.priorCompanies?.length
        ? profile.priorCompanies.map((p) => ({ ...p }))
        : []
    );
    setPriorEducation(
      profile?.priorEducation?.length
        ? profile.priorEducation.map((p) => ({ ...p }))
        : []
    );
    setError(null);
  }, [contactId, profile]);

  async function handleSave() {
    setError(null);
    setSaving(true);
    try {
      const pc = priorCompanies
        .map((p) => ({
          organization: p.organization.trim(),
          role: p.role?.trim() || undefined,
          startYear: p.startYear ?? undefined,
          endYear: p.endYear ?? undefined,
          notes: p.notes?.trim() || undefined,
        }))
        .filter((p) => p.organization.length > 0)
        .slice(0, PROFILE_MAX_PRIOR_ENTRIES);

      const pe = priorEducation
        .map((p) => ({
          institution: p.institution.trim(),
          degree: p.degree?.trim() || undefined,
          startYear: p.startYear ?? undefined,
          endYear: p.endYear ?? undefined,
          notes: p.notes?.trim() || undefined,
        }))
        .filter((p) => p.institution.length > 0)
        .slice(0, PROFILE_MAX_PRIOR_ENTRIES);

      await onSave({
        city: city.trim() ? city.trim() : null,
        currentCompany: currentCompany.trim() ? currentCompany.trim() : null,
        currentSchool: currentSchool.trim() ? currentSchool.trim() : null,
        priorCompanies: pc,
        priorEducation: pe,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4 mb-6 pb-6 border-b border-border">
      <h3 className="font-semibold text-sm">Profile</h3>
      {error && (
        <p className="text-xs text-destructive">{error}</p>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label htmlFor={`cp-city-${contactId}`} className="text-xs">
            City
          </Label>
          <Input
            id={`cp-city-${contactId}`}
            value={city}
            onChange={(e) => setCity(e.target.value)}
            className="h-8 text-sm"
            placeholder="City"
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor={`cp-co-${contactId}`} className="text-xs">
            Current company
          </Label>
          <Input
            id={`cp-co-${contactId}`}
            value={currentCompany}
            onChange={(e) => setCurrentCompany(e.target.value)}
            className="h-8 text-sm"
            placeholder="Employer"
          />
        </div>
        <div className="space-y-1 sm:col-span-2">
          <Label htmlFor={`cp-sch-${contactId}`} className="text-xs">
            Current school
          </Label>
          <Input
            id={`cp-sch-${contactId}`}
            value={currentSchool}
            onChange={(e) => setCurrentSchool(e.target.value)}
            className="h-8 text-sm"
            placeholder="School or university"
          />
        </div>
      </div>

      <div className="space-y-2">
        <span className="text-xs font-medium text-muted-foreground">
          Prior employers (max {PROFILE_MAX_PRIOR_ENTRIES})
        </span>
        {priorCompanies.map((row, i) => (
          <div
            key={i}
            className="grid grid-cols-1 gap-2 rounded-md border border-border/60 p-2"
          >
            <Input
              value={row.organization}
              onChange={(e) => {
                const next = [...priorCompanies];
                next[i] = { ...next[i], organization: e.target.value };
                setPriorCompanies(next);
              }}
              className="h-8 text-sm"
              placeholder="Organization"
            />
            <div className="grid grid-cols-2 gap-2">
              <Input
                value={row.role ?? ""}
                onChange={(e) => {
                  const next = [...priorCompanies];
                  next[i] = { ...next[i], role: e.target.value || undefined };
                  setPriorCompanies(next);
                }}
                className="h-8 text-sm"
                placeholder="Role (optional)"
              />
              <div className="flex gap-1">
                <Input
                  type="number"
                  value={row.startYear ?? ""}
                  onChange={(e) => {
                    const next = [...priorCompanies];
                    const v = e.target.value;
                    next[i] = {
                      ...next[i],
                      startYear: v ? parseInt(v, 10) : undefined,
                    };
                    setPriorCompanies(next);
                  }}
                  className="h-8 text-sm"
                  placeholder="From"
                />
                <Input
                  type="number"
                  value={row.endYear ?? ""}
                  onChange={(e) => {
                    const next = [...priorCompanies];
                    const v = e.target.value;
                    next[i] = {
                      ...next[i],
                      endYear: v ? parseInt(v, 10) : undefined,
                    };
                    setPriorCompanies(next);
                  }}
                  className="h-8 text-sm"
                  placeholder="To"
                />
              </div>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 text-xs"
              onClick={() =>
                setPriorCompanies(priorCompanies.filter((_, j) => j !== i))
              }
            >
              Remove
            </Button>
          </div>
        ))}
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 text-xs"
          disabled={priorCompanies.length >= PROFILE_MAX_PRIOR_ENTRIES}
          onClick={() =>
            setPriorCompanies([...priorCompanies, emptyCompany()])
          }
        >
          Add prior employer
        </Button>
      </div>

      <div className="space-y-2">
        <span className="text-xs font-medium text-muted-foreground">
          Prior education (max {PROFILE_MAX_PRIOR_ENTRIES})
        </span>
        {priorEducation.map((row, i) => (
          <div
            key={i}
            className="grid grid-cols-1 gap-2 rounded-md border border-border/60 p-2"
          >
            <Input
              value={row.institution}
              onChange={(e) => {
                const next = [...priorEducation];
                next[i] = { ...next[i], institution: e.target.value };
                setPriorEducation(next);
              }}
              className="h-8 text-sm"
              placeholder="Institution"
            />
            <div className="grid grid-cols-2 gap-2">
              <Input
                value={row.degree ?? ""}
                onChange={(e) => {
                  const next = [...priorEducation];
                  next[i] = { ...next[i], degree: e.target.value || undefined };
                  setPriorEducation(next);
                }}
                className="h-8 text-sm"
                placeholder="Degree (optional)"
              />
              <div className="flex gap-1">
                <Input
                  type="number"
                  value={row.startYear ?? ""}
                  onChange={(e) => {
                    const next = [...priorEducation];
                    const v = e.target.value;
                    next[i] = {
                      ...next[i],
                      startYear: v ? parseInt(v, 10) : undefined,
                    };
                    setPriorEducation(next);
                  }}
                  className="h-8 text-sm"
                  placeholder="From"
                />
                <Input
                  type="number"
                  value={row.endYear ?? ""}
                  onChange={(e) => {
                    const next = [...priorEducation];
                    const v = e.target.value;
                    next[i] = {
                      ...next[i],
                      endYear: v ? parseInt(v, 10) : undefined,
                    };
                    setPriorEducation(next);
                  }}
                  className="h-8 text-sm"
                  placeholder="To"
                />
              </div>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 text-xs"
              onClick={() =>
                setPriorEducation(priorEducation.filter((_, j) => j !== i))
              }
            >
              Remove
            </Button>
          </div>
        ))}
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 text-xs"
          disabled={priorEducation.length >= PROFILE_MAX_PRIOR_ENTRIES}
          onClick={() => setPriorEducation([...priorEducation, emptyEdu()])}
        >
          Add prior school
        </Button>
      </div>

      <Button
        type="button"
        size="sm"
        disabled={saving}
        onClick={() => void handleSave()}
      >
        {saving ? "Saving…" : "Save profile"}
      </Button>
    </div>
  );
}
