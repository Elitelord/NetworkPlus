/**
 * This script is a helper to manually trigger the Gmail and Outlook sync endpoints.
 * Because the endpoints require NextAuth sessions, we need to pass a valid session token,
 * or temporarily modify the API routes to accept an API key or a test user ID.
 * 
 * For this script, we assume it's running locally and we can bypass auth for testing,
 * or we need to grab the `authjs.session-token` cookie from your browser after you log in.
 */

import http from "http";

const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://network-plus.vercel.app";

// INSTRUCTIONS:
// 1. Log in to your locally running app (http://localhost:3000) using Google or Microsoft.
// 2. Open Developer Tools -> Application -> Cookies.
// 3. Copy the value of the `authjs.session-token` cookie (or `__Secure-authjs.session-token`).
// 4. Paste it here:
const SESSION_TOKEN = "eyJhbGciOiJkaXIiLCJlbmMiOiJBMjU2Q0JDLUhTNTEyIiwia2lkIjoiMjU4RDZ3TTBOdkZqNk1wb2Nfemt2LUk1UEEzSTJ1V1NFSDBRQkxtNUpUeWJXWGJZb01iWDY0WlIxdkR3aG9MRDRiaEZ4QTVPQUZYRVpmNC14VUcwSWcifQ..rNFoCcJYw-JBn5MaYd4ViA.oh8_X01Vbub4UxqEOuCrXa1tS0nUYM2rk59dSzhPI33s7YRzcs5v84btsCRXF3wqIBMQxz-b8WEg_6dWaZJD8h46G9xDsklL_VQyZutDKNPjbYSzQZb3CgoYzxP0xhL1t8iU3M6uHQW49WgtCUdYfj28Rz8NCNayKwIstBbEPgiyllrFSqZuDaFjaTcafJZh8qHy8-xth9NsLxaE1gpkLCI6gDJ9gcpI0gEVbl4ebk6OUO8Z-KTLCgP-dCEJ4UfaERSsiLkADlhf8XjPvwxDmn-XQviNbsuwWLdi1w7pqq4nW0uklwnDuAxT_mxHLiAug_dUR-QLdflvBReIJd-ADI00tmTkfcgr5JJVf_UmvpPSR9M1BrnEzqzXQgDGcqNudEaGzOtbi8lk28lybPshuA.TIbQJwbmHa8QgD5oIvFqYCC4VTVlneDAl6_-y_vqEKE";

async function triggerSync(provider: "gmail" | "outlook") {
    console.log(`\nTriggering ${provider} sync...`);

    if (SESSION_TOKEN === "YOUR_SESSION_TOKEN_HERE") {
        console.warn("⚠️ Warning: SESSION_TOKEN is not set. The request will likely fail with 401 Unauthorized.");
        console.warn("Please log into http://localhost:3000 in your browser, copy the 'authjs.session-token' cookie, and update 'scripts/test-sync.ts'.\n");
    }

    try {
        const response = await fetch(`${baseUrl}/api/sync/${provider}`, {
            method: "POST",
            headers: {
                "Cookie": `authjs.session-token=${SESSION_TOKEN}`
            }
        });

        if (response.ok) {
            const data = await response.json();
            console.log(`✅ Success! ${provider} sync complete.`);
            console.log(JSON.stringify(data, null, 2));
        } else {
            console.error(`❌ Error (${response.status} ${response.statusText})`);
            const errText = await response.text();
            console.error(errText);
        }
    } catch (error) {
        console.error(`💥 Failed to trigger ${provider} sync:`, error);
    }
}

async function main() {
    const args = process.argv.slice(2);
    const provider = args[0];

    if (provider !== "gmail" && provider !== "outlook") {
        console.log("Usage: npx tsx scripts/test-sync.ts <gmail|outlook>");
        process.exit(1);
    }

    await triggerSync(provider as "gmail" | "outlook");
}

main();
