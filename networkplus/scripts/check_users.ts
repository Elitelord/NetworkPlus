import "dotenv/config";
import { prisma } from "../src/lib/prisma";

async function main() {
    const count = await prisma.user.count();
    console.log(`User count: ${count}`);
    if (count === 0) {
        console.log("Creating a dev user...");
        await prisma.user.create({
            data: {
                name: "Dev User",
                email: "dev@example.com"
            }
        });
        console.log("Dev user created.");
    }
}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());
