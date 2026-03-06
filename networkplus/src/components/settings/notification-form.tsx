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
import { MultiSelect } from "@/components/ui/multi-select"

const notificationFormSchema = z.object({
    notificationsEnabled: z.boolean(),
    notificationTime: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, "Invalid time format"),
    catchUpDays: z.array(z.number()).optional(),
    catchUpGroups: z.array(z.string()).optional(),
    catchUpCategories: z.array(z.string()).optional(),
    catchUpContactIds: z.array(z.string()).optional(),
})

type NotificationFormValues = z.infer<typeof notificationFormSchema>

interface NotificationFormProps {
    defaultValues: Partial<NotificationFormValues>
    availableGroups: string[]
    availableCategories: string[]
    availableContacts: { id: string, name: string }[]
}

export function NotificationForm({ defaultValues, availableGroups, availableCategories, availableContacts }: NotificationFormProps) {
    const [isPending, startTransition] = useTransition()
    const { notificationPermission, retrieveToken } = useFcmToken() // Hook handles token sync automatically

    // Calculate local time for initial form state
    const initialLocalTime = (() => {
        if (!defaultValues.notificationTime) return "09:00";
        const [utcHours, utcMinutes] = defaultValues.notificationTime.split(":").map(Number);
        const date = new Date();
        date.setUTCHours(utcHours, utcMinutes, 0, 0);
        const localHours = date.getHours().toString().padStart(2, '0');
        const localMinutes = date.getMinutes().toString().padStart(2, '0');
        return `${localHours}:${localMinutes}`;
    })();

    const form = useForm<NotificationFormValues>({
        resolver: zodResolver(notificationFormSchema),
        defaultValues: {
            notificationsEnabled: defaultValues.notificationsEnabled ?? false,
            notificationTime: initialLocalTime,
            catchUpDays: defaultValues.catchUpDays ?? [],
            catchUpGroups: defaultValues.catchUpGroups ?? [],
            catchUpCategories: defaultValues.catchUpCategories ?? [],
            catchUpContactIds: defaultValues.catchUpContactIds ?? [],
        },
    })

    async function onSubmit(data: NotificationFormValues) {
        if (data.notificationsEnabled && typeof window !== 'undefined' && 'Notification' in window) {
            let perm = Notification.permission;
            if (perm !== "granted") {
                perm = await Notification.requestPermission();
                if (perm === "granted") {
                    await retrieveToken();
                }
            }
            if (perm !== "granted") {
                toast.error("Please enable browser notifications first");
                return;
            }
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
                    <div className="space-y-6 border-l-2 pl-4 ml-2">
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

                        <FormField
                            control={form.control}
                            name="catchUpDays"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Days of Week</FormLabel>
                                    <FormControl>
                                        <MultiSelect
                                            options={["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]}
                                            selected={(field.value || []).map(day => ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][day])}
                                            onChange={(selected) => {
                                                field.onChange(selected.map(s => ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"].indexOf(s)));
                                            }}
                                            placeholder="Every day"
                                            creatable={false}
                                        />
                                    </FormControl>
                                    <FormDescription>Leave empty to receive notifications every day.</FormDescription>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <div className="space-y-2 pt-2">
                            <label className="text-sm font-medium leading-none">Who to catch up with?</label>
                            {(() => {
                                const catchUpCategories = form.watch("catchUpCategories") || [];
                                const catchUpGroups = form.watch("catchUpGroups") || [];
                                const catchUpContactIds = form.watch("catchUpContactIds") || [];

                                const contactNamesToIds = new Map<string, string>();
                                const contactIdsToNames = new Map<string, string>();
                                const contactDisplayOptions = availableContacts.map(c => {
                                    const isDuplicate = availableContacts.filter(x => x.name === c.name).length > 1;
                                    const display = isDuplicate ? `${c.name} (${c.id.slice(-4)})` : c.name;
                                    contactNamesToIds.set(display, c.id);
                                    contactIdsToNames.set(c.id, display);
                                    return display;
                                });

                                const allFilterOptions = [
                                    ...availableCategories.map(c => `Category: ${c}`),
                                    ...availableGroups.map(g => `Group: ${g}`),
                                    ...contactDisplayOptions
                                ];

                                const selectedFilters = [
                                    ...catchUpCategories.map(c => `Category: ${c}`),
                                    ...catchUpGroups.map(g => `Group: ${g}`),
                                    ...catchUpContactIds.map(id => contactIdsToNames.get(id)).filter(Boolean) as string[]
                                ];

                                return (
                                    <>
                                        <MultiSelect
                                            options={allFilterOptions}
                                            selected={selectedFilters}
                                            onChange={(selected) => {
                                                const newCategories: string[] = [];
                                                const newGroups: string[] = [];
                                                const newContactIds: string[] = [];

                                                selected.forEach(s => {
                                                    if (s.startsWith("Category: ")) newCategories.push(s.replace("Category: ", ""));
                                                    else if (s.startsWith("Group: ")) newGroups.push(s.replace("Group: ", ""));
                                                    else {
                                                        const id = contactNamesToIds.get(s);
                                                        if (id) newContactIds.push(id);
                                                    }
                                                });

                                                form.setValue("catchUpCategories", newCategories, { shouldDirty: true });
                                                form.setValue("catchUpGroups", newGroups, { shouldDirty: true });
                                                form.setValue("catchUpContactIds", newContactIds, { shouldDirty: true });
                                            }}
                                            placeholder="Search groups, categories, or contacts... (Empty = Everyone)"
                                            creatable={false}
                                        />
                                        <p className="text-[0.8rem] text-muted-foreground pt-1">
                                            Select combinations of groups, categories, or specific contacts. Contacts matching <b>any</b> selection will be included.
                                        </p>
                                    </>
                                );
                            })()}
                        </div>
                    </div>
                )}

                <Button type="submit" disabled={isPending}>
                    {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Save Preferences
                </Button>
            </form>
        </Form>
    )
}
