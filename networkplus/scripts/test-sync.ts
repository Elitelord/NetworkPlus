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
const SESSION_TOKEN = "eyJhbGciOiJkaXIiLCJlbmMiOiJBMjU2Q0JDLUhTNTEyIiwia2lkIjoiZUliUHFuc1ZRRWhkX0VFUDc2eWRNcjdiR3ZPem9zREN3UzRVblJwZ21tUXhaTEcyZE9oYXBocGJ4bzBjM3VOSjE2OUNSckZOeURIX01LRHpoY2lCLUEifQ..d3yJhve9KIhIgPonf0uRiQ.qDYrl5SJL56uvTThphnaMUuj9Qa7OQMpUL52NjAX_WlIK-KfDAuYpVjEvZaN1MGgUR1Nn-H1oR6kngWBPrcm0qE_qP0qS19POMRrpH_088T7ewPtNfSQxiSvaC1x7gDTu7WBJYQxoCf1wXOqhJHC5DeBjMe0FKQ7IDHOMkRoqoNhfD-2n2wE-2vTyYh0oE5hI_-bApbZ65uD4UgrAAEUncyR_MAsk6oDf7tBHY7cMPGHLgnliO-KAXNPRxbkifK1squLslC1lIeq-zeiV_u2KVC2_GjKb3WbA9Hxq9hZfeEYT8n8iJA9RMPgHse6f1oZDAhZalQo7aN430ecxIwOhnfAUy8fRNw2KBoudJ74FG7DGqQV_Av9Va3vih46hL_UjeGZgu4j_X2LcN7R4Z8Q0SlXPewWqgBmA9WfY-Bg3o4.x-VwoVbD6ZDxbUyqGWke7H6D9pT85aPpiY14jQwyaOo";

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
