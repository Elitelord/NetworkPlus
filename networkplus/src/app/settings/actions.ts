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
    if (!session?.user?.id) {
        return { error: "Not authenticated" }
    }

    try {
        await prisma.user.delete({
            where: { id: session.user.id },
        })
        await signOut({ redirectTo: "/" })
        return { success: true }
    } catch (error) {
        return { error: "Failed to delete account" }
    }
}
