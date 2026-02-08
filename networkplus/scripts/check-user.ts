import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';
dotenv.config();

const prisma = new PrismaClient();

async function main() {
    const userCount = await prisma.user.count();
    console.log(`User count: ${userCount}`);

    if (userCount === 0) {
        console.log("No users found. Creating default user...");
        const user = await prisma.user.create({
            data: {
                name: "Dev User",
                email: "dev@example.com",
            }
        });
        console.log(`Created user: ${user.name} (${user.id})`);
    } else {
        const first = await prisma.user.findFirst();
        console.log(`Found user: ${first?.name} (${first?.id})`);
    }
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
