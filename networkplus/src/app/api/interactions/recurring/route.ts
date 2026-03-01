import { NextResponse } from "next/server";
import { type Session } from "next-auth";
import { auth } from "@/auth";
import prisma from "@/lib/prisma";

// GET: List recurring interaction templates for the user
export async function GET(req: Request) {
    try {
        const session = await auth() as Session | null;
        if (!session?.user?.id) {
            return new NextResponse("Unauthorized", { status: 401 });
        }

        const userId = session.user.id;

        const recurring = await prisma.interaction.findMany({
            where: {
                isRecurring: true,
                contacts: { some: { ownerId: userId } },
            },
            include: {
                contacts: { select: { id: true, name: true } },
            },
            orderBy: { date: "asc" },
        });

        return NextResponse.json(recurring);
    } catch (error) {
        console.error("Fetch recurring interactions error:", error);
        return new NextResponse("Internal server error", { status: 500 });
    }
}

// POST: Create a recurring interaction template
export async function POST(req: Request) {
    try {
        const session = await auth() as Session | null;
        if (!session?.user?.id) {
            return new NextResponse("Unauthorized", { status: 401 });
        }

        const userId = session.user.id;
        const body = await req.json();
        const {
            contactIds,
            type = "Recurring Meeting",
            platform = "OTHER",
            content,
            recurringType, // DAILY, WEEKLY, BIWEEKLY, MONTHLY
            recurringDaysOfWeek = [],
            recurringEndDate,
            startDate,
        } = body;

        if (!contactIds || contactIds.length === 0) {
            return NextResponse.json({ error: "At least one contact is required" }, { status: 400 });
        }

        if (!recurringType) {
            return NextResponse.json({ error: "Recurring type is required" }, { status: 400 });
        }

        // Verify ownership
        const count = await prisma.contact.count({
            where: { id: { in: contactIds }, ownerId: userId },
        });

        if (count !== contactIds.length) {
            return NextResponse.json({ error: "Invalid contacts" }, { status: 403 });
        }

        const date = startDate ? new Date(startDate) : new Date();

        const interaction = await prisma.interaction.create({
            data: {
                type,
                platform,
                date,
                startTime: date,
                endTime: date,
                content,
                isRecurring: true,
                recurringType,
                recurringDaysOfWeek,
                recurringEndDate: recurringEndDate ? new Date(recurringEndDate) : null,
                contacts: {
                    connect: contactIds.map((id: string) => ({ id })),
                },
            },
            include: {
                contacts: { select: { id: true, name: true } },
            },
        });

        return NextResponse.json(interaction);
    } catch (error) {
        console.error("Create recurring interaction error:", error);
        return new NextResponse("Internal server error", { status: 500 });
    }
}

// DELETE: Remove a recurring interaction template
export async function DELETE(req: Request) {
    try {
        const session = await auth() as Session | null;
        if (!session?.user?.id) {
            return new NextResponse("Unauthorized", { status: 401 });
        }

        const { searchParams } = new URL(req.url);
        const id = searchParams.get("id");
        const deleteFuture = searchParams.get("deleteFuture") === "true";

        if (!id) {
            return NextResponse.json({ error: "ID is required" }, { status: 400 });
        }

        // Verify the interaction belongs to the user
        const interaction = await prisma.interaction.findFirst({
            where: {
                id,
                isRecurring: true,
                contacts: { some: { ownerId: session.user.id } },
            },
        });

        if (!interaction) {
            return NextResponse.json({ error: "Not found" }, { status: 404 });
        }

        // Delete future generated instances if requested
        if (deleteFuture) {
            await prisma.interaction.deleteMany({
                where: {
                    parentInteractionId: id,
                    date: { gte: new Date() },
                },
            });
        }

        // Delete the template
        await prisma.interaction.delete({ where: { id } });

        return NextResponse.json({ message: "Recurring interaction deleted" });
    } catch (error) {
        console.error("Delete recurring interaction error:", error);
        return new NextResponse("Internal server error", { status: 500 });
    }
}
