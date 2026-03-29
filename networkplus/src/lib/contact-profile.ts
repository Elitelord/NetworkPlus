import { z } from "zod";

/** Max serialized JSON size for `Contact.profile` (bytes). */
export const PROFILE_MAX_BYTES = 32 * 1024;

/** Max entries per prior-employment / prior-education list. */
export const PROFILE_MAX_PRIOR_ENTRIES = 20;

/** Max concurrent current employers (e.g. board + day job). */
export const PROFILE_MAX_CURRENT_EMPLOYERS = 10;

const yearSchema = z
  .union([z.number().int().min(1800).max(2100), z.null()])
  .optional();

const priorCompanySchema = z.object({
  organization: z.string().max(500).trim().min(1),
  role: z.union([z.string().max(200).trim(), z.null()]).optional(),
  startYear: yearSchema,
  endYear: yearSchema,
  notes: z.union([z.string().max(1000).trim(), z.null()]).optional(),
});

const priorEducationSchema = z.object({
  institution: z.string().max(500).trim().min(1),
  degree: z.union([z.string().max(200).trim(), z.null()]).optional(),
  startYear: yearSchema,
  endYear: yearSchema,
  notes: z.union([z.string().max(1000).trim(), z.null()]).optional(),
});

const backfillMarkerSchema = z
  .object({
    groupsMigratedAt: z.string().max(100).optional(),
    version: z.number().int().optional(),
  })
  .optional();

export const contactProfileSchema = z.object({
  version: z.number().int().min(1).max(100).optional(),
  city: z.union([z.string().max(500).trim(), z.null()]).optional(),
  currentCompany: z.union([z.string().max(500).trim(), z.null()]).optional(),
  /** Additional / multiple current employers; inference dedupes with `currentCompany`. */
  currentCompanies: z
    .array(z.string().max(500))
    .max(PROFILE_MAX_CURRENT_EMPLOYERS)
    .nullable()
    .optional(),
  currentSchool: z.union([z.string().max(500).trim(), z.null()]).optional(),
  priorCompanies: z.array(priorCompanySchema).max(PROFILE_MAX_PRIOR_ENTRIES).optional(),
  priorEducation: z.array(priorEducationSchema).max(PROFILE_MAX_PRIOR_ENTRIES).optional(),
  backfill: backfillMarkerSchema,
});

export type ContactProfile = z.infer<typeof contactProfileSchema>;

/** Partial patch: `null` clears a scalar; arrays replace when present. */
export const contactProfilePatchSchema = contactProfileSchema.partial();

export type ContactProfilePatch = z.infer<typeof contactProfilePatchSchema>;

export const INFERRED_LINK_RULES = [
  "shared_group",
  "shared_current_company",
  "shared_current_school",
  "shared_prior_company",
  "shared_prior_school",
] as const;

export type InferredLinkRule = (typeof INFERRED_LINK_RULES)[number];

/**
 * Normalize for matching inferred edges: trim, collapse whitespace, lowercase.
 */
export function normalizeInferenceKey(raw: string): string {
  return raw
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

export function parseContactProfile(value: unknown): ContactProfile | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== "object" || Array.isArray(value)) return null;
  const r = contactProfileSchema.safeParse(value);
  return r.success ? r.data : null;
}

function profileToStorable(profile: ContactProfile): Record<string, unknown> {
  const o: Record<string, unknown> = { ...profile };
  for (const k of Object.keys(o)) {
    if (o[k] === undefined) delete o[k];
  }
  return o;
}

export function assertProfileByteSize(profile: ContactProfile): void {
  const json = JSON.stringify(profileToStorable(profile));
  if (json.length > PROFILE_MAX_BYTES) {
    throw new Error(`Profile exceeds maximum size (${PROFILE_MAX_BYTES} bytes)`);
  }
}

/**
 * Merge server-side profile patch into existing (null clears scalars).
 */
export function mergeContactProfile(
  existing: ContactProfile | null,
  patchRaw: unknown
): { ok: true; profile: ContactProfile } | { ok: false; error: string } {
  const patchParsed = contactProfilePatchSchema.safeParse(patchRaw);
  if (!patchParsed.success) {
    return { ok: false, error: patchParsed.error.message };
  }
  const patch = patchParsed.data;
  const base: ContactProfile = existing ? { ...existing } : { version: 1 };

  if (patch.version !== undefined) base.version = patch.version;
  if (patch.backfill !== undefined) base.backfill = patch.backfill;

  const applyScalar = (key: "city" | "currentCompany" | "currentSchool") => {
    if (!(key in patch)) return;
    const v = patch[key];
    if (v === null) {
      Reflect.deleteProperty(base, key);
      return;
    }
    if (typeof v === "string") {
      const t = v.trim();
      if (t.length === 0) Reflect.deleteProperty(base, key);
      else Object.assign(base, { [key]: t });
    }
  };
  applyScalar("city");
  applyScalar("currentCompany");
  applyScalar("currentSchool");

  if (patch.currentCompanies !== undefined) {
    if (patch.currentCompanies === null) {
      delete base.currentCompanies;
    } else if (patch.currentCompanies.length === 0) {
      delete base.currentCompanies;
    } else {
      const cleaned = patch.currentCompanies
        .map((s) => (typeof s === "string" ? s.trim() : ""))
        .filter((s) => s.length > 0)
        .slice(0, PROFILE_MAX_CURRENT_EMPLOYERS);
      if (cleaned.length === 0) delete base.currentCompanies;
      else base.currentCompanies = cleaned;
    }
  }

  if (patch.priorCompanies !== undefined) {
    if (patch.priorCompanies === null || patch.priorCompanies.length === 0) {
      delete base.priorCompanies;
    } else {
      base.priorCompanies = patch.priorCompanies;
    }
  }
  if (patch.priorEducation !== undefined) {
    if (patch.priorEducation === null || patch.priorEducation.length === 0) {
      delete base.priorEducation;
    } else {
      base.priorEducation = patch.priorEducation;
    }
  }

  const validated = contactProfileSchema.safeParse(
    JSON.parse(JSON.stringify(base)) as unknown
  );
  if (!validated.success) {
    return { ok: false, error: validated.error.message };
  }
  try {
    assertProfileByteSize(validated.data);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Profile too large" };
  }
  return { ok: true, profile: validated.data };
}

