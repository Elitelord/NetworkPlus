import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { z } from "zod";

const schema = z.object({
    token: z.string().min(1, "Token is required"),
});

export async function POST(req: Request) {
    try {
        const session = await auth();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        if (!(session as any)?.user?.id) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const body = await req.json();
        const result = schema.safeParse(body);

        if (!result.success) {
            return NextResponse.json(
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                { error: "Invalid request body", details: (result as any).error.errors },
                { status: 400 }
            );
        }

        const { token } = result.data;

        await prisma.user.update({
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            where: { id: (session as any).user.id },
            data: { fcmToken: token } as any,
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Error saving FCM token:", error);
        return NextResponse.json(
            { error: "Internal Server Error" },
            { status: 500 }
        );
    }
}
