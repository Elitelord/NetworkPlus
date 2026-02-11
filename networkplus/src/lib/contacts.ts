import { prisma } from "@lib/prisma";
import { STRENGTH_THRESHOLD } from "@/lib/strength-scoring";

/**
 * Fetches contacts whose strengthScore is below the STRENGTH_THRESHOLD.
 * These are contacts the user should consider catching up with.
 * @param userId - The ID of the user requesting the contacts.
 * @returns A list of contacts ordered by weakest strength first.
 */
export async function getDueSoonContacts(userId: string) {
    const contacts = await prisma.contact.findMany({
        where: {
            ownerId: userId,
            strengthScore: {
                lt: STRENGTH_THRESHOLD,
            },
        },
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