export function profileToPrismaJson(
  profile: ContactProfile | null
): Record<string, unknown> | undefined {
  if (!profile || Object.keys(profileToStorable(profile)).length === 0) {
    return undefined;
  }
  return profileToStorable(profile) as Record<string, unknown>;
}

export type ProfileAffinity = {
  rule: InferredLinkRule;
  /** Canonical key for edge identity */
  key: string;
  /** Display string on link */
  label: string;
};

/**
 * Current employers for display / inference: uses `currentCompanies` when set, else legacy `currentCompany`.
 * Dedupes by normalized key; preserves first-seen label casing.
 */
export function getCurrentEmployerLabels(profile: ContactProfile | null | undefined): string[] {
  if (!profile) return [];
  const seen = new Set<string>();
  const labels: string[] = [];
  const push = (raw: string) => {
    const t = raw.trim();
    if (!t) return;
    const key = normalizeInferenceKey(t);
    if (!key || seen.has(key)) return;
    seen.add(key);
    labels.push(t);
  };
  for (const s of profile.currentCompanies ?? []) {
    if (typeof s === "string") push(s);
  }
  if (profile.currentCompany) push(profile.currentCompany);
  return labels;
}

export function getProfileAffinities(
  profile: ContactProfile | null,
  includePrior: boolean
): ProfileAffinity[] {
  const out: ProfileAffinity[] = [];
  if (!profile) return out;

  for (const label of getCurrentEmployerLabels(profile)) {
    const key = normalizeInferenceKey(label);
    if (key) out.push({ rule: "shared_current_company", key, label });
  }
  const cs = profile.currentSchool?.trim();
  if (cs) {
    const key = normalizeInferenceKey(cs);
    if (key) out.push({ rule: "shared_current_school", key, label: cs });
  }

  if (includePrior) {
    for (const p of profile.priorCompanies ?? []) {
      const org = p.organization?.trim();
      if (!org) continue;
      const key = normalizeInferenceKey(org);
      if (key) out.push({ rule: "shared_prior_company", key, label: org });
    }
    for (const p of profile.priorEducation ?? []) {
      const inst = p.institution?.trim();
      if (!inst) continue;
      const key = normalizeInferenceKey(inst);
      if (key) out.push({ rule: "shared_prior_school", key, label: inst });
    }
  }

  return out;
}

/** Stable tuple for inferred link identity (sorted contact ids). */
export function makeInferredAffinityKey(
  idA: string,
  idB: string,
  rule: string,
  affinityKey: string
): string {
  const [a, b] = [idA, idB].sort();
  return JSON.stringify([a, b, rule, affinityKey]);
}

export function parseInferredAffinityKey(
  stored: string
): { a: string; b: string; rule: string; affinityKey: string } | null {
  try {
    const arr = JSON.parse(stored) as unknown;
    if (!Array.isArray(arr)) return null;
    if (arr.length === 3) {
      const [a, b, g] = arr;
      if (
        typeof a === "string" &&
        typeof b === "string" &&
        typeof g === "string"
      ) {
        return { a, b, rule: "shared_group", affinityKey: g };
      }
      return null;
    }
    if (arr.length === 4) {
      const [a, b, rule, k] = arr;
      if (
        typeof a === "string" &&
        typeof b === "string" &&
        typeof rule === "string" &&
        typeof k === "string"
      ) {
        return { a, b, rule, affinityKey: k };
      }
    }
    return null;
  } catch {
    return null;
  }
}

/** Rebuild tuple key from a persisted Link row. */
export function inferredLinkRowToAffinityKey(link: {
  fromId: string;
  toId: string;
  metadata: unknown;
}): string | null {
  const m = link.metadata as Record<string, unknown> | null;
  if (!m || typeof m !== "object") return null;
  const rule = m.rule;
  if (
    typeof rule !== "string" ||
    !(INFERRED_LINK_RULES as readonly string[]).includes(rule)
  ) {
    return null;
  }
  const [x, y] = [link.fromId, link.toId].sort();
  if (rule === "shared_group") {
    const g = m.group;
    if (typeof g !== "string") return null;
    return makeInferredAffinityKey(x, y, rule, g);
  }
  const ak = m.affinityKey;
  if (typeof ak === "string") {
    return makeInferredAffinityKey(x, y, rule, ak);
  }
  const g = m.group;
  if (typeof g === "string") {
    return makeInferredAffinityKey(
      x,
      y,
      rule,
      rule === "shared_group" ? g : normalizeInferenceKey(g)
    );
  }
  return null;
}

export function buildInferredLinkMetadata(
  rule: InferredLinkRule,
  affinityKey: string,
  label: string
): Record<string, unknown> {
  if (rule === "shared_group") {
    return { rule, source: "inferred" as const, group: label };
  }
  return {
    rule,
    source: "inferred" as const,
    group: label,
    affinityKey,
  };
}