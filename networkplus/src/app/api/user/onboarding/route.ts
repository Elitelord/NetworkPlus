import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { auth } from "@/auth";
import prisma from "@/lib/prisma";

/** DB migration not applied yet (column missing) — see prisma/migrations/*user_has_completed_onboarding* */
function isOnboardingColumnMissing(err: unknown): boolean {
    if (!(err instanceof Prisma.PrismaClientKnownRequestError) || err.code !== "P2022") return false;
    return String(err.message).includes("hasCompletedOnboarding");
}

export async function GET(req: NextRequest) {
    try {
        const session = (await auth()) as any;
        if (!session?.user?.id) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const dbUser = await prisma.user.findUnique({
            where: { id: session.user.id },
            select: { hasCompletedOnboarding: true },
        });

        if (!dbUser) {
            return NextResponse.json({ hasCompletedOnboarding: true });
        }

        return NextResponse.json({ hasCompletedOnboarding: dbUser.hasCompletedOnboarding });
    } catch (error) {
        if (isOnboardingColumnMissing(error)) {
            console.warn(
                "[onboarding] User.hasCompletedOnboarding column missing — run prisma migrate deploy (or apply migration SQL). Treating as onboarded."
            );
            return NextResponse.json({ hasCompletedOnboarding: true });
        }
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
            data: { hasCompletedOnboarding },
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        if (isOnboardingColumnMissing(error)) {
            console.warn(
                "[onboarding] User.hasCompletedOnboarding column missing — PATCH skipped. Run prisma migrate deploy."
            );
            return NextResponse.json({ success: true, persisted: false });
        }
        console.error("Error updating onboarding status:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
