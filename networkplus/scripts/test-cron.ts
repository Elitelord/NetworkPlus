import { PrismaClient } from "@prisma/client";
import axios from "axios";

const prisma = new PrismaClient();

async function main() {
    // 1. Setup a test user
    const email = "dev@example.com"; // Ensure this user exists and has an FCM token
    console.log(`Setting up test user: ${email}...`);

    const user = await prisma.user.findUnique({
        where: { email },
        select: { id: true, fcmToken: true }
    });

    if (!user || !user.fcmToken) {
        console.error("Test user not found or missing FCM token. Please login and enable notifications first.");
        process.exit(1);
    }

    // 2. Set their notification time to NOW (in UTC)
    const now = new Date();
    const hours = now.getUTCHours().toString().padStart(2, '0');
    const minutes = now.getUTCMinutes().toString().padStart(2, '0');
    const currentTime = `${hours}:${minutes}`;

    console.log(`Setting notification time to ${currentTime} UTC for user...`);

    await prisma.user.update({
        where: { id: user.id },
        data: {
            notificationsEnabled: true,
            notificationTime: currentTime
        }
    });

    // 3. Call the API route
    console.log("Triggering cron API route...");
    try {
        // Assuming running locally on port 3000
        const response = await axios.get("http://localhost:3000/api/cron/process-notifications");
        console.log("API Response:", response.data);
    } catch (error) {
        console.error("API Call failed:", error);
    }
}

main()
    .catch(console.error)
    .finally(async () => {
        await prisma.$disconnect();
    });
