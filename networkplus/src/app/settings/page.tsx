import { auth } from "@/auth"
import { Session } from "next-auth"
import { redirect } from "next/navigation"
import prisma from "@/lib/prisma"
import { ProfileForm } from "../../components/settings/profile-form"
import { PasswordForm } from "../../components/settings/password-form"
import { DeleteAccount } from "../../components/settings/delete-account"
import { Separator } from "@/components/ui/separator"
import { NotificationForm } from "@/components/settings/notification-form"

export default async function SettingsPage() {
    const session = await auth() as Session | null

    if (!session?.user) {
        redirect("/signin")
    }

    // Fetch fresh user data to check if they have a password set
    const user = await prisma.user.findUnique({
        where: { id: session.user.id },
    })

    if (!user) {
        redirect("/signin") // Should not happen if session is valid but safe guard
    }

    const hasPassword = !!(user as any).hashedPassword

    return (
        <div className="container mx-auto max-w-2xl py-10 space-y-8 flex flex-col items-center">
            <div className="text-center">
                <h1 className="text-3xl font-bold">Settings</h1>
                <p className="text-muted-foreground">Manage your account settings and preferences.</p>
            </div>

            <div className="space-y-6 w-full max-w-md">
                <div className="flex flex-col items-center text-center mb-6">
                    <h2 className="text-lg font-medium">Profile</h2>
                    <p className="text-sm text-muted-foreground mb-4">Update your personal information.</p>
                    <div className="w-full text-left">
                        <ProfileForm user={session.user} />
                    </div>
                </div>

                <Separator />

                <div className="flex flex-col items-center text-center my-6">
                    <h2 className="text-lg font-medium">Security</h2>
                    <p className="text-sm text-muted-foreground mb-4">Manage your password and authentication.</p>
                    <div className="w-full text-left">
                        <PasswordForm hasPassword={hasPassword} />
                    </div>
                </div>

                <Separator />

                <div className="flex flex-col items-center text-center my-6">
                    <h2 className="text-lg font-medium">Notifications</h2>
                    <p className="text-sm text-muted-foreground mb-4">Manage your daily catch-up notifications.</p>
                    <div className="w-full text-left">
                        <NotificationForm defaultValues={{
                            notificationsEnabled: (user as any).notificationsEnabled ?? false,
                            notificationTime: (user as any).notificationTime ?? "09:00"
                        }} />
                    </div>
                </div>

                <Separator />

                <div className="flex flex-col items-center text-center mt-6">
                    <h2 className="text-lg font-medium text-destructive">Danger Zone</h2>
                    <p className="text-sm text-muted-foreground mb-4">Irreversible actions specific to your account.</p>
                    <div className="w-full text-left">
                        <DeleteAccount />
                    </div>
                </div>
            </div>
        </div>
    )
}
