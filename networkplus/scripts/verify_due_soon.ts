import "dotenv/config";
import { prisma } from "@/lib/prisma";
import { getDueSoonContacts } from "@/lib/contacts";
import { recalculateContactScore, STRENGTH_THRESHOLD } from "@/lib/strength-scoring";

async function main() {
    console.log("Starting catch-up list verification...");
    console.log("STRENGTH_THRESHOLD:", STRENGTH_THRESHOLD);

    try {
        // 1. Get a user
        let user = await prisma.user.findFirst();
        if (!user) {
            console.log("No user found. Creating dummy user...");
            user = await prisma.user.create({
                data: {
                    name: "Test User",
                    email: "test_verification_due_soon@example.com",
                }
            });
        }
        console.log("Using user:", user.id);

        const now = new Date();

        // 2. Create contacts with varying interaction histories
        console.log("Creating test contacts...");

        // Contact with NO interactions (score = 0, should be in catch-up list)
        const cNone = await prisma.contact.create({
            data: { ownerId: user.id, name: "No Interactions Contact" }
        });

        // Contact with a recent high-value interaction (score > threshold, should NOT be in catch-up list)
        const cRecent = await prisma.contact.create({
            data: { ownerId: user.id, name: "Recent In-Person Contact" }
        });
        await prisma.interaction.create({
            data: {
                type: "MEETING", platform: "IN_PERSON", date: now,
                contacts: { connect: { id: cRecent.id } },
            },
        });
        // Add another recent call to push well above threshold
        await prisma.interaction.create({
            data: {
                type: "CALL", platform: "CALL", date: now,
                contacts: { connect: { id: cRecent.id } },
            },
        });

        // Contact with only old interactions (score < threshold, should be in catch-up list)
        const oldDate = new Date();
        oldDate.setDate(now.getDate() - 100);
        const cOld = await prisma.contact.create({
            data: { ownerId: user.id, name: "Old Interaction Contact" }
        });
        await prisma.interaction.create({
            data: {
                type: "MESSAGE", platform: "SMS", date: oldDate,
                contacts: { connect: { id: cOld.id } },
            },
        });

        // Recalculate scores
        await recalculateContactScore(cNone.id);
        await recalculateContactScore(cRecent.id);
        await recalculateContactScore(cOld.id);

        // Fetch updated scores
        const updatedNone = await prisma.contact.findUnique({ where: { id: cNone.id } });
        const updatedRecent = await prisma.contact.findUnique({ where: { id: cRecent.id } });
        const updatedOld = await prisma.contact.findUnique({ where: { id: cOld.id } });

        console.log(`Scores: None=${updatedNone?.strengthScore}, Recent=${updatedRecent?.strengthScore}, Old=${updatedOld?.strengthScore}`);

        // 3. Test catch-up list
        console.log("Fetching catch-up contacts...");
        const results = await getDueSoonContacts(user.id);
        const resultIds = results.map(c => c.id);

        console.log("Catch-up list count:", results.length);
        results.forEach(c => console.log(`- ${c.name} (Score: ${c.strengthScore})`));

        // 4. Verification
        const hasNoInteractions = resultIds.includes(cNone.id);
        const hasOldInteractions = resultIds.includes(cOld.id);
        const excludesRecent = !resultIds.includes(cRecent.id);

        if (hasNoInteractions && hasOldInteractions && excludesRecent) {
            console.log("SUCCESS: Correctly identified low-strength contacts for catch-up.");
        } else {
            console.error("FAILURE: Logic mismatch.");
            if (!hasNoInteractions) console.error("Missing: No interactions contact should be in catch-up list.");
            if (!hasOldInteractions) console.error("Missing: Old interactions contact should be in catch-up list.");
            if (!excludesRecent) console.error("Extra: Recent contact should NOT be in catch-up list.");
        }

        // 5. Cleanup
        console.log("Cleaning up...");
        await prisma.interaction.deleteMany({ where: { contacts: { some: { id: { in: [cNone.id, cRecent.id, cOld.id] } } } } });
        await prisma.contact.deleteMany({ where: { id: { in: [cNone.id, cRecent.id, cOld.id] } } });
        if (user.email === "test_verification_due_soon@example.com") {
            await prisma.user.delete({ where: { id: user.id } });
            console.log("Deleted test user.");
        }

    } catch (e) {
        console.error("Error executing logic:", e);
    } finally {
        await prisma.$disconnect();
    }
}

main();
