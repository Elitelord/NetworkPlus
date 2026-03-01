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
const SESSION_TOKEN = "eyJhbGciOiJkaXIiLCJlbmMiOiJBMjU2Q0JDLUhTNTEyIiwia2lkIjoiZUliUHFuc1ZRRWhkX0VFUDc2eWRNcjdiR3ZPem9zREN3UzRVblJwZ21tUXhaTEcyZE9oYXBocGJ4bzBjM3VOSjE2OUNSckZOeURIX01LRHpoY2lCLUEifQ..fZ2Zgi_8yRqWQcsSR4f8kQ.TpxqKPew-6Sn81pQWY8mfmQ9KHxZQ2imeQi3ShqZL7a717x6BYENlvZocbqPzZlX8cN0ju94pChGxFM3Ob3SZke1kv8pNS46I7SVwQkVpFbzkZQTbnhAzuyjr_zyP6SyAxe2p8gQBKXxwEztV8iT3KsEoe2kF-CQ29B3RcIdp7lItij4x36auyIkI6Tw5J-dx6SHFHjzywYFFrGZDdnJ_sAeM2T7QwwV28eZWAGW81lFCsqwSxWfFLT4PWMyk9uFSoqjVBA3fYtdiQ3I2nULn6k6y7Q-YdyIKAMmLEIRSvrqyNK_6Woxpd0UoHwtvang3aFobCNi8N3D5MDe_GH35Gdk8tL2goZU4zCKhdMJJIW6U7YVz_GGvByc8g4tf48W-IG_Yxkxnxgl0os-KJwWLKMdxMBjmtpNb2Y-bWQ_yZQ.JpyLklmxKPrtZVWfZ7iRT6zyBdOx8jRI1Kpp26xTnOw";

async function triggerSync(provider: "gmail" | "outlook") {
    console.log(`\nTriggering ${provider} sync...`);

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
