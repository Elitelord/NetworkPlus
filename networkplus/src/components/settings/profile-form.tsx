"use client"

import { useState } from "react"
import { User } from "next-auth"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Field, FieldLabel, FieldGroup } from "@/components/ui/field"
import { updateProfile } from "@/app/settings/actions"
import { useFormStatus } from "react-dom"

function SubmitButton() {
    const { pending } = useFormStatus()
    return (
        <Button type="submit" disabled={pending}>
            {pending ? "Saving..." : "Save Changes"}
        </Button>
    )
}

export function ProfileForm({ user }: { user: User }) {
    const [message, setMessage] = useState<{ error?: string; success?: string } | null>(null)

    async function clientAction(formData: FormData) {
        setMessage(null)
        const result = await updateProfile(null, formData)
        if (result?.error) {
            setMessage({ error: result.error })
        } else if (result?.success) {
            setMessage({ success: result.success })
        }
    }

    return (
        <form action={clientAction} className="space-y-4 max-w-md">
            {message?.error && (
                <div className="p-3 text-sm text-destructive bg-destructive/10 rounded-md">
                    {message.error}
                </div>
            )}
            {message?.success && (
                <div className="p-3 text-sm text-green-600 bg-green-50 rounded-md">
                    {message.success}
                </div>
            )}

            <div className="flex items-center gap-4 mb-6">
                {user.image ? (
                    <img
                        src={user.image}
                        alt={user.name || "Avatar"}
                        className="h-16 w-16 rounded-full border"
                    />
                ) : (
                    <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center text-xl font-medium text-muted-foreground">
                        {user.name?.[0] || user.email?.[0] || "?"}
                    </div>
                )}
                <div className="space-y-1">
                    <p className="font-medium">Profile Picture</p>
                    <p className="text-xs text-muted-foreground">
                        Use your Google account or Gravatar to change your picture.
                    </p>
                </div>
            </div>

            <FieldGroup>
                <Field>
                    <FieldLabel htmlFor="email">Email</FieldLabel>
                    <Input id="email" type="email" value={user.email || ""} disabled className="bg-muted" />
                    <p className="text-[0.8rem] text-muted-foreground">
                        Email cannot be changed directly.
                    </p>
                </Field>

                <Field>
                    <FieldLabel htmlFor="name">Display Name</FieldLabel>
                    <Input
                        id="name"
                        name="name"
                        defaultValue={user.name || ""}
                        placeholder="Your name"
                        required
                    />
                </Field>

                <div className="flex justify-end pt-2">
                    <SubmitButton />
                </div>
            </FieldGroup>
        </form>
    )
}
