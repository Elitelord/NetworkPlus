/**
 * This script deletes the existing Google account link for a user
 * so they can re-authenticate with the new scopes (gmail.readonly)
 * and get a fresh refresh_token.
 * 
 * Usage: npx tsx scripts/relink-google.ts
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
    // Find all Google accounts
    const googleAccounts = await prisma.account.findMany({
        where: { provider: "google" },
        include: { user: { select: { email: true, name: true } } }
    });

    if (googleAccounts.length === 0) {
        console.log("No Google accounts found in the database.");
        return;
    }

    console.log(`Found ${googleAccounts.length} Google account(s):`);
    for (const acc of googleAccounts) {
        console.log(`  - User: ${acc.user.name} (${acc.user.email})`);
        console.log(`    Account ID: ${acc.id}`);
        console.log(`    Has refresh_token: ${!!acc.refresh_token}`);
        console.log(`    Scope: ${acc.scope}`);
        console.log(`    Expires at: ${acc.expires_at ? new Date(acc.expires_at * 1000).toISOString() : 'N/A'}`);
    }

    console.log("\nDeleting all Google account links so users can re-authenticate with new scopes...");

    const result = await prisma.account.deleteMany({
        where: { provider: "google" }
    });

    console.log(`✅ Deleted ${result.count} Google account link(s).`);
    console.log("\nNow sign in again on https://networkplus.me with Google.");
    console.log("Google will ask you to grant the gmail.readonly scope and will issue a fresh refresh_token.");
}

main().catch(console.error).finally(() => prisma.$disconnect());
