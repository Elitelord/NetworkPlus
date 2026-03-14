
import prisma from "@lib/prisma";

/**
 * Updates inferred links for a specific contact based on the "Shared Group" rule.
 */
export async function updateInferredLinks(contactId: string) {
    return updateInferredLinksBulk([contactId]);
}

/**
 * Updates inferred links for multiple contacts efficiently.
 */
export async function updateInferredLinksBulk(contactIds: string[]) {
    if (contactIds.length === 0) return;

    // 1. Fetch all involved contacts
    const contacts = await prisma.contact.findMany({
        where: { id: { in: contactIds } },
        select: { id: true, groups: true, ownerId: true }
    });

    if (contacts.length === 0) return;

    // group by owner to handle multi-user scenarios if necessary, 
    // though usually one request is for one user.
    const ownerId = contacts[0].ownerId;
    const allAffectedContactIds = new Set(contacts.map(c => c.id));

    // 2. For each contact, identify what groups they are in
    const contactGroupsMap = new Map<string, string[]>();
    const allGroupsInvolved = new Set<string>();

    contacts.forEach(c => {
        const gs = c.groups || [];
        contactGroupsMap.set(c.id, gs);
        gs.forEach(g => allGroupsInvolved.add(g));
    });

    // 3. Find ALL contacts in the database that share ANY of these groups
    // This is much faster than doing it per-contact.
    const potentialTargets = await prisma.contact.findMany({
        where: {
            ownerId: ownerId,
            groups: { hasSome: Array.from(allGroupsInvolved) }
        },
        select: { id: true, groups: true }
    });

    // 4. Determine valid links that SHOULD exist
    // Link key format: "LowID:HighID:GroupName"
    const validLinkKeys = new Set<string>();

    // We only need to check links where at least one side is in our `contactIds` list
    for (const source of contacts) {
        const sourceGroups = contactGroupsMap.get(source.id) || [];
        if (sourceGroups.length === 0) continue;

        for (const target of potentialTargets) {
            if (source.id === target.id) continue;

            const shared = sourceGroups.filter(g => target.groups.includes(g));
            for (const g of shared) {
                const [a, b] = [source.id, target.id].sort();
                validLinkKeys.add(`${a}:${b}:${g}`);
            }
        }
    }

    // 5. Fetch existing shared_group links for these contacts
    const existingInferred = await prisma.link.findMany({
        where: {
            OR: [
                { fromId: { in: Array.from(allAffectedContactIds) } },
                { toId: { in: Array.from(allAffectedContactIds) } }
            ],
            label: "shared_group"
        }
    });

    // 6. Partition existing links: stay, delete, or ignore (if unrelated to our current targets)
    const linksToDelete: string[] = [];
    const existingLinkMap = new Set<string>(); // "LowID:HighID:GroupName"

    for (const link of existingInferred) {
        const meta = link.metadata as any;
        const group = meta?.group;
        const [a, b] = [link.fromId, link.toId].sort();
        const key = `${a}:${b}:${group}`;

        // If one of the contacts is in our updated list, we must validate it
        const isAffected = allAffectedContactIds.has(link.fromId) || allAffectedContactIds.has(link.toId);
        
        if (isAffected) {
            if (group && validLinkKeys.has(key)) {
                existingLinkMap.add(key);
            } else {
                linksToDelete.push(link.id);
            }
        }
    }

    // 7. Perform Deletions
    if (linksToDelete.length > 0) {
        await prisma.link.deleteMany({
            where: { id: { in: linksToDelete } }
        });
    }

    // 8. Create Missing Links
    const linksToCreate = [];
    for (const linkKey of validLinkKeys) {
        if (existingLinkMap.has(linkKey)) continue;

        const [fromId, toId, groupName] = linkKey.split(":");

        linksToCreate.push({
            fromId,
            toId,
            label: "shared_group",
            weight: 1.0,
            metadata: { rule: "shared_group", group: groupName }
        });
    }

    if (linksToCreate.length > 0) {
        // Prisma doesn't support createMany with Json metadata easily in some versions/providers without workaround,
        // but since we are usually creating a moderate amount, loop is fine, or use transaction.
        await prisma.$transaction(
            linksToCreate.map(data => prisma.link.create({ data }))
        );
    }
}
