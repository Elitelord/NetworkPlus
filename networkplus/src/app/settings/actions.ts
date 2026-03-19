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

export async function updateUserGroups(groups: string[]) {
    const session = await auth() as Session | null
    if (!session?.user?.id) {
        return { error: "Not authenticated" }
    }

    try {
        await prisma.user.update({
            where: { id: session.user.id },
            data: { groups } as any,
        })
        revalidatePath("/settings")
        return { success: "Groups updated successfully" }
    } catch (error) {
        return { error: "Failed to update groups" }
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

// ── Group type overrides ─────────────────────────────────────────────────

const VALID_GROUP_TYPES = new Set(["school", "employment", "social", "family", "community", "other"]);

export async function updateGroupTypeOverrides(overrides: Record<string, string>) {
    const session = await auth() as Session | null
    if (!session?.user?.id) {
        return { error: "Not authenticated" }
    }

    // Validate every value is a valid GroupType
    for (const [key, value] of Object.entries(overrides)) {
        if (typeof key !== "string" || key.length === 0 || key.length > 200) {
            return { error: `Invalid group name: ${key}` }
        }
        if (!VALID_GROUP_TYPES.has(value)) {
            return { error: `Invalid group type "${value}" for group "${key}"` }
        }
    }

    try {
        await prisma.user.update({
            where: { id: session.user.id },
            data: { groupTypeOverrides: overrides },
        })
        revalidatePath("/settings")
        return { success: "Group type overrides updated" }
    } catch (error) {
        return { error: "Failed to update group type overrides" }
    }
}

export async function getGroupTypeOverrides(): Promise<Record<string, string>> {
    const session = await auth() as Session | null
    if (!session?.user?.id) return {}

    const user = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { groupTypeOverrides: true },
    })

    return (user?.groupTypeOverrides as Record<string, string> | null) ?? {}
}

// ── Backfill estimated frequency ─────────────────────────────────────────

export async function backfillEstimatedFrequency(force = false) {
    const session = await auth() as Session | null
    if (!session?.user?.id) {
        return { error: "Not authenticated" }
    }

    try {
        const { getDefaultEstimatedFrequency } = await import("@/lib/estimated-frequency-defaults")
        type GroupTypeImport = import("@/lib/group-type-classifier").GroupType

        const user = await prisma.user.findUnique({
            where: { id: session.user.id },
            select: { groupTypeOverrides: true, groups: true } as any,
        })
        const overrides = (user?.groupTypeOverrides as unknown as Record<string, GroupTypeImport> | null) ?? undefined
        const userGroups = (user as any)?.groups || []

        // Force mode: re-estimate all contacts EXCEPT those with explicit manual overrides (isAuto === false)
        // Normal mode: only contacts with null frequency or already-auto frequency
        const contacts = await prisma.contact.findMany({
            where: {
                ownerId: session.user.id,
                NOT: [
                    { groups: { isEmpty: true } },
                    // Never touch contacts where user explicitly set frequency manually
                    ...(force ? [{ estimatedFrequencyIsAuto: false } as any] : []),
                ],
                ...(force ? {} : {
                    OR: [
                        { estimatedFrequencyCount: null },
                        { estimatedFrequencyIsAuto: true } as any,
                    ],
                }),
            },
            select: { id: true, groups: true, estimatedFrequencyIsAuto: true } as any,
        })

        const { recalculateContactScore } = await import("@/lib/strength-scoring")
        let updatedCount = 0

        for (const c of contacts) {
            // Double-check: never overwrite manually-set frequencies
            if ((c as any).estimatedFrequencyIsAuto === false) continue

            const defaults = getDefaultEstimatedFrequency((c as any).groups as string[], overrides, userGroups)
            if (!defaults) continue

            await prisma.contact.update({
                where: { id: (c as any).id as string },
                data: {
                    estimatedFrequencyCount: defaults.count,
                    estimatedFrequencyCadence: defaults.cadence,
                    estimatedFrequencyPlatform: defaults.platform,
                    estimatedFrequencyIsAuto: true,
                } as any,
            })
            await recalculateContactScore((c as any).id as string)
            updatedCount++
        }

        return {
            success: `Auto-estimated frequency for ${updatedCount} contacts`,
            updatedCount,
            skippedCount: contacts.length - updatedCount,
        }
    } catch (error) {
        console.error("Backfill estimated frequency failed:", error)
        return { error: "Failed to backfill estimated frequency" }
    }
}

// ── Notification preferences ─────────────────────────────────────────────

const notificationPreferencesSchema = z.object({
    notificationsEnabled: z.boolean(),
    notificationTime: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, "Invalid time format"),
    catchUpDays: z.array(z.number().min(0).max(6)).optional(),
    catchUpGroups: z.array(z.string()).optional(),
    catchUpCategories: z.array(z.string()).optional(),
    catchUpContactIds: z.array(z.string()).optional(),
    filterReachOutByPreferences: z.boolean().optional(),
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
                notificationTime: result.data.notificationTime,
                catchUpDays: result.data.catchUpDays ?? [],
                catchUpGroups: result.data.catchUpGroups ?? [],
                catchUpCategories: result.data.catchUpCategories ?? [],
                catchUpContactIds: result.data.catchUpContactIds ?? [],
                filterReachOutByPreferences: result.data.filterReachOutByPreferences ?? false,
            } as any,
        })
        revalidatePath("/settings")
        return { success: "Preferences updated" }
    } catch (error) {
        return { error: "Failed to update preferences" }
    }
}
