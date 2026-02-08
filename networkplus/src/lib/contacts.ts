import { prisma } from "@lib/prisma";

/**
 * Fetches contacts that haven't been interacted with in the last `thresholdDays` days.
 * @param userId - The ID of the user requesting the contacts.
 * @param thresholdDays - The number of days since the last interaction to consider a contact "due soon". Default is 30.
 * @returns A list of contacts.
 */
export async function getDueSoonContacts(userId: string, thresholdDays: number = 30) {
    const thresholdDate = new Date();
    thresholdDate.setDate(thresholdDate.getDate() - thresholdDays);

    const contacts = await prisma.contact.findMany({
        where: {
            ownerId: userId,
            OR: [
                {
                    lastInteractionAt: {
                        lt: thresholdDate,
                    },
                },
                {
                    lastInteractionAt: null,
                },
            ],
        },
        orderBy: {
            // Sort by last interaction date ascending (oldest interaction first - i.e. most overdue)
            lastInteractionAt: 'asc',
        },
        include: {
            // Optional: Include latest interaction to show "Last spoke on..."
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
