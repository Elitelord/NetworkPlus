import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';
dotenv.config();

const prisma = new PrismaClient();

const EMAIL = process.argv[2];

if (!EMAIL) {
    console.error('Usage: npx tsx scripts/delete-account.ts <email>');
    process.exit(1);
}

async function main() {
    console.log(`Looking up user with email: ${EMAIL}`);

    const user = await prisma.user.findUnique({
        where: { email: EMAIL },
        include: {
            contacts: { select: { id: true } },
            reminders: { select: { id: true } },
            accounts: { select: { id: true } },
            sessions: { select: { id: true } },
        },
    });

    if (!user) {
        console.error(`No user found with email: ${EMAIL}`);
        process.exit(1);
    }

    console.log(`Found user: ${user.name} (${user.id})`);
    console.log(`  - ${user.contacts.length} contacts`);
    console.log(`  - ${user.reminders.length} reminders`);
    console.log(`  - ${user.accounts.length} linked accounts`);
    console.log(`  - ${user.sessions.length} sessions`);

    const contactIds = user.contacts.map(c => c.id);

    console.log('\nDeleting account and all associated data...');

    await prisma.$transaction(async (tx) => {
        // 1. Delete links where the user's contacts are either 'from' or 'to'
        if (contactIds.length > 0) {
            const linkResult = await tx.link.deleteMany({
                where: {
                    OR: [
                        { fromId: { in: contactIds } },
                        { toId: { in: contactIds } },
                    ],
                },
            });
            console.log(`  Deleted ${linkResult.count} links`);
        }

        // 2. Delete reminders belonging to the user
        const reminderResult = await tx.reminder.deleteMany({
            where: { userId: user.id },
        });
        console.log(`  Deleted ${reminderResult.count} reminders`);

        // 3. Delete interactions associated with the user's contacts
        // Interactions have an implicit many-to-many with Contact,
        // so we need to disconnect and clean up orphaned interactions
        if (contactIds.length > 0) {
            // Find interactions linked to this user's contacts
            const interactions = await tx.interaction.findMany({
                where: { contacts: { some: { id: { in: contactIds } } } },
                select: { id: true, contacts: { select: { id: true } } },
            });

            for (const interaction of interactions) {
                // If all contacts on this interaction belong to this user, delete it
                const allContactsBelongToUser = interaction.contacts.every(c => contactIds.includes(c.id));
                if (allContactsBelongToUser) {
                    await tx.interaction.delete({ where: { id: interaction.id } });
                } else {
                    // Otherwise, just disconnect this user's contacts
                    await tx.interaction.update({
                        where: { id: interaction.id },
                        data: {
                            contacts: {
                                disconnect: contactIds.map(id => ({ id })),
                            },
                        },
                    });
                }
            }
            console.log(`  Processed ${interactions.length} interactions`);
        }

        // 4. Delete contacts belonging to the user
        const contactResult = await tx.contact.deleteMany({
            where: { ownerId: user.id },
        });
        console.log(`  Deleted ${contactResult.count} contacts`);

        // 5. Delete the user (Account and Session cascade automatically)
        await tx.user.delete({
            where: { id: user.id },
        });
        console.log(`  Deleted user`);
    });

    console.log(`\n✅ Account ${EMAIL} has been fully deleted.`);
}

main()
    .catch((e) => {
        console.error('Error deleting account:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
