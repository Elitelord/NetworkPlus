"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"
import { deleteAccount } from "@/app/settings/actions"

export function DeleteAccount() {
    const [open, setOpen] = useState(false)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    async function handleDelete() {
        setLoading(true)
        setError(null)

        try {
            const result = await deleteAccount()
            if (result?.error) {
                setError(result.error)
                setLoading(false)
            } else {
                // Success case redirects via server action (signOut)
                // No need to set loading false as page will unload
            }
        } catch (err) {
            setError("Something went wrong. Please try again.")
            setLoading(false)
        }
    }

    return (
        <div className="border border-destructive/20 bg-destructive/5 rounded-lg p-6">
            <h3 className="text-lg font-medium text-destructive mb-2">Delete Account</h3>
            <p className="text-sm text-muted-foreground mb-4">
                Permanently delete your account and all associated data. This action cannot be undone.
            </p>

            {error && (
                <div className="mb-4 p-3 text-sm text-destructive bg-destructive/10 rounded-md">
                    {error}
                </div>
            )}

            <Dialog open={open} onOpenChange={setOpen}>
                <DialogTrigger asChild>
                    <Button variant="destructive">Delete Account</Button>
                </DialogTrigger>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Are you absolutely sure?</DialogTitle>
                        <DialogDescription>
                            This action cannot be undone. This will permanently delete your account
                            and remove all your data from our servers.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setOpen(false)} disabled={loading}>
                            Cancel
                        </Button>
                        <Button variant="destructive" onClick={handleDelete} disabled={loading}>
                            {loading ? "Deleting..." : "Yes, delete my account"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}
