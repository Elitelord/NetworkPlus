/**
 * This script is a helper to manually trigger the Gmail and Outlook sync endpoints.
 * Because the endpoints require NextAuth sessions, we need to pass a valid session token,
 * or temporarily modify the API routes to accept an API key or a test user ID.
 * 
 * For this script, we assume it's running locally and we can bypass auth for testing,
 * or we need to grab the `authjs.session-token` cookie from your browser after you log in.
 */

import http from "http";

const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://networkplus.me";

// INSTRUCTIONS:
// 1. Log in to your locally running app (http://localhost:3000) using Google or Microsoft.
// 2. Open Developer Tools -> Application -> Cookies.
// 3. Copy the value of the `authjs.session-token` cookie (or `__Secure-authjs.session-token`).
// 4. Paste it here:
const SESSION_TOKEN = "eyJhbGciOiJkaXIiLCJlbmMiOiJBMjU2Q0JDLUhTNTEyIiwia2lkIjoiZUliUHFuc1ZRRWhkX0VFUDc2eWRNcjdiR3ZPem9zREN3UzRVblJwZ21tUXhaTEcyZE9oYXBocGJ4bzBjM3VOSjE2OUNSckZOeURIX01LRHpoY2lCLUEifQ..58spPOUoKPUlPwdQR--m-A.nMiwL-OnaRbJ5HxiBuPD34Ao9f_pPcE7djFFDvZ0vdrITYbf1gUzV5zSZQGO-BIqsENUHKKxDOC5LQIR248n7yWBcYCXJOw4-QdQypg4LDSEolGp2ScDxZIgDcDjnWNiYSx1N5guGgg8K9y5sjsObZrV7Gi3WLMxGrOlJ_CeJMAkJ_bchFEESy2a85LVSL-ycXuaJzDaee4vVlftakqq6jxlPlSaJwVl1YG-bBVWSt1xF_C8l9FO6XSDwHkWgqNd7PYINz1WrLoby8GShKsXy2_KMN7QREs1ZLFkfWfv1bR5G1R5_jTJWcINxNX2dxPpJ7jy5TjdZzFfForcciSGA2hBKO8DQjFlJ77K4MuiIJMvaqhDWemv9svI6Hb6Qqq7KtUWZYoH39Yvri3gOn_yhl09xfamtCJ3Vez8FS6_REE.3946rs5_sfOKwhYIxLt9MpqF8bEnsFI26JRHwIHBUN8";

async function triggerSync(provider: "gmail" | "outlook") {
    console.log(`\nTriggering ${provider} sync...`);

    try {
        const response = await fetch(`${baseUrl}/api/sync/${provider}`, {
            method: "POST",
            headers: {
                "Cookie": `__Secure-authjs.session-token=${SESSION_TOKEN}`
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
