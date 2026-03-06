import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import prisma from "@/lib/prisma";

export async function GET(req: NextRequest) {
    try {
        const session = (await auth()) as any;
        if (!session?.user?.id) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const dbUser = await prisma.user.findUnique({
            where: { id: session.user.id },
            // @ts-ignore
            select: { hasCompletedOnboarding: true }
        });

        if (!dbUser) {
            return NextResponse.json({ hasCompletedOnboarding: true });
        }

        // @ts-ignore
        return NextResponse.json({ hasCompletedOnboarding: dbUser.hasCompletedOnboarding });
    } catch (error) {
        console.error("Error fetching onboarding status:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}

export async function PATCH(req: NextRequest) {
    try {
        const session = (await auth()) as any;
        if (!session?.user?.id) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const body = await req.json();
        const hasCompletedOnboarding = body.hasCompletedOnboarding;

        if (typeof hasCompletedOnboarding !== "boolean") {
            return NextResponse.json({ error: "Invalid flag" }, { status: 400 });
        }

        await prisma.user.update({
            where: { id: session.user.id },
            // @ts-ignore
            data: { hasCompletedOnboarding },
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Error updating onboarding status:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
