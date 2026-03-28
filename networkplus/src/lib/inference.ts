import prisma from "@lib/prisma";
import type { Prisma } from "@prisma/client";
import {
  getProfileAffinities,
  makeInferredAffinityKey,
  inferredLinkRowToAffinityKey,
  buildInferredLinkMetadata,
  parseContactProfile,
  type InferredLinkRule,
  INFERRED_LINK_RULES,
} from "@/lib/contact-profile";

/**
 * Updates inferred links for a specific contact based on shared groups and profile affinities.
 */
export async function updateInferredLinks(contactId: string) {
  return updateInferredLinksBulk([contactId]);
}

const INFERENCE_CHUNK_SIZE = 200;
const INFERENCE_CREATE_BATCH_SIZE = 1000;

function isInferredRule(rule: string): rule is InferredLinkRule {
  return (INFERRED_LINK_RULES as readonly string[]).includes(rule);
}

type Affinity = { rule: InferredLinkRule; key: string; label: string };

function groupAffinities(groups: string[]): Affinity[] {
  return (groups || []).map((g) => ({
    rule: "shared_group" as const,
    key: g,
    label: g,
  }));
}

function contactAffinities(
  groups: string[],
  profile: unknown,
  includePriorProfile: boolean
): Affinity[] {
  const list: Affinity[] = groupAffinities(groups || []);
  const parsed = parseContactProfile(profile);
  list.push(...getProfileAffinities(parsed, includePriorProfile));
  return list;
}

function affinityMatchKey(a: Affinity): string {
  return `${a.rule}\0${a.key}`;
}

/**
 * Updates inferred links for multiple contacts efficiently.
 */
export async function updateInferredLinksBulk(contactIds: string[]) {
  if (contactIds.length === 0) return;

  const chunks: string[][] = [];
  for (let i = 0; i < contactIds.length; i += INFERENCE_CHUNK_SIZE) {
    chunks.push(contactIds.slice(i, i + INFERENCE_CHUNK_SIZE));
  }

  for (const chunk of chunks) {
    await updateInferredLinksBulkChunk(chunk);
  }
}

async function updateInferredLinksBulkChunk(contactIds: string[]) {
  if (contactIds.length === 0) return;

  const contacts = await prisma.contact.findMany({
    where: { id: { in: contactIds } },
    select: { id: true, groups: true, profile: true, ownerId: true },
  });

  if (contacts.length === 0) return;

  const ownerId = contacts[0].ownerId;
  const allAffectedContactIds = new Set(contacts.map((c) => c.id));

  const user = await prisma.user.findUnique({
    where: { id: ownerId },
    select: { inferenceIncludePriorAffiliations: true },
  });
  const includePriorProfile = user?.inferenceIncludePriorAffiliations === true;

  const allOwnerContacts = await prisma.contact.findMany({
    where: { ownerId },
    select: { id: true, groups: true, profile: true },
  });

  const affinitiesById = new Map<string, Affinity[]>();
  for (const c of allOwnerContacts) {
    affinitiesById.set(
      c.id,
      contactAffinities(c.groups || [], c.profile, includePriorProfile)
    );
  }

  const validLinkKeys = new Set<string>();

  for (const source of contacts) {
    const sourceAff = affinitiesById.get(source.id) || [];
    if (sourceAff.length === 0) continue;

    for (const target of allOwnerContacts) {
      if (source.id === target.id) continue;
      const targetAff = affinitiesById.get(target.id) || [];
      if (targetAff.length === 0) continue;

      const targetKeys = new Set(targetAff.map(affinityMatchKey));
      for (const sa of sourceAff) {
        if (targetKeys.has(affinityMatchKey(sa))) {
          const [a, b] = [source.id, target.id].sort();
          validLinkKeys.add(makeInferredAffinityKey(a, b, sa.rule, sa.key));
        }
      }
    }
  }

  const existingInferred = await prisma.link.findMany({
    where: {
      AND: [
        {
          OR: [
            { fromId: { in: Array.from(allAffectedContactIds) } },
            { toId: { in: Array.from(allAffectedContactIds) } },
          ],
        },
        {
          OR: INFERRED_LINK_RULES.map((rule) => ({
            metadata: { path: ["rule"], equals: rule },
          })),
        },
      ],
    },
  });

  const linksToDelete: string[] = [];
  const existingLinkMap = new Set<string>();

  for (const link of existingInferred) {
    const tupleKey = inferredLinkRowToAffinityKey(link);
    const isAffected =
      allAffectedContactIds.has(link.fromId) ||
      allAffectedContactIds.has(link.toId);

    if (!isAffected) continue;

    if (!tupleKey) {
      linksToDelete.push(link.id);
      continue;
    }

    const meta = link.metadata as { rule?: string } | null;
    const rule = meta?.rule;
    if (typeof rule !== "string" || !isInferredRule(rule)) {
      linksToDelete.push(link.id);
      continue;
    }

    if (validLinkKeys.has(tupleKey)) {
      existingLinkMap.add(tupleKey);
    } else {
      linksToDelete.push(link.id);
    }
  }

  if (linksToDelete.length > 0) {
    await prisma.link.deleteMany({
      where: { id: { in: linksToDelete } },
    });
  }

  const linksToCreate: {
    fromId: string;
    toId: string;
    label: string;
    weight: number;
    metadata: Prisma.InputJsonValue;
  }[] = [];

  for (const linkKey of validLinkKeys) {
    if (existingLinkMap.has(linkKey)) continue;

    const parsed = JSON.parse(linkKey) as [string, string, string, string];
    const [fromId, toId, rule, affinityKey] = parsed;
    if (!isInferredRule(rule)) continue;

    const aAffs = affinitiesById.get(fromId) || [];
    const label =
      aAffs.find((x) => x.rule === rule && x.key === affinityKey)?.label ??
      affinityKey;

    linksToCreate.push({
      fromId,
      toId,
      label,
      weight: 1.0,
      metadata: buildInferredLinkMetadata(rule, affinityKey, label) as Prisma.InputJsonValue,
    });
  }

  if (linksToCreate.length > 0) {
    for (let i = 0; i < linksToCreate.length; i += INFERENCE_CREATE_BATCH_SIZE) {
      const batch = linksToCreate.slice(i, i + INFERENCE_CREATE_BATCH_SIZE);
      await prisma.$transaction(batch.map((data) => prisma.link.create({ data })));
    }
  }
}

/**
 * Recompute all inferred links for every contact owned by the user (e.g. after toggling prior-affiliation inference).
 */
export async function updateInferredLinksForOwner(ownerId: string) {
  const ids = await prisma.contact.findMany({
    where: { ownerId },
    select: { id: true },
  });
  await updateInferredLinksBulk(ids.map((c) => c.id));
}
