import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET() {
    if (process.env.NODE_ENV !== "development") {
        return NextResponse.json({ error: "Restricted to development" }, { status: 403 });
    }

    try {
        // 0. Handle Potential Conflict: Check if email exists on a different ID
        const existingConflict = await prisma.user.findUnique({
            where: { email: "dev@example.com" },
        });

        if (existingConflict && existingConflict.id !== "dev-user") {
            // Rename the email of the conflicting user to free up "dev@example.com"
            await prisma.user.update({
                where: { id: existingConflict.id },
                data: { email: `migrated-${Date.now()}@example.com` },
            });
            // Note: We don't delete to be safe, but we reassign their data later anyway.
        }

        // 1. Ensure Dev User exists
        const devUser = await prisma.user.upsert({
            where: { id: "dev-user" },
            update: {},
            create: {
                id: "dev-user",
                name: "Dev User",
                email: "dev@example.com",
                image: "https://github.com/shadcn.png",
            },
        });

        // 2. Assign all Contacts without specific ownership (or just ALL of them if we are doing a hard reset)
        // The user asked to move "current data to dev account". 
        // We will blindly assign ALL contacts to dev-user to be safe and ensure they are captured.
        const contactsUpdate = await prisma.contact.updateMany({
            data: { ownerId: devUser.id },
        });

        // 3. Assign all Reminders
        const remindersUpdate = await prisma.reminder.updateMany({
            data: { userId: devUser.id },
        });

        return NextResponse.json({
            success: true,
            devUser,
            updatedContacts: contactsUpdate.count,
            updatedReminders: remindersUpdate.count,
        });
    } catch (error) {
        return NextResponse.json({ error: String(error) }, { status: 500 });
    }
}
