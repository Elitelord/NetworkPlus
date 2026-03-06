import { prisma } from "@/lib/prisma";
import { STRENGTH_THRESHOLD } from "@/lib/strength-scoring";
import { Category } from "@prisma/client";

/**
 * Fetches contacts whose strengthScore is below the STRENGTH_THRESHOLD.
 * These are contacts the user should consider catching up with.
 * @param userId - The ID of the user requesting the contacts.
 * @param filters - Optional filters to restrict the contacts.
 * @returns A list of contacts ordered by weakest strength first.
 */
export async function getDueSoonContacts(userId: string, filters?: {
    groups?: string[];
    categories?: string[];
    contactIds?: string[];
}) {
    const whereClause: any = {
        ownerId: userId,
        strengthScore: {
            lt: STRENGTH_THRESHOLD,
        },
    };

    if (filters) {
        const orConditions = [];
        if (filters.groups && filters.groups.length > 0) {
            orConditions.push({ groups: { hasSome: filters.groups } });
        }
        if (filters.categories && filters.categories.length > 0) {
            orConditions.push({ category: { in: filters.categories as Category[] } });
        }
        if (filters.contactIds && filters.contactIds.length > 0) {
            orConditions.push({ id: { in: filters.contactIds } });
        }

        if (orConditions.length > 0) {
            whereClause.OR = orConditions;
        }
    }

    const contacts = await prisma.contact.findMany({
        where: whereClause,
        orderBy: {
            strengthScore: 'asc',
        },
        include: {
            interactions: {
                orderBy: {
                    date: 'desc'
                },
                take: 1
            }
        }
    });

    return contacts;
}
