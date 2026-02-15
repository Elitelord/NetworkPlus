
import "dotenv/config";
import admin from "firebase-admin";
import { PrismaClient } from "@prisma/client";

// Initialize Prisma
const prisma = new PrismaClient();

// Initialize Firebase Admin
function createFirebaseAdminApp() {
    if (admin.apps.length > 0) {
        return admin.app();
    }

    const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    // Handle private key newlines
    const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");

    if (!projectId || !clientEmail || !privateKey) {
        throw new Error("Missing Firebase Admin credentials in .env");
    }

    const cert = admin.credential.cert({
        projectId,
        clientEmail,
        privateKey,
    });

    return admin.initializeApp({
        credential: cert,
        projectId,
    });
}

async function main() {
    console.log("Looking for user with FCM token...");
    const user = await prisma.user.findFirst({
        where: {
            fcmToken: {
                not: null, // This might need to be cast if types are stale, but runtime should work
            },
        },
        // Explicitly select fields to avoid large payload
        select: {
            id: true,
            email: true,
            name: true,
            fcmToken: true
        }
    });

    if (!user || !user.fcmToken) {
        console.error("No user found with an FCM token. Please log in and allow notifications in the browser first.");
        process.exit(1);
    }

    console.log(`Found user: ${user.email} with token: ${user.fcmToken.substring(0, 20)}...`);

    try {
        const app = createFirebaseAdminApp();
        const messaging = app.messaging();

        const message = {
            token: user.fcmToken,
            notification: {
                title: "Test Notification",
                body: `Hello ${user.name || "User"}, this is a test from the isolated script!`,
            },
            data: {
                url: "/test-url",
            },
            webpush: {
                fcmOptions: {
                    link: "/test-url",
                },
            },
        };

        console.log("Sending notification...");
        const response = await messaging.send(message);
        console.log("Successfully sent message:", response);
    } catch (error) {
        console.error("Error sending message:", error);
    }
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
