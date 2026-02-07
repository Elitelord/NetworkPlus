
import { PrismaClient } from "@prisma/client"


const prisma = new PrismaClient();

async function main() {
    console.log("Starting migration...");

    // 1. Upsert Dev User
    const devUser = await prisma.user.upsert({
        where: { id: "dev-user" },
        update: {},
        create: {
            id: "dev-user",
            name: "Dev User",
            email: "dev@example.com",
            image: "https://github.com/shadcn.png",
        },
    });
    console.log(`Dev User confirmed: ${devUser.id}`);

    // 2. Update Contacts
    const contacts = await prisma.contact.updateMany({
        data: { ownerId: devUser.id },
    });
    console.log(`Updated ${contacts.count} contacts to own by dev-user.`);

    // 3. Update Reminders
    const reminders = await prisma.reminder.updateMany({
        data: { userId: devUser.id },
    });
    console.log(`Updated ${reminders.count} reminders to own by dev-user.`);
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
