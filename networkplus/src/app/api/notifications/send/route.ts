import { auth } from "@/auth";
import { initAdmin } from "@/lib/firebase-admin";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { z } from "zod";

const schema = z.object({
    userId: z.string(),
    title: z.string(),
    body: z.string(),
    url: z.string().optional(),
});

export async function POST(req: Request) {
    try {
        const session = await auth();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        if (!(session as any)?.user?.id) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const json = await req.json();
        const result = schema.safeParse(json);

        if (!result.success) {
            return NextResponse.json(
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                { error: "Invalid request body", details: (result as any).error.errors },
                { status: 400 }
            );
        }

        const { userId, title, body, url } = result.data;

        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { fcmToken: true },
        });

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        if (!user || !(user as any).fcmToken) {
            return NextResponse.json(
                { error: "User not found or has no FCM token" },
                { status: 404 }
            );
        }

        const admin = await initAdmin();

        // Construct the message payload
        const message = {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            token: (user as any).fcmToken,
            notification: {
                title,
                body,
            },
            data: {
                url: url || "/",
                click_action: url || "/", // For compatibility
            },
            webpush: {
                fcmOptions: {
                    link: url || "/",
                },
            },
        };

        const response = await admin.messaging().send(message);

        return NextResponse.json({ success: true, messageId: response });
    } catch (error) {
        console.error("Error sending notification:", error);
        return NextResponse.json(
            { error: "Internal Server Error" },
            { status: 500 }
        );
    }
}
