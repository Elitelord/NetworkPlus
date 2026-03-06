import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { initAdmin } from "@/lib/firebase-admin";
import { getDueSoonContacts } from "@/lib/contacts";

export async function GET(req: Request) {
    try {
        // Verify cron secret
        const authHeader = req.headers.get("authorization");
        if (
            !process.env.CRON_SECRET ||
            authHeader !== `Bearer ${process.env.CRON_SECRET}`
        ) {
            return new NextResponse("Unauthorized", { status: 401 });
        }

        // 1. Get current time in UTC (HH:mm)
        const now = new Date();
        const hours = now.getUTCHours().toString().padStart(2, '0');
        const minutes = now.getUTCMinutes().toString().padStart(2, '0');
        // We'll broaden the check to handle execution delays or minute mismatches if needed,
        // but for now exact match on HH:mm is our target. 
        // A robust system might check a range or use a "last processed" flag.

        // For simplicity in this demo, we assume the cron runs every minute or users only pick :00 / :15 / :30 / :45
        // If users pick exact minutes, we need minute-level cron.
        // Let's assume we match the exact minute.
        const currentTime = `${hours}:${minutes}`;
        console.log(`[Cron] Processing notifications for time: ${currentTime} UTC`);

        // 2. Find users who have notifications enabled and match this time
        const users = await prisma.user.findMany({
            where: {
                notificationsEnabled: true,
                notificationTime: currentTime,
                fcmToken: {
                    not: null
                }
            },
            select: {
                id: true,
                fcmToken: true,
                name: true,
                email: true
            }
        });

        console.log(`[Cron] Found ${users.length} users to notify.`);

        if (users.length === 0) {
            return NextResponse.json({ processed: 0, message: "No users matched current time." });
        }

        const admin = await initAdmin();
        const messaging = admin.messaging();
        let successCount = 0;
        let failCount = 0;

        // 3. Process each user
        for (const user of users) {
            try {
                // Get contacts to catch up with
                const contacts = await getDueSoonContacts(user.id);

                if (contacts.length === 0) {
                    console.log(`[Cron] User ${user.email} (ID: ${user.id}) has no due contacts. Skipping.`);
                    continue;
                }

                // Construct notification payload
                const contactNames = contacts.slice(0, 3).map(c => c.name).join(", ");
                const remaining = contacts.length - 3;
                const body = remaining > 0
                    ? `Time to catch up with ${contactNames} and ${remaining} others.`
                    : `Time to catch up with ${contactNames}.`;

                const message = {
                    token: user.fcmToken!,
                    notification: {
                        title: "Daily Catch-up",
                        body: body,
                    },
                    data: {
                        url: "/dashboard", // or a specific catch-up page
                        click_action: "/dashboard"
                    },
                    webpush: {
                        fcmOptions: {
                            link: "/dashboard",
                        },
                    },
                };

                await messaging.send(message);
                successCount++;
                console.log(`[Cron] Notification sent to user ${user.id}`);

            } catch (error) {
                console.error(`[Cron] Failed to send to user ${user.id}:`, error);
                failCount++;
            }
        }

        return NextResponse.json({
            success: true,
            processed: users.length,
            sent: successCount,
            failed: failCount
        });

    } catch (error) {
        console.error("Error processing notifications:", error);
        return NextResponse.json(
            { error: "Internal Server Error" },
            { status: 500 }
        );
    }
}
