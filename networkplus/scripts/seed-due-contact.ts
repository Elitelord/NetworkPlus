import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';
dotenv.config();

const prisma = new PrismaClient();

async function main() {
    const args = process.argv.slice(2);
    const contactName = args[0];

    if (!contactName) {
        console.error("Please provide a contact name.");
        console.log("Usage: npx tsx scripts/seed-due-contact.ts \"Contact Name\"");
        process.exit(1);
    }

    // Find contact
    const contact = await prisma.contact.findFirst({
        where: { name: contactName }
    });

    if (!contact) {
        console.error(`Contact "${contactName}" not found.`);
        process.exit(1);
    }

    // Set date to 40 days ago
    const pastDate = new Date();
    pastDate.setDate(pastDate.getDate() - 40);

    const updated = await prisma.contact.update({
        where: { id: contact.id },
        data: { lastInteractionAt: pastDate }
    });

    console.log(`Updated "${updated.name}" lastInteractionAt to ${updated.lastInteractionAt?.toISOString()}`);
    console.log("This contact should now appear in the 'Due Soon' list.");
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
