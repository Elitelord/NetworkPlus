import dotenv from "dotenv";

dotenv.config();

async function main() {
    const cronSecret = process.env.CRON_SECRET;
    if (!cronSecret) {
        console.error("Missing CRON_SECRET");
        process.exit(1);
    }

    console.log("Triggering POST to process-notifications route...");
    try {
        const response = await fetch(
            "http://localhost:3000/api/cron/process-notifications",
            {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${cronSecret}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({}),
            }
        );
        const data = await response.json();
        if (!response.ok) {
            console.error(`Error: ${response.status} ${response.statusText}`);
            console.error(data);
        } else {
            console.log("Success! Response:");
            console.log(data);
        }
    } catch (error: any) {
        console.error("Failed to make request:", error.message);
    }
}

main();
