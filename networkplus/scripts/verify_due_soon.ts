import "dotenv/config";
import { prisma } from "../src/lib/prisma"; // Adjust extension if needed or rely on resolution
import { getDueSoonContacts } from "../src/lib/contacts";

async function main() {
    console.log("Starting verification...");

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

        // 2. Create contacts with varying due dates
        const now = new Date();
        const daysAgo = (n: number) => {
            const d = new Date(now);
            d.setDate(now.getDate() - n);
            return d;
        };

        console.log("Creating test contacts...");
        // 100 days ago (Most due)
        const c100 = await prisma.contact.create({
            data: { ownerId: user.id, name: "Contact 100 Days Ago", lastInteractionAt: daysAgo(100) }
        });
        // 60 days ago
        const c60 = await prisma.contact.create({
            data: { ownerId: user.id, name: "Contact 60 Days Ago", lastInteractionAt: daysAgo(60) }
        });
        // 40 days ago
        const c40 = await prisma.contact.create({
            data: { ownerId: user.id, name: "Contact 40 Days Ago", lastInteractionAt: daysAgo(40) }
        });
        // 10 days ago (Not due)
        const cOk = await prisma.contact.create({
            data: { ownerId: user.id, name: "Contact 10 Days Ago", lastInteractionAt: daysAgo(10) }
        });

        console.log("Created 4 contacts.");

        // 3. Test logic
        console.log("Fetching due soon contacts (threshold 30 days)...");
        const results = await getDueSoonContacts(user.id, 30);
        console.log("Results found:", results.length);

        results.forEach(c => console.log(`- ${c.name} (Last: ${c.lastInteractionAt?.toISOString().split('T')[0]})`));

        // 4. Verification
        const resultIds = results.map(c => c.id);
        const expectedOrder = [c100.id, c60.id, c40.id]; // Oldest first

        const hasAllDue = resultIds.includes(c100.id) && resultIds.includes(c60.id) && resultIds.includes(c40.id);
        const hasNoOk = !resultIds.includes(cOk.id);

        // Check order for just the ones we created (ignoring pre-existing contacts in database)
        const filteredResults = results.filter(c => [c100.id, c60.id, c40.id].includes(c.id));
        const filteredIds = filteredResults.map(c => c.id);

        const isOrderCorrect = JSON.stringify(filteredIds) === JSON.stringify(expectedOrder);

        if (hasAllDue && hasNoOk && isOrderCorrect) {
            console.log("SUCCESS: Correctly identified due contacts and sorted them oldest -> newest.");
        } else {
            console.error("FAILURE: Logic mismatch.");
            if (!hasAllDue) console.error("Missing expected overdue contacts.");
            if (!hasNoOk) console.error("Included non-overdue contact.");
            if (!isOrderCorrect) {
                console.error("Order incorrect.");
                console.log("Expected:", expectedOrder);
                console.log("Actual:  ", filteredIds);
            }
        }

        // 5. Cleanup
        console.log("Cleaning up...");
        await prisma.contact.deleteMany({ where: { id: { in: [c100.id, c60.id, c40.id, cOk.id] } } });
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
