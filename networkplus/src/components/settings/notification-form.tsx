"use client"

import { useState, useTransition } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Button } from "@/components/ui/button"
import {
    Form,
    FormControl,
    FormDescription,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form"
import { Switch } from "@/components/ui/switch"
import { Input } from "@/components/ui/input"
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"
import { toast } from "sonner"
import { updateNotificationPreferences } from "@/app/settings/actions"
import { useFcmToken } from "@/hooks/use-fcm-token"
import { Loader2 } from "lucide-react"

const notificationFormSchema = z.object({
    notificationsEnabled: z.boolean(),
    notificationTime: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, "Invalid time format"),
})

type NotificationFormValues = z.infer<typeof notificationFormSchema>

interface NotificationFormProps {
    defaultValues: Partial<NotificationFormValues>
}

export function NotificationForm({ defaultValues }: NotificationFormProps) {
    const [isPending, startTransition] = useTransition()
    const { notificationPermission } = useFcmToken() // Hook handles token sync automatically

    const form = useForm<NotificationFormValues>({
        resolver: zodResolver(notificationFormSchema),
        defaultValues: {
            notificationsEnabled: defaultValues.notificationsEnabled ?? false,
            notificationTime: defaultValues.notificationTime ?? "09:00",
        },
    })

    function onSubmit(data: NotificationFormValues) {
        if (data.notificationsEnabled && notificationPermission !== "granted") {
            toast.error("Please enable browser notifications first")
            return
        }

        startTransition(async () => {
            // Convert local time to UTC before sending to server
            // We'll append a dummy date to the time to parse it correctly
            const [hours, minutes] = data.notificationTime.split(":").map(Number)
            const date = new Date()
            date.setHours(hours, minutes, 0, 0)

            const utcHours = date.getUTCHours().toString().padStart(2, '0')
            const utcMinutes = date.getUTCMinutes().toString().padStart(2, '0')
            const utcTime = `${utcHours}:${utcMinutes}`

            const result = await updateNotificationPreferences({
                ...data,
                notificationTime: utcTime
            })

            if (result.error) {
                toast.error(result.error)
            } else {
                toast.success("Notification preferences updated")
            }
        })
    }

    // Convert UTC time from DB back to local time for display
    // This is handled via defaultValues passed in, assuming they are converted by the parent or we convert here if needed.
    // Ideally, the parent component should pass the initial values. 
    // Wait, the parent (server component) passes DB values which are UTC. 
    // We should convert them to local time here for the Default Values if we want to be precise, 
    // BUT server components don't know the client's timezone.
    // So we might need to rely on the user setting it, or use a client-side effect to adjust the default value on mount.
    // For simplicity MVP, let's trust the user sets it and we just display what's in the DB? 
    // No, that would be confusing (saving 9am local -> 2pm UTC -> display 2pm).
    // Implementation detail: We will assume the passed `defaultValues.notificationTime` is UTC and convert it to local on mount.

    useState(() => {
        if (defaultValues.notificationTime) {
            const [utcHours, utcMinutes] = defaultValues.notificationTime.split(":").map(Number)
            const date = new Date()
            date.setUTCHours(utcHours, utcMinutes, 0, 0)
            const localHours = date.getHours().toString().padStart(2, '0')
            const localMinutes = date.getMinutes().toString().padStart(2, '0')
            form.setValue("notificationTime", `${localHours}:${localMinutes}`)
        }
    })

    return (
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
                <FormField
                    control={form.control}
                    name="notificationsEnabled"
                    render={({ field }) => (
                        <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                            <div className="space-y-0.5">
                                <FormLabel className="text-base">Daily Catch-up</FormLabel>
                                <FormDescription>
                                    Receive a daily notification with contacts to catch up with.
                                </FormDescription>
                            </div>
                            <FormControl>
                                <Switch
                                    checked={field.value}
                                    onCheckedChange={field.onChange}
                                />
                            </FormControl>
                        </FormItem>
                    )}
                />

                {form.watch("notificationsEnabled") && (
                    <FormField
                        control={form.control}
                        name="notificationTime"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Notification Time</FormLabel>
                                <FormControl>
                                    <div className="flex gap-1 items-center">
                                        <NativeSelect
                                            value={(() => {
                                                const timeStr = field.value || "09:00";
                                                let h = parseInt(timeStr.split(":")[0]) || 0;
                                                if (h === 0) h = 12;
                                                else if (h > 12) h -= 12;
                                                return h.toString();
                                            })()}
                                            onChange={(e) => {
                                                const timeStr = field.value || "09:00";
                                                const [, minuteStr] = timeStr.split(":");
                                                const oldHour24 = parseInt(timeStr.split(":")[0]) || 0;
                                                const isPm = oldHour24 >= 12;

                                                const newHour12 = parseInt(e.target.value);
                                                let newHour24 = newHour12;
                                                if (isPm) {
                                                    if (newHour12 === 12) newHour24 = 12;
                                                    else newHour24 = newHour12 + 12;
                                                } else {
                                                    if (newHour12 === 12) newHour24 = 0;
                                                    else newHour24 = newHour12;
                                                }
                                                field.onChange(`${newHour24.toString().padStart(2, '0')}:${minuteStr || "00"}`);
                                            }}
                                            className="w-[70px]"
                                        >
                                            {Array.from({ length: 12 }, (_, i) => i + 1).map((h) => (
                                                <NativeSelectOption key={h} value={h.toString()}>
                                                    {h}
                                                </NativeSelectOption>
                                            ))}
                                        </NativeSelect>

                                        <span className="text-muted-foreground">:</span>

                                        <NativeSelect
                                            value={(() => {
                                                const timeStr = field.value || "09:00";
                                                return timeStr.split(":")[1] || "00";
                                            })()}
                                            onChange={(e) => {
                                                const timeStr = field.value || "09:00";
                                                const [hourStr] = timeStr.split(":");
                                                field.onChange(`${hourStr || "09"}:${e.target.value.padStart(2, '0')}`);
                                            }}
                                            className="w-[70px]"
                                        >
                                            {Array.from({ length: 12 }, (_, i) => i * 5).map((m) => (
                                                <NativeSelectOption key={m} value={m.toString().padStart(2, '0')}>
                                                    {m.toString().padStart(2, '0')}
                                                </NativeSelectOption>
                                            ))}
                                        </NativeSelect>

                                        <NativeSelect
                                            value={(() => {
                                                const timeStr = field.value || "09:00";
                                                const h = parseInt(timeStr.split(":")[0]) || 0;
                                                return h >= 12 ? "PM" : "AM";
                                            })()}
                                            onChange={(e) => {
                                                const timeStr = field.value || "09:00";
                                                const [hourStr, minuteStr] = timeStr.split(":");
                                                let h = parseInt(hourStr) || 0;
                                                const newAmPm = e.target.value;

                                                if (newAmPm === "PM" && h < 12) {
                                                    h += 12;
                                                } else if (newAmPm === "AM" && h >= 12) {
                                                    h -= 12;
                                                }
                                                field.onChange(`${h.toString().padStart(2, '0')}:${minuteStr || "00"}`);
                                            }}
                                            className="w-[70px]"
                                        >
                                            <NativeSelectOption value="AM">AM</NativeSelectOption>
                                            <NativeSelectOption value="PM">PM</NativeSelectOption>
                                        </NativeSelect>
                                    </div>
                                </FormControl>
                                <FormDescription>
                                    Select the time you want to receive notifications (in your local time).
                                </FormDescription>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                )}

                <Button type="submit" disabled={isPending}>
                    {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Save Preferences
                </Button>
            </form>
        </Form>
    )
}
