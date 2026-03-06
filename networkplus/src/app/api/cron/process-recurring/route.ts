import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

/**
 * Cron endpoint: processes recurring interaction templates and generates
 * due interaction instances. Called on a schedule (e.g., daily).
 */
export async function POST(req: Request) {
    try {
        // Verify cron secret
        const authHeader = req.headers.get("authorization");
        if (
            !process.env.CRON_SECRET ||
            authHeader !== `Bearer ${process.env.CRON_SECRET}`
        ) {
            return new NextResponse("Unauthorized", { status: 401 });
        }

        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

        // Fetch all active recurring templates
        const templates = await prisma.interaction.findMany({
            where: {
                isRecurring: true,
                OR: [
                    { recurringEndDate: null },
                    { recurringEndDate: { gte: today } },
                ],
            },
            include: {
                contacts: { select: { id: true } },
                recurringInstances: {
                    orderBy: { date: "desc" },
                    take: 1,
                    select: { date: true },
                },
            },
        });

        let created = 0;

        for (const template of templates) {
            const lastInstance = template.recurringInstances[0];
            const lastDate = lastInstance?.date || template.date;
            let nextDate: Date | null = null;
            const interval = template.recurringInterval || 1;

            switch (template.recurringType) {
                case "DAILY":
                    nextDate = new Date(lastDate.getTime() + interval * 24 * 60 * 60 * 1000);
                    break;
                case "WEEKLY":
                case "BIWEEKLY": // Support legacy biweekly as weekly with interval 2
                    const weeks = template.recurringType === "BIWEEKLY" ? 2 : interval;
                    nextDate = new Date(lastDate.getTime() + weeks * 7 * 24 * 60 * 60 * 1000);
                    break;
                case "MONTHLY":
                    nextDate = new Date(lastDate);
                    nextDate.setMonth(nextDate.getMonth() + interval);
                    break;
                default:
                    continue;
            }

            if (!nextDate || nextDate > today) continue;

            // Check day-of-week filter
            if (template.recurringDaysOfWeek.length > 0) {
                if (!template.recurringDaysOfWeek.includes(nextDate.getDay())) continue;
            }

            // Check end date
            if (template.recurringEndDate && nextDate > template.recurringEndDate) continue;

            // Create instance
            await prisma.interaction.create({
                data: {
                    type: template.type,
                    platform: template.platform,
                    date: nextDate,
                    startTime: nextDate,
                    endTime: nextDate,
                    content: template.content,
                    parentInteractionId: template.id,
                    contacts: {
                        connect: template.contacts.map((c) => ({ id: c.id })),
                    },
                },
            });

            created++;

            // Recalculate scores
            const { recalculateContactScore } = await import("@/lib/strength-scoring");
            for (const contact of template.contacts) {
                const latestInteraction = await prisma.interaction.findFirst({
                    where: { contacts: { some: { id: contact.id } } },
                    orderBy: { date: "desc" },
                    select: { date: true, platform: true },
                });

                if (latestInteraction) {
                    await prisma.contact.update({
                        where: { id: contact.id },
                        data: {
                            lastInteractionAt: latestInteraction.date,
                            lastPlatform: latestInteraction.platform,
                        },
                    });
                }

                await recalculateContactScore(contact.id);
            }
        }

        return NextResponse.json({
            message: "Recurring interactions processed",
            created,
            templatesChecked: templates.length,
        });

    } catch (error) {
        console.error("Process recurring interactions error:", error);
        return new NextResponse("Internal server error", { status: 500 });
    }
}
