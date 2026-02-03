
import prisma from "@/lib/prisma";

/**
 * Updates inferred links for a specific contact based on the "Shared Group" rule.
 * 
 * Rules:
 * 1. If two contacts share the same non-null group, create an inferred link.
 * 2. Manual links take precedence (if a manual link exists, do not create inferred).
 * 3. Inferred links are bidirectional in concept, but stored as directed. We will create one if missing.
 *    (Actually, force-directed graphs often treat links as undirected unless specified. 
 *     We will standardize on creating one link per pair to avoid clutter, e.g., Low ID -> High ID).
 * 4. Cleaning up: If the group changes, old inferred links for "shared_group" should be removed.
 */
export async function updateInferredLinks(contactId: string) {
    const contact = await prisma.contact.findUnique({
        where: { id: contactId },
        select: { id: true, groups: true, ownerId: true }
    });

    if (!contact || !contact.groups || contact.groups.length === 0) {
        // If no groups, remove all "shared_group" inferred links for this contact
        await prisma.link.deleteMany({
            where: {
                OR: [
                    { fromId: contactId },
                    { toId: contactId }
                ],
                label: "shared_group",
                metadata: {
                    path: ["source"],
                    equals: "inferred"
                }
            }
        });
        return;
    }

    const { groups, ownerId } = contact;

    // 1. Find all potential target contacts (matches ANY group)
    // We can't easily do "find contacts where groups array contains any of my groups" in one simple query without array overlap operators which might vary by DB.
    // However, Prisma supports basic array filtering. `groups: { hasSome: [...] }`
    const sameGroupContacts = await prisma.contact.findMany({
        where: {
            ownerId: ownerId,
            groups: { hasSome: groups },
            id: { not: contactId } // Exclude self
        },
        select: { id: true, groups: true }
    });

    // 2. We need to manage links PER GROUP.
    // Strategy:
    // A. Identify all valid (ContactB, SharedGroup) pairs.
    // B. Reconcile with existing links.

    const validLinks = new Set<string>(); // "otherId:groupName"

    for (const other of sameGroupContacts) {
        // Find shared groups between contact and other
        const shared = groups.filter(g => other.groups.includes(g));
        for (const g of shared) {
            validLinks.add(`${other.id}:${g}`);
        }
    }

    // 3. Delete invalid inferred links
    // Fetch all existing inferred links for this contact
    const existingInferred = await prisma.link.findMany({
        where: {
            OR: [
                { fromId: contactId },
                { toId: contactId }
            ],
            label: "shared_group",
            metadata: {
                path: ["source"],
                equals: "inferred"
            }
        }
    });

    for (const link of existingInferred) {
        const otherId = link.fromId === contactId ? link.toId : link.fromId;
        const group = (link.metadata as any)?.group;

        if (group && !validLinks.has(`${otherId}:${group}`)) {
            // This specific link (for this group) is no longer valid
            await prisma.link.delete({ where: { id: link.id } });
        } else if (!group) {
            // Legacy or malformed inferred link (no group in metadata), remove it to be safe or update it?
            // Safest to remove and let it regenerate.
            await prisma.link.delete({ where: { id: link.id } });
        }
    }

    // 4. Create missing links
    for (const linkKey of Array.from(validLinks)) {
        const [otherId, groupName] = linkKey.split(":");

        // Check for MANUAL link first ( Manual takes precedence over ALL inferred links between these two?
        // User said: "manual links must always take precedence".
        // Use case: If I manually link A and B with "Known from Gym", do I still want an inferred link "Shared Group: Gym"?
        // Usually, if a manual link exists, we suppress inferred links to avoid noise.
        // So if ANY manual link exists between A and B, we skip creating inferred links.

        const existingManual = await prisma.link.findFirst({
            where: {
                OR: [
                    { fromId: contactId, toId: otherId },
                    { fromId: otherId, toId: contactId }
                ],
                // Manual links do NOT have metadata.source === 'inferred'
                NOT: {
                    metadata: {
                        path: ["source"],
                        equals: "inferred"
                    }
                }
            }
        });

        if (existingManual) continue;

        // Check if specific inferred link exists
        // We look for an inferred link with this specific GROUP in metadata
        const existingSpecific = existingInferred.find(l =>
            (l.fromId === otherId || l.toId === otherId) &&
            (l.metadata as any)?.group === groupName
        );

        if (existingSpecific) continue;

        // Create new inferred link
        // Maintain consistent direction
        const [from, to] = [contactId, otherId].sort();

        await prisma.link.create({
            data: {
                fromId: from,
                toId: to,
                label: "shared_group",
                weight: 1.0,
                // Store the group name in metadata so we can distinguish multiple links
                metadata: { source: "inferred", rule: "shared_group", group: groupName }
            }
        });
    }
}
