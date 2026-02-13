"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Field, FieldLabel, FieldGroup } from "@/components/ui/field"
import { updatePassword } from "@/app/settings/actions"
import { useFormStatus } from "react-dom"

function SubmitButton({ isSetMode }: { isSetMode: boolean }) {
    const { pending } = useFormStatus()
    return (
        <Button type="submit" disabled={pending}>
            {pending ? "Saving..." : (isSetMode ? "Set Password" : "Update Password")}
        </Button>
    )
}

export function PasswordForm({ hasPassword }: { hasPassword: boolean }) {
    const [message, setMessage] = useState<{ error?: string; success?: string } | null>(null)

    async function clientAction(formData: FormData) {
        setMessage(null)
        const result = await updatePassword(null, formData)

        if (result?.error) {
            setMessage({ error: result.error })
        } else if (result?.success) {
            setMessage({ success: result.success })
            // Ideally clear the form inputs here or reset form
            const form = document.getElementById("password-form") as HTMLFormElement
            form?.reset()
        }
    }

    return (
        <form id="password-form" action={clientAction} className="space-y-4 max-w-md">
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

            <FieldGroup>
                {!hasPassword ? (
                    <div className="bg-blue-50 text-blue-700 p-3 rounded-md text-sm mb-4">
                        You currently consistently sign in with Google. Set a password to log in with email/password as well.
                    </div>
                ) : (
                    <Field>
                        <FieldLabel htmlFor="currentPassword">Current Password</FieldLabel>
                        <Input
                            id="currentPassword"
                            name="currentPassword"
                            type="password"
                            required
                        />
                    </Field>
                )}

                <Field>
                    <FieldLabel htmlFor="newPassword">{hasPassword ? "New Password" : "Password"}</FieldLabel>
                    <Input
                        id="newPassword"
                        name="newPassword"
                        type="password"
                        required
                        minLength={8}
                    />
                </Field>

                <Field>
                    <FieldLabel htmlFor="confirmPassword">Confirm Password</FieldLabel>
                    <Input
                        id="confirmPassword"
                        name="confirmPassword"
                        type="password"
                        required
                        minLength={8}
                    />
                </Field>

                <div className="flex justify-end pt-2">
                    <SubmitButton isSetMode={!hasPassword} />
                </div>
            </FieldGroup>
        </form>
    )
}
