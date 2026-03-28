import prisma from "@lib/prisma";
import type { Prisma } from "@prisma/client";
import {
  classifyGroupTypeWithOverrides,
  type GroupType,
} from "@/lib/group-type-classifier";
import { mergeContactProfile, parseContactProfile } from "@/lib/contact-profile";

export type ProfileBackfillResult = {
  updated: number;
  skipped: number;
};

/**
 * Best-effort profile fill from `groups` (via group-type classifier) and flat `metadata` keys.
 * Idempotent: only fills empty profile slots; sets `backfill` marker.
 */
export async function backfillContactProfilesForUser(
  userId: string,
  opts: { dryRun?: boolean } = {}
): Promise<ProfileBackfillResult> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { groupTypeOverrides: true },
  });
  const overrides =
    (user?.groupTypeOverrides as Record<string, GroupType> | null) ?? null;

  const contacts = await prisma.contact.findMany({
    where: { ownerId: userId },
    select: { id: true, groups: true, metadata: true, profile: true },
  });

  let updated = 0;
  let skipped = 0;
  const updatedContactIds: string[] = [];

  for (const c of contacts) {
    const existing = parseContactProfile(c.profile);
    const patch: Record<string, unknown> = {};

    const meta =
      c.metadata &&
      typeof c.metadata === "object" &&
      !Array.isArray(c.metadata)
        ? (c.metadata as Record<string, unknown>)
        : {};

    const tryMetaKeys = (
      keys: string[],
      field: "city" | "currentCompany" | "currentSchool"
    ) => {
      if (existing?.[field]) return;
      for (const k of keys) {
        const v = meta[k];
        if (typeof v === "string" && v.trim()) {
          patch[field] = v.trim().slice(0, 500);
          return;
        }
      }
    };

    tryMetaKeys(
      ["company", "currentCompany", "employer", "work", "workplace"],
      "currentCompany"
    );
    tryMetaKeys(
      ["school", "currentSchool", "university", "college", "education"],
      "currentSchool"
    );
    tryMetaKeys(["city", "location", "hometown"], "city");

    const gs = c.groups || [];
    let firstEmployment: string | undefined;
    let firstSchool: string | undefined;
    for (const g of gs) {
      const t = classifyGroupTypeWithOverrides(g, overrides);
      if (t === "employment" && !firstEmployment) firstEmployment = g;
      if (t === "school" && !firstSchool) firstSchool = g;
    }

    if (
      firstEmployment &&
      !existing?.currentCompany &&
      patch.currentCompany === undefined
    ) {
      patch.currentCompany = firstEmployment.slice(0, 500);
    }
    if (
      firstSchool &&
      !existing?.currentSchool &&
      patch.currentSchool === undefined
    ) {
      patch.currentSchool = firstSchool.slice(0, 500);
    }

    if (Object.keys(patch).length === 0) {
      skipped++;
      continue;
    }

    patch.backfill = {
      ...(existing?.backfill ?? {}),
      groupsMigratedAt: new Date().toISOString(),
      version: 1,
    };

    const merged = mergeContactProfile(existing, patch);
    if (!merged.ok) {
      skipped++;
      continue;
    }

    if (!opts.dryRun) {
      await prisma.contact.update({
        where: { id: c.id },
        data: { profile: merged.profile as Prisma.InputJsonValue },
      });
      updatedContactIds.push(c.id);
    }
    updated++;
  }

  if (!opts.dryRun && updatedContactIds.length > 0) {
    const { updateInferredLinksBulk } = await import("@/lib/inference");
    await updateInferredLinksBulk(updatedContactIds);
  }

  return { updated, skipped };
}
