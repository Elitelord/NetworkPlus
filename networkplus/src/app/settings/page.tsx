import { auth } from "@/auth"
import { Session } from "next-auth"
import { redirect } from "next/navigation"
import prisma from "@/lib/prisma"
import { ProfileForm } from "../../components/settings/profile-form"
import { PasswordForm } from "../../components/settings/password-form"
import { DeleteAccount } from "../../components/settings/delete-account"
import { Separator } from "@/components/ui/separator"
import { NotificationForm } from "@/components/settings/notification-form"
import { GraphSettingsForm } from "@/components/settings/graph-settings-form"
import { EstimatedFrequencyBackfill } from "@/components/settings/estimated-frequency-backfill"
import { GroupTypeOverridesEditor } from "@/components/settings/group-type-overrides-editor"
import { UserGroupsEditor } from "@/components/settings/user-groups-editor"
import { SettingsSidebar } from "@/components/settings/settings-sidebar"
import { classifyGroupTypeWithOverrides } from "@/lib/group-type-classifier"

export default async function SettingsPage() {
    const session = await auth() as Session | null

    if (!session?.user) {
        redirect("/signin")
    }

    const user = await prisma.user.findUnique({
        where: { id: session.user.id },
    })

    if (!user) {
        redirect("/signin")
    }

    const contacts = await (prisma.contact as any).findMany({
        where: { ownerId: (session as any).user.id },
        select: { id: true, name: true, category: true, groups: true, estimatedFrequencyCount: true, estimatedFrequencyIsAuto: true }
    })

    const allGroups: string[] = Array.from(new Set((contacts as any[]).flatMap((c: any) => (c.groups || []) as string[]))).sort() as string[]
    const allCategories: string[] = Array.from(new Set((contacts as any[]).map((c: any) => (c.category || "") as string))).sort() as string[]
    const contactOptions: { id: string; name: string }[] = ((contacts as any[]).map((c: any) => ({ id: (c.id || "") as string, name: (c.name || "") as string })) as any[]).sort((a: any, b: any) => (a.name || "").localeCompare(b.name || ""))

    const overrides = ((user as any).groupTypeOverrides ?? {}) as Record<string, any>
    const groupsWithType = allGroups.map(name => ({
        name: name as string,
        type: classifyGroupTypeWithOverrides(name as string, overrides)
    }))

    const hasPassword = !!(user as any).hashedPassword

    return (
        <div className="w-full bg-background py-8 sm:py-12 px-4 sm:px-6">
            <div className="max-w-6xl mx-auto w-full">
                <div className="mb-10 text-center md:text-left">
                    <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight lg:text-5xl">Settings</h1>
                    <p className="text-lg sm:text-xl text-muted-foreground mt-2">Manage your account settings and preferences.</p>
                </div>

                <div className="flex flex-col md:flex-row gap-8 lg:gap-12">
                    <aside className="w-full md:w-64 shrink-0">
                        <SettingsSidebar />
                    </aside>

                    <div className="flex-1 space-y-16 min-w-0 w-full">
                        {/* ── Profile ────────────────────────────────────────── */}
                        <section id="profile" className="scroll-mt-24 space-y-6">
                            <div>
                                <h2 className="text-xl sm:text-2xl font-semibold">Profile</h2>
                                <p className="text-sm sm:text-base text-muted-foreground">Update your personal information.</p>
                            </div>
                            <div className="max-w-xl w-full">
                                <ProfileForm user={session.user} />
                            </div>
                            <Separator />
                        </section>

                        {/* ── Security ────────────────────────────────────────── */}
                        <section id="security" className="scroll-mt-24 space-y-6">
                            <div>
                                <h2 className="text-xl sm:text-2xl font-semibold">Security</h2>
                                <p className="text-sm sm:text-base text-muted-foreground">Manage your password and authentication.</p>
                            </div>
                            <div className="max-w-xl w-full">
                                <PasswordForm hasPassword={hasPassword} />
                            </div>
                            <Separator />
                        </section>

                        {/* ── Notifications ───────────────────────────────────── */}
                        <section id="notifications" className="scroll-mt-24 space-y-6">
                            <div>
                                <h2 className="text-xl sm:text-2xl font-semibold">Notifications</h2>
                                <p className="text-sm sm:text-base text-muted-foreground">Manage your daily catch-up notifications.</p>
                            </div>
                            <div className="max-w-2xl w-full">
                                <NotificationForm
                                    defaultValues={{
                                        notificationsEnabled: (user as any).notificationsEnabled ?? false,
                                        notificationTime: (user as any).notificationTime ?? "09:00",
                                        catchUpDays: (user as any).catchUpDays ?? [],
                                        catchUpGroups: ((user as any).catchUpGroups || []) as any,
                                        catchUpCategories: ((user as any).catchUpCategories || []) as any,
                                        catchUpContactIds: ((user as any).catchUpContactIds || []) as any,
                                    }}
                                    availableGroups={allGroups as any}
                                    availableCategories={allCategories as any}
                                    availableContacts={contactOptions as any}
                                />
                            </div>
                            <Separator />
                        </section>

                        {/* ── Group Types ──────────────────────────────────────── */}
                        <section id="group-types" className="scroll-mt-24 space-y-6">
                            <div>
                                <h2 className="text-xl sm:text-2xl font-semibold">Group Types</h2>
                                <p className="text-sm sm:text-base text-muted-foreground">Review and override how groups are categorized.</p>
                            </div>
                            <div className="max-w-3xl w-full">
                                <GroupTypeOverridesEditor
                                    groups={allGroups}
                                    initialOverrides={overrides}
                                />
                            </div>
                            <Separator />
                        </section>

                        {/* ── Interaction Frequency ─────────────────────────────── */}
                        <section id="frequency" className="scroll-mt-24 space-y-6">
                            <div>
                                <h2 className="text-xl sm:text-2xl font-semibold">Interaction Frequency</h2>
                                <p className="text-sm sm:text-base text-muted-foreground">Auto-fill estimated interaction frequency for existing contacts.</p>
                            </div>
                            <div className="max-w-2xl w-full">
                                <EstimatedFrequencyBackfill
                                    contactsToBackfill={contacts.filter((c: any) => (c.estimatedFrequencyCount === null || (c as any).estimatedFrequencyIsAuto !== false) && c.groups.length > 0).length}
                                    totalContacts={contacts.length}
                                />
                            </div>
                            <Separator />
                        </section>

                        {/* ── Graph Preferences ─────────────────────────────── */}
                        <section id="graph" className="scroll-mt-24 space-y-6">
                            <div>
                                <h2 className="text-xl sm:text-2xl font-semibold">Graph Preferences</h2>
                                <p className="text-sm sm:text-base text-muted-foreground">Customize how the network graph behaves.</p>
                            </div>
                            <div className="max-w-md w-full">
                                <GraphSettingsForm />
                            </div>
                            <Separator />
                        </section>

                        {/* ── Shared Groups ───────────────────────────────────── */}
                        <section id="shared-groups" className="scroll-mt-24 space-y-6">
                            <div>
                                <h2 className="text-xl sm:text-2xl font-semibold">Shared Groups</h2>
                                <p className="text-sm sm:text-base text-muted-foreground">Define your own groups to improve frequency estimation.</p>
                                <p className="text-xs sm:text-sm text-muted-foreground italic mt-2">
                                  Define groups you belong to (e.g. your company). When a contact shares these groups, their estimated frequency increases (e.g. 5x/week for shared employment).
                                </p>
                            </div>
                            <div className="max-w-3xl w-full">
                                <UserGroupsEditor
                                    initialGroups={((user as any).groups as string[]) || []}
                                    availableGroupsWithType={groupsWithType as any}
                                />
                            </div>
                            <Separator />
                        </section>

                        {/* ── Danger Zone ─────────────────────────────────────── */}
                        <section id="danger" className="scroll-mt-24 space-y-6 pt-8 pb-12">
                            <div>
                                <h2 className="text-xl sm:text-2xl font-semibold text-destructive">Danger Zone</h2>
                                <p className="text-sm sm:text-base text-muted-foreground">Irreversible actions specific to your account.</p>
                            </div>
                            <div className="max-w-xl w-full p-6 rounded-lg border border-destructive/20 bg-destructive/5 overflow-hidden">
                                <DeleteAccount />
                            </div>
                        </section>
                    </div>
                </div>
            </div>
        </div>
    )
}
