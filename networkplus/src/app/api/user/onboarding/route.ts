import { NextRequest, NextResponse } from "next/server";
import { Prisma, CommunicationTone } from "@prisma/client";
import { auth } from "@/auth";
import prisma from "@/lib/prisma";
import { getDefaultCatchUpDays } from "@/lib/catch-up-presets";
import { getDefaultTone } from "@/lib/tone-presets";

const VALID_TONES = new Set<string>(Object.values(CommunicationTone));

/** DB migration not applied yet (column missing) — see prisma/migrations/*user_has_completed_onboarding* */
function isOnboardingColumnMissing(err: unknown): boolean {
    if (!(err instanceof Prisma.PrismaClientKnownRequestError) || err.code !== "P2022") return false;
    return String(err.message).includes("hasCompletedOnboarding");
}

function isNewColumnMissing(err: unknown, columnHint: string): boolean {
    if (!(err instanceof Prisma.PrismaClientKnownRequestError) || err.code !== "P2022") return false;
    return String(err.message).includes(columnHint);
}

export async function GET(req: NextRequest) {
    try {
        const session = (await auth()) as any;
        if (!session?.user?.id) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const dbUser = await prisma.user.findUnique({
            where: { id: session.user.id },
            select: {
                hasCompletedOnboarding: true,
                hasCompletedTour: true,
                useCase: true,
                industryField: true,
                primaryGoal: true,
                communicationTone: true,
                onboardingCatchUpPresetApplied: true,
            },
        });

        if (!dbUser) {
            return NextResponse.json({ hasCompletedOnboarding: true, hasCompletedTour: true });
        }

        return NextResponse.json(dbUser);
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

        const user = await prisma.user.findUnique({
            where: { id: session.user.id },
            select: {
                hasCompletedOnboarding: true,
                useCase: true,
                industryField: true,
                primaryGoal: true,
                catchUpDays: true,
                onboardingCatchUpPresetApplied: true,
                communicationTone: true,
            },
        });

        if (!user) {
            return NextResponse.json({ error: "User not found" }, { status: 404 });
        }

        const updateData: Prisma.UserUpdateInput = {};
        if (typeof body.hasCompletedOnboarding === "boolean") {
            updateData.hasCompletedOnboarding = body.hasCompletedOnboarding;
        }
        if (typeof body.hasCompletedTour === "boolean") {
            updateData.hasCompletedTour = body.hasCompletedTour;
        }
        if (body.useCase !== undefined) {
            updateData.useCase = body.useCase;
        }
        if (body.industryField !== undefined) {
            updateData.industryField = body.industryField;
        }
        if (body.primaryGoal !== undefined) {
            updateData.primaryGoal = body.primaryGoal;
        }

        if (body.communicationTone !== undefined) {
            if (body.communicationTone === null) {
                updateData.communicationTone = null;
            } else if (typeof body.communicationTone === "string" && VALID_TONES.has(body.communicationTone)) {
                updateData.communicationTone = body.communicationTone as CommunicationTone;
            } else {
                return NextResponse.json({ error: "Invalid communicationTone" }, { status: 400 });
            }
        }

        const mergedUseCase = body.useCase !== undefined ? body.useCase : user.useCase;
        const mergedIndustry = body.industryField !== undefined ? body.industryField : user.industryField;
        const mergedGoal = body.primaryGoal !== undefined ? body.primaryGoal : user.primaryGoal;

        const completingOnboarding =
            body.hasCompletedOnboarding === true && user.hasCompletedOnboarding === false;

        if (
            completingOnboarding &&
            !user.onboardingCatchUpPresetApplied &&
            (!user.catchUpDays || user.catchUpDays.length === 0)
        ) {
            updateData.catchUpDays = getDefaultCatchUpDays(mergedUseCase, mergedGoal);
            updateData.onboardingCatchUpPresetApplied = true;
        }

        if (body.communicationTone === undefined && user.communicationTone === null) {
            if (mergedUseCase || mergedIndustry || mergedGoal) {
                updateData.communicationTone = getDefaultTone(mergedUseCase, mergedIndustry, mergedGoal);
            }
        }

        if (Object.keys(updateData).length === 0) {
            return NextResponse.json({ error: "Missing fields" }, { status: 400 });
        }

        await prisma.user.update({
            where: { id: session.user.id },
            data: updateData,
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        if (isOnboardingColumnMissing(error)) {
            console.warn(
                "[onboarding] User.hasCompletedOnboarding column missing — PATCH skipped. Run prisma migrate deploy."
            );
            return NextResponse.json({ success: true, persisted: false });
        }
        if (isNewColumnMissing(error, "communicationTone") || isNewColumnMissing(error, "onboardingCatchUpPresetApplied")) {
            console.warn(
                "[onboarding] New profile columns missing — run prisma migrate deploy."
            );
        }
        console.error("Error updating onboarding status:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
