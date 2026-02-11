import "dotenv/config";
import prisma from "@/lib/prisma";
import { recalculateContactScore } from "@/lib/strength-scoring";

async function main() {
    console.log("Starting scoring verification...");

    const user = await prisma.user.findFirst();
    if (!user) {
        console.error("No user found.");
        return;
    }

    // 1. Create a test contact
    const contact = await prisma.contact.create({
        data: {
            ownerId: user.id,
            name: "Test Scoring Contact",
            email: "test.scoring@example.com",
        },
    });
    console.log("Created contact:", contact.id);

    try {
        // 2. Add an interaction (Recent, High Value - In Person)
        const now = new Date();
        await prisma.interaction.create({
            data: {
                type: "MEETING",
                platform: "IN_PERSON",
                date: now,
                contacts: { connect: { id: contact.id } },
            },
        });

        await recalculateContactScore(contact.id);

        let updated = await prisma.contact.findUnique({ where: { id: contact.id } });
        console.log("Score after 1 In-Person (5.0 * 1.0):", updated?.strengthScore);

        // 3. Add an old interaction (20 days ago, Call - 4.0 * 0.7 = 2.8)
        const oldDate = new Date();
        oldDate.setDate(now.getDate() - 20);

        await prisma.interaction.create({
            data: {
                type: "CALL",
                platform: "CALL",
                date: oldDate,
                contacts: { connect: { id: contact.id } },
            },
        });

        await recalculateContactScore(contact.id);
        updated = await prisma.contact.findUnique({ where: { id: contact.id } });
        console.log("Score after old Call (2.8) + Recent In-Person (5.0):", updated?.strengthScore);

        // 4. Test monthsKnown modifier
        // monthsKnown = 12 → modifier = 1 + ln(13)/5 ≈ 1.513
        await prisma.contact.update({
            where: { id: contact.id },
            data: { monthsKnown: 12 }
        });
        await recalculateContactScore(contact.id);
        updated = await prisma.contact.findUnique({ where: { id: contact.id } });
        console.log("Score with monthsKnown=12 (modifier ≈ 1.51):", updated?.strengthScore);

        // 5. Test long-term relationship (60 months = 5 years, modifier capped at 1.8)
        await prisma.contact.update({
            where: { id: contact.id },
            data: { monthsKnown: 60 }
        });
        await recalculateContactScore(contact.id);
        updated = await prisma.contact.findUnique({ where: { id: contact.id } });
        console.log("Score with monthsKnown=60 (modifier capped ≈ 1.8):", updated?.strengthScore);

    } catch (e) {
        console.error("Verification failed:", e);
    } finally {
        // Cleanup
        await prisma.interaction.deleteMany({ where: { contacts: { some: { id: contact.id } } } });
        await prisma.contact.delete({ where: { id: contact.id } });
        console.log("Cleanup done.");
    }
}

main();
