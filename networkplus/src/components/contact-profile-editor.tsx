"use client";

import {
  useEffect,
  useImperativeHandle,
  forwardRef,
  useState,
} from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ContactProfile } from "@/lib/contact-profile";
import {
  PROFILE_MAX_PRIOR_ENTRIES,
  PROFILE_MAX_CURRENT_EMPLOYERS,
  getCurrentEmployerLabels,
} from "@/lib/contact-profile";

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

export type ContactProfileEditorRef = {
  /** Patch payload for `PATCH /api/contacts/:id` `{ profile: patch }`. */
  getProfilePatch: () => Record<string, unknown>;
};

type Props = {
  profileKey: string;
  profile: ContactProfile | null | undefined;
  open: boolean;
  onPatchChange?: (patch: Record<string, unknown>) => void;
};

function initialEmployerLines(profile: ContactProfile | null | undefined): string[] {
  const labels = getCurrentEmployerLabels(profile ?? null);
  return labels.length > 0 ? labels : [""];
}

export const ContactProfileEditor = forwardRef<ContactProfileEditorRef, Props>(
  function ContactProfileEditor({ profileKey, profile, open, onPatchChange }, ref) {
    const [city, setCity] = useState(() => profile?.city?.trim() ?? "");
    const [employerLines, setEmployerLines] = useState(() =>
      initialEmployerLines(profile)
    );
    const [currentSchool, setCurrentSchool] = useState(
      () => profile?.currentSchool?.trim() ?? ""
    );
    const [priorCompanies, setPriorCompanies] = useState<PriorCompany[]>(() =>
      profile?.priorCompanies?.length
        ? profile.priorCompanies.map((p) => ({ ...p }))
        : []
    );
    const [priorEducation, setPriorEducation] = useState<PriorEdu[]>(() =>
      profile?.priorEducation?.length
        ? profile.priorEducation.map((p) => ({ ...p }))
        : []
    );

    // Re-sync when opening the dialog or switching contacts. Do not resync while editing.
    useEffect(() => {
      if (!open) return;
      setCity(profile?.city?.trim() ?? "");
      setEmployerLines(initialEmployerLines(profile));
      setCurrentSchool(profile?.currentSchool?.trim() ?? "");
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
      // We intentionally avoid `profile` in deps to prevent in-progress edit resets from parent refetches.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [profileKey, open]);

    const buildPatch = (): Record<string, unknown> => {
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

      const employers = employerLines
        .map((s) => s.trim())
        .filter((s) => s.length > 0)
        .slice(0, PROFILE_MAX_CURRENT_EMPLOYERS);

      let currentCompany: string | null;
      let currentCompanies: string[] | null;
      if (employers.length === 0) {
        currentCompany = null;
        currentCompanies = null;
      } else if (employers.length === 1) {
        currentCompany = employers[0]!;
        currentCompanies = null;
      } else {
        currentCompany = null;
        currentCompanies = employers;
      }

      return {
        city: city.trim() ? city.trim() : null,
        currentCompany,
        currentCompanies,
        currentSchool: currentSchool.trim() ? currentSchool.trim() : null,
        priorCompanies: pc,
        priorEducation: pe,
      };
    };

    useImperativeHandle(
      ref,
      () => ({
        getProfilePatch: () => buildPatch(),
      }),
      [city, employerLines, currentSchool, priorCompanies, priorEducation]
    );

    useEffect(() => {
      if (!onPatchChange) return;
      onPatchChange(buildPatch());
    }, [onPatchChange, city, employerLines, currentSchool, priorCompanies, priorEducation]);

    return (
      <div className="border rounded-lg p-3 space-y-4">
        <div className="text-sm font-medium">Profile</div>
        <p className="text-[11px] text-muted-foreground -mt-2">
          City, employers (add several if they have multiple jobs), school, and history.
        </p>

        <div className="grid grid-cols-1 gap-3">
          <div className="space-y-1">
            <Label htmlFor={`ed-city-${profileKey}`} className="text-xs">
              City
            </Label>
            <Input
              id={`ed-city-${profileKey}`}
              value={city}
              onChange={(e) => setCity(e.target.value)}
              className="h-8 text-sm"
              placeholder="City"
            />
          </div>

          <div className="space-y-2">
            <Label className="text-xs">Current employer(s)</Label>
            {employerLines.map((line, i) => (
              <div key={i} className="flex gap-2">
                <Input
                  value={line}
                  onChange={(e) => {
                    const next = [...employerLines];
                    next[i] = e.target.value;
                    setEmployerLines(next);
                  }}
                  className="h-8 text-sm flex-1"
                  placeholder={
                    i === 0 ? "Company or organization" : "Additional employer"
                  }
                />
                {employerLines.length > 1 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8 shrink-0 px-2"
                    onClick={() =>
                      setEmployerLines(employerLines.filter((_, j) => j !== i))
                    }
                  >
                    Remove
                  </Button>
                )}
              </div>
            ))}
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 text-xs"
              disabled={employerLines.length >= PROFILE_MAX_CURRENT_EMPLOYERS}
              onClick={() => setEmployerLines([...employerLines, ""])}
            >
              Add another employer
            </Button>
          </div>

          <div className="space-y-1">
            <Label htmlFor={`ed-sch-${profileKey}`} className="text-xs">
              Current school
            </Label>
            <Input
              id={`ed-sch-${profileKey}`}
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
      </div>
    );
  }
);
