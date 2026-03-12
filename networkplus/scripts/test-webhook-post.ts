import axios from "axios";
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
        const response = await axios.post(
            "http://localhost:3000/api/cron/process-notifications",
            {},
            {
                headers: {
                    Authorization: `Bearer ${cronSecret}`
                }
            }
        );
        console.log("Success! Response:");
        console.log(response.data);
    } catch (error: any) {
        if (error.response) {
            console.error(`Error: ${error.response.status} ${error.response.statusText}`);
            console.error(error.response.data);
        } else {
            console.error("Failed to make request:", error.message);
        }
    }
}

main();
