"use client";

import type { ContactProfile } from "@/lib/contact-profile";
import { getCurrentEmployerLabels } from "@/lib/contact-profile";

function hasProfileContent(profile: ContactProfile | null | undefined): boolean {
  if (!profile) return false;
  if (profile.city?.trim()) return true;
  if (getCurrentEmployerLabels(profile).length > 0) return true;
  if (profile.currentSchool?.trim()) return true;
  if ((profile.priorCompanies?.length ?? 0) > 0) return true;
  if ((profile.priorEducation?.length ?? 0) > 0) return true;
  return false;
}

export function ContactProfileSummary({
  profile,
}: {
  profile: ContactProfile | null | undefined;
}) {
  if (!hasProfileContent(profile)) return null;

  const employers = getCurrentEmployerLabels(profile ?? null);
  const school = profile?.currentSchool?.trim();
  const city = profile?.city?.trim();
  const priorCo = profile?.priorCompanies?.filter((p) => p.organization?.trim()) ?? [];
  const priorEd = profile?.priorEducation?.filter((p) => p.institution?.trim()) ?? [];

  return (
    <div className="mb-5 rounded-lg border border-border/70 bg-muted/30 px-3 py-2.5 text-sm">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
        Profile
      </h3>
      <dl className="space-y-2 text-sm">
        {city && (
          <div className="flex gap-2 min-w-0">
            <dt className="text-muted-foreground shrink-0 w-20">City</dt>
            <dd className="font-medium min-w-0 break-words">{city}</dd>
          </div>
        )}
        {employers.length > 0 && (
          <div className="flex gap-2 min-w-0 items-start">
            <dt className="text-muted-foreground shrink-0 w-20 pt-0.5">
              {employers.length > 1 ? "Employers" : "Employer"}
            </dt>
            <dd className="min-w-0 flex-1">
              <ul className="list-disc pl-4 space-y-0.5 font-medium break-words">
                {employers.map((e) => (
                  <li key={e}>{e}</li>
                ))}
              </ul>
            </dd>
          </div>
        )}
        {school && (
          <div className="flex gap-2 min-w-0">
            <dt className="text-muted-foreground shrink-0 w-20">School</dt>
            <dd className="font-medium min-w-0 break-words">{school}</dd>
          </div>
        )}
        {priorCo.length > 0 && (
          <div className="flex gap-2 min-w-0 items-start">
            <dt className="text-muted-foreground shrink-0 w-20 text-[11px] leading-tight pt-0.5">
              Prior work
            </dt>
            <dd className="min-w-0 flex-1 text-xs text-muted-foreground line-clamp-2">
              {priorCo.slice(0, 3).map((p) => p.organization.trim()).join(" · ")}
              {priorCo.length > 3 ? ` · +${priorCo.length - 3} more` : ""}
            </dd>
          </div>
        )}
        {priorEd.length > 0 && (
          <div className="flex gap-2 min-w-0 items-start">
            <dt className="text-muted-foreground shrink-0 w-20 text-[11px] leading-tight pt-0.5">
              Prior school
            </dt>
            <dd className="min-w-0 flex-1 text-xs text-muted-foreground line-clamp-2">
              {priorEd.slice(0, 3).map((p) => p.institution.trim()).join(" · ")}
              {priorEd.length > 3 ? ` · +${priorEd.length - 3} more` : ""}
            </dd>
          </div>
        )}
      </dl>
      <p className="mt-2 text-[10px] text-muted-foreground">
        Edit contact to change profile fields.
      </p>
    </div>
  );
}
