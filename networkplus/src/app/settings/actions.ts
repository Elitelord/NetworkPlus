"use server"

import { auth, signOut } from "@/auth"
import { Session } from "next-auth"
import prisma from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import bcrypt from "bcryptjs"
import { z } from "zod"

const profileSchema = z.object({
    name: z.string().min(1, "Name is required"),
})

const passwordSchema = z.object({
    currentPassword: z.string().optional(),
    newPassword: z.string().min(8, "Password must be at least 8 characters"),
    confirmPassword: z.string().min(8, "Password must be at least 8 characters"),
}).refine((data) => data.newPassword === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
})

export async function updateProfile(prevState: any, formData: FormData) {
    const session = await auth() as Session | null
    if (!session?.user?.id) {
        return { error: "Not authenticated" }
    }

    const name = formData.get("name") as string
    const result = profileSchema.safeParse({ name })

    if (!result.success) {
        return { error: result.error.issues[0].message }
    }

    try {
        await prisma.user.update({
            where: { id: session.user.id },
            data: { name: result.data.name },
        })
        revalidatePath("/settings")
        return { success: "Profile updated successfully" }
    } catch (error) {
        return { error: "Failed to update profile" }
    }
}

export async function updatePassword(prevState: any, formData: FormData) {
    const session = await auth() as Session | null
    if (!session?.user?.id) {
        return { error: "Not authenticated" }
    }

    const currentPassword = formData.get("currentPassword") as string
    const newPassword = formData.get("newPassword") as string
    const confirmPassword = formData.get("confirmPassword") as string

    const result = passwordSchema.safeParse({ currentPassword, newPassword, confirmPassword })

    if (!result.success) {
        return { error: result.error.issues[0].message }
    }

    try {
        const user = await prisma.user.findUnique({
            where: { id: session.user.id },
        })

        if (!user) return { error: "User not found" }

        // If user has a password, verify it
        // Cast to any because hashedPassword might be missing in types
        if ((user as any).hashedPassword) {
            if (!currentPassword) {
                return { error: "Current password is required" }
            }
            const isValid = await bcrypt.compare(currentPassword, (user as any).hashedPassword)
            if (!isValid) {
                return { error: "Incorrect current password" }
            }
        }

        const hashedPassword = await bcrypt.hash(newPassword, 10)

        await prisma.user.update({
            where: { id: session.user.id },
            data: { hashedPassword } as any,
        })

        revalidatePath("/settings")
        return { success: "Password updated successfully" }
    } catch (error) {
        return { error: "Failed to update password" }
    }
}

export async function deleteAccount() {
    const session = await auth() as Session | null
    const userId = session?.user?.id;
    if (!userId) {
        return { error: "Not authenticated" }
    }

    try {
        await prisma.$transaction(async (tx) => {
            // Find all contacts owned by the user
            const userContacts = await tx.contact.findMany({
                where: { ownerId: userId },
                select: { id: true },
            });
            const contactIds = userContacts.map(c => c.id);

            // 1. Delete links where the user's contacts are either 'from' or 'to'
            if (contactIds.length > 0) {
                await tx.link.deleteMany({
                    where: {
                        OR: [
                            { fromId: { in: contactIds } },
                            { toId: { in: contactIds } },
                        ],
                    },
                });
            }

            // 2. Delete reminders belonging to the user
            await tx.reminder.deleteMany({
                where: { userId: userId },
            });

            // 3. Delete contacts belonging to the user
            await tx.contact.deleteMany({
                where: { ownerId: userId },
            });

            // 4. Finally, delete the user
            await tx.user.delete({
                where: { id: userId },
            });
        });

        await signOut({ redirectTo: "/" })
        return { success: true }
    } catch (error) {
        console.error("Delete account error:", error);
        return { error: "Failed to delete account" }
    }
}

const notificationPreferencesSchema = z.object({
    notificationsEnabled: z.boolean(),
    notificationTime: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, "Invalid time format"),
})

export async function updateNotificationPreferences(data: z.infer<typeof notificationPreferencesSchema>) {
    const session = await auth() as Session | null
    if (!session?.user?.id) {
        return { error: "Not authenticated" }
    }

    const result = notificationPreferencesSchema.safeParse(data)
    if (!result.success) {
        return { error: "Invalid data" }
    }

    try {
        await prisma.user.update({
            where: { id: session.user.id },
            data: {
                notificationsEnabled: result.data.notificationsEnabled,
                notificationTime: result.data.notificationTime
            } as any,
        })
        revalidatePath("/settings")
        return { success: "Preferences updated" }
    } catch (error) {
        return { error: "Failed to update preferences" }
    }
}
