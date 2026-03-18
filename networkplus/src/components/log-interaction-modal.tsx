"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
    NativeSelect,
    NativeSelectOption,
} from "@/components/ui/native-select";
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from "@/components/ui/command";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { Check, ChevronsUpDown, X } from "lucide-react";
import { format } from "date-fns";
import { Calendar as CalendarIcon } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { INTERACTION_PLATFORMS } from "@/lib/interaction-platforms";

export interface EditInteractionData {
    id: string;
    type: string;
    platform: string;
    content?: string;
    date: string;
    durationMinutes?: string;
    messageCount?: string;
    contactIds?: string[];
}

interface LogInteractionModalProps {
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
    contactId: string;
    onSuccess: (contactIds: string[]) => void;
    defaultDate?: string; // ISO string to pre-fill the date picker
    editInteraction?: EditInteractionData;
    onDelete?: () => void;
    /** "simple" = all fields, no contact selector when hideContactSelector; "full" = same plus contact selector. */
    variant?: "simple" | "full";
    /** When opening from Catch up / ReachOut, pre-select these contacts instead of only contactId. */
    initialContactIds?: string[];
    /** When true, render only the form (no Dialog). For embedding in ReachOutModal Other tab. */
    embedFormOnly?: boolean;
    /** When embedFormOnly, called when user clicks Cancel. */
    onCancel?: () => void;
    /** When true (e.g. embedded in Reach Out), hide the contact selector; parent provides contacts. */
    hideContactSelector?: boolean;
}

interface ContactOption {
    id: string;
    name: string;
}

export function LogInteractionModal({
    open = true,
    onOpenChange,
    contactId,
    onSuccess,
    defaultDate,
    editInteraction,
    onDelete,
    variant = "full",
    initialContactIds,
    embedFormOnly = false,
    onCancel,
    hideContactSelector = false,
}: LogInteractionModalProps) {
    const isEditing = !!editInteraction;
    const [deleting, setDeleting] = useState(false);
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        type: "Interaction",
        platform: "OTHER",
        date: new Date().toISOString().slice(0, 16), // datetime-local format YYYY-MM-DDTHH:mm
        durationMinutes: "",
        messageCount: "",
        content: "",
    });

    const isOpen = open || embedFormOnly;
    // Pre-fill form when editing or when defaultDate changes
    useEffect(() => {
        if (isOpen && editInteraction) {
            const d = new Date(editInteraction.date);
            const offset = d.getTimezoneOffset() * 60000;
            const localISO = new Date(d.getTime() - offset).toISOString().slice(0, 16);
            setFormData({
                type: editInteraction.type || "Interaction",
                platform: editInteraction.platform || "OTHER",
                date: localISO,
                durationMinutes: editInteraction.durationMinutes || "",
                messageCount: editInteraction.messageCount || "",
                content: editInteraction.content || "",
            });
        } else if (open && defaultDate) {
            const d = new Date(defaultDate);
            const offset = d.getTimezoneOffset() * 60000;
            const localISO = new Date(d.getTime() - offset).toISOString().slice(0, 16);
            setFormData(prev => ({ ...prev, date: localISO }));
        } else if (isOpen && variant === "simple") {
            // Simple mode: default date to now when not editing
            const now = new Date();
            const offset = now.getTimezoneOffset() * 60000;
            const localISO = new Date(now.getTime() - offset).toISOString().slice(0, 16);
            setFormData(prev => ({ ...prev, date: localISO }));
        }
    }, [isOpen, defaultDate, editInteraction, variant]);

    const [selectedContactIds, setSelectedContactIds] = useState<string[]>([]);
    const [contacts, setContacts] = useState<ContactOption[]>([]);
    const [openCombobox, setOpenCombobox] = useState(false);

    // Recurring interaction state
    const [isRecurring, setIsRecurring] = useState(false);
    const [recurringType, setRecurringType] = useState<"DAILY" | "WEEKLY" | "BIWEEKLY" | "MONTHLY" | "CUSTOM">("WEEKLY");
    const [customPeriod, setCustomPeriod] = useState<"DAILY" | "WEEKLY" | "MONTHLY">("WEEKLY");
    const [recurringInterval, setRecurringInterval] = useState("1");
    const [recurringDaysOfWeek, setRecurringDaysOfWeek] = useState<number[]>([]);
    const [recurringEndDate, setRecurringEndDate] = useState("");

    // Calendar Sync State
    const [syncToCalendar, setSyncToCalendar] = useState(false);
    const [endTime, setEndTime] = useState<string>("");

    // All fields always shown (no more/fewer options toggle)
    const showFullForm = true;

    // Initialize end time when syncing to calendar is toggled
    useEffect(() => {
        if (syncToCalendar && !endTime) {
            const d = parseLocalISO(formData.date);
            d.setHours(d.getHours() + 1);
            const offset = d.getTimezoneOffset() * 60000;
            const localISO = new Date(d.getTime() - offset).toISOString().slice(0, 16);
            setEndTime(localISO);
        }
    }, [syncToCalendar, formData.date, endTime]);

    useEffect(() => {
        if (isOpen) {
            // When opening from Catch up / ReachOut, use initialContactIds; when editing use interaction's; else contactId
            if (initialContactIds && initialContactIds.length > 0) {
                setSelectedContactIds(initialContactIds);
            } else if (editInteraction?.contactIds && editInteraction.contactIds.length > 0) {
                setSelectedContactIds(editInteraction.contactIds);
            } else {
                setSelectedContactIds([contactId]);
            }

            // Fetch all contacts for the picker
            fetch("/api/contacts")
                .then((res) => res.json())
                .then((data) => {
                    if (Array.isArray(data)) {
                        setContacts(data.map((c: any) => ({ id: c.id, name: c.name })));
                    }
                })
                .catch((err) => console.error("Failed to fetch contacts", err));
        }
    }, [isOpen, contactId, editInteraction, initialContactIds]);

    const handleChange = (field: string, value: string) => {
        setFormData((prev) => ({ ...prev, [field]: value }));
    };

    const toggleContact = (id: string) => {
        setSelectedContactIds((prev) =>
            prev.includes(id)
                ? prev.filter((i) => i !== id)
                : [...prev, id]
        );
    };

    const removeContact = (id: string) => {
        setSelectedContactIds((prev) => prev.filter((i) => i !== id));
    };

    // Robustly parse "YYYY-MM-DDTHH:mm" strings as local time
    const parseLocalISO = (isoStr: string) => {
        if (!isoStr) return new Date();
        const [datePart, timePart] = isoStr.split('T');
        if (!datePart || !timePart) return new Date(isoStr);
        const [year, month, day] = datePart.split('-').map(Number);
        const [hour, min] = timePart.split(':').map(Number);
        return new Date(year, month - 1, day, hour, min);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            // Determine if we should sync to Google Calendar instead of standard interaction log
            // Only new interactions can be synced to calendar directly
            if (!isEditing && syncToCalendar) {
                // Get emails of selected contacts for calendar invites
                const attendeeEmails = selectedContactIds
                    .map(id => contacts.find(c => c.id === id)?.name) // Ideally email, but we only have name in this pickers context, we can fetch email or just map it if we load emails
                    .filter(Boolean) as string[];

                const startD = parseLocalISO(formData.date);
                const endD = endTime ? parseLocalISO(endTime) : undefined;

                const res = await fetch("/api/calendar/events", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        title: formData.content || formData.type,
                        description: formData.content,
                        startTime: startD.toISOString(),
                        endTime: endD ? endD.toISOString() : undefined,
                        contactIds: selectedContactIds,
                        attendeeEmails,
                    }),
                });

                if (!res.ok) {
                    const data = await res.json().catch(() => null);
                    const message = data?.error || "Please sign in with Google to add events to your calendar.";
                    throw new Error(message);
                }
            } else {
                // Standard log interaction
                const url = isEditing
                    ? `/api/interactions/${editInteraction!.id}`
                    : "/api/interactions";
                const method = isEditing ? "PUT" : "POST";

                const res = await fetch(url, {
                    method,
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        contactIds: selectedContactIds,
                        type: formData.type,
                        platform: formData.platform,
                        content: formData.content,
                        durationMinutes: formData.durationMinutes,
                        messageCount: formData.messageCount,
                        date: parseLocalISO(formData.date).toISOString(),
                    }),
                });

                if (!res.ok) {
                    throw new Error(isEditing ? "Failed to update interaction" : "Failed to log interaction");
                }
            }

            // Create recurring template if enabled (only for new interactions)
            if (!isEditing && isRecurring && selectedContactIds.length > 0) {
                await fetch("/api/interactions/recurring", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        contactIds: selectedContactIds,
                        type: formData.type,
                        platform: formData.platform,
                        content: formData.content,
                        recurringType: recurringType === "CUSTOM" ? customPeriod : recurringType,
                        recurringInterval: parseInt(recurringInterval, 10) || 1,
                        recurringDaysOfWeek,
                        recurringEndDate: recurringEndDate || undefined,
                        startDate: parseLocalISO(formData.date).toISOString(),
                    }),
                }).catch(err => console.error("Failed to create recurring template:", err));
            }

            onSuccess(selectedContactIds);
            if (!embedFormOnly) onOpenChange?.(false);
            setFormData((prev) => ({ ...prev, date: new Date().toISOString().slice(0, 16), content: "", durationMinutes: "", messageCount: "" }));
            setIsRecurring(false);
            setRecurringType("WEEKLY");
            setCustomPeriod("WEEKLY");
            setRecurringInterval("1");
            setRecurringDaysOfWeek([]);
            setRecurringEndDate("");
            setSyncToCalendar(false);
            setEndTime("");
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async () => {
        if (!editInteraction) return;
        setDeleting(true);
        try {
            const res = await fetch(`/api/interactions/${editInteraction.id}`, {
                method: "DELETE",
            });
            if (!res.ok) {
                throw new Error("Failed to delete interaction");
            }
            onDelete?.();
            onSuccess(selectedContactIds);
            if (!embedFormOnly) onOpenChange?.(false);
        } catch (err) {
            console.error(err);
        } finally {
            setDeleting(false);
        }
    };

    const formBody = (
        <>
                    {!hideContactSelector && (
                    <div className="grid grid-cols-1 sm:grid-cols-4 items-start gap-2 sm:gap-4">
                        <Label className="sm:text-right pt-0 sm:pt-2">
                            Contacts
                        </Label>
                        <div className="sm:col-span-3 space-y-2">
                            <div className="flex flex-wrap gap-2 mb-2">
                                {selectedContactIds.map(id => {
                                    const contact = contacts.find(c => c.id === id);
                                    if (!contact && id !== contactId) return null; // Wait for load
                                    // Fallback name if not found yet (e.g. current contact)
                                    const name = contact?.name || (id === contactId ? "Current Contact" : "Unknown");
                                    return (
                                        <Badge key={id} variant="secondary" className={cn("pr-1 gap-1", !showFullForm && "pr-2")}>
                                            {name}
                                            {showFullForm && (
                                                <button
                                                    type="button"
                                                    onClick={() => removeContact(id)}
                                                    className="hover:bg-muted p-0.5 rounded-full"
                                                >
                                                    <X className="h-3 w-3" />
                                                </button>
                                            )}
                                        </Badge>
                                    );
                                })}
                            </div>

                            {showFullForm && (
                                <Popover open={openCombobox} onOpenChange={setOpenCombobox}>
                                    <PopoverTrigger asChild>
                                        <Button
                                            variant="outline"
                                            role="combobox"
                                            aria-expanded={openCombobox}
                                            className="w-full justify-between"
                                        >
                                            Add people...
                                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-[300px] p-0">
                                        <Command>
                                            <CommandInput placeholder="Search contacts..." />
                                            <CommandList>
                                                <CommandEmpty>No contact found.</CommandEmpty>
                                                <CommandGroup>
                                                    {contacts.map((contact) => (
                                                        <CommandItem
                                                            key={contact.id}
                                                            value={contact.name}
                                                            onSelect={() => {
                                                                toggleContact(contact.id);
                                                            }}
                                                        >
                                                            <Check
                                                                className={cn(
                                                                    "mr-2 h-4 w-4",
                                                                    selectedContactIds.includes(contact.id)
                                                                        ? "opacity-100"
                                                                        : "opacity-0"
                                                                )}
                                                            />
                                                            {contact.name}
                                                        </CommandItem>
                                                    ))}
                                                </CommandGroup>
                                            </CommandList>
                                        </Command>
                                    </PopoverContent>
                                </Popover>
                            )}
                        </div>
                    </div>
                    )}

                    {showFullForm && (
                    <div className="grid grid-cols-1 sm:grid-cols-4 items-start gap-2 sm:gap-4">
                        <Label htmlFor="date" className="sm:text-right pt-0 sm:pt-2">
                            Date
                        </Label>
                        <div className="sm:col-span-3">
                            <Popover>
                                <PopoverTrigger asChild>
                                    <Button
                                        variant={"outline"}
                                        className={cn(
                                            "w-full pl-3 text-left font-normal",
                                            !formData.date && "text-muted-foreground"
                                        )}
                                    >
                                        {formData.date ? (
                                            format(new Date(formData.date), "PPP")
                                        ) : (
                                            <span>Pick a date</span>
                                        )}
                                        <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0" align="start">
                                    <Calendar
                                        mode="single"
                                        selected={new Date(formData.date)}
                                        onSelect={(date) => {
                                            if (date) {
                                                // Preserve time
                                                const current = parseLocalISO(formData.date);
                                                date.setHours(current.getHours());
                                                date.setMinutes(current.getMinutes());

                                                const newDate = new Date(current);
                                                newDate.setFullYear(date.getFullYear(), date.getMonth(), date.getDate());

                                                const offset = newDate.getTimezoneOffset() * 60000;
                                                const localISOTime = (new Date(newDate.getTime() - offset)).toISOString().slice(0, 16);
                                                handleChange("date", localISOTime);
                                            }
                                        }}
                                        disabled={(date) =>
                                            date > new Date() || date < new Date("1900-01-01")
                                        }
                                        initialFocus
                                    />
                                </PopoverContent>
                            </Popover>

                            {!isEditing && (
                                <label className="flex items-center gap-2 mt-2 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={syncToCalendar}
                                        onChange={(e) => setSyncToCalendar(e.target.checked)}
                                        className="rounded border-input"
                                    />
                                    <span className="text-sm text-muted-foreground">Add to Google Calendar</span>
                                </label>
                            )}
                        </div>
                    </div>
                    )}
                    {showFullForm && (
                    <>
                    <div className="grid grid-cols-1 sm:grid-cols-4 items-center gap-2 sm:gap-4">
                        <Label className="sm:text-right">
                            {syncToCalendar ? "Start Time" : "Time"}
                        </Label>
                        <div className="sm:col-span-3 flex gap-1 items-center">
                            {/* Hour */}
                            <NativeSelect
                                value={(() => {
                                    if (!formData.date) return "12";
                                    const date = parseLocalISO(formData.date);
                                    let h = date.getHours();
                                    if (h === 0) h = 12;
                                    else if (h > 12) h -= 12;
                                    return h.toString();
                                })()}
                                onChange={(e) => {
                                    const newHour12 = parseInt(e.target.value);
                                    const date = parseLocalISO(formData.date);
                                    let h = date.getHours();
                                    const isPm = h >= 12;

                                    let newHour24 = newHour12;
                                    if (newHour12 === 12) {
                                        newHour24 = 0;
                                    }
                                    if (isPm) {
                                        newHour24 += 12;
                                    }

                                    // Fix specific PM/AM logic
                                    if (isPm) {
                                        if (newHour12 === 12) newHour24 = 12;
                                        else newHour24 = newHour12 + 12;
                                    } else {
                                        if (newHour12 === 12) newHour24 = 0;
                                        else newHour24 = newHour12;
                                    }

                                    date.setHours(newHour24);
                                    const offset = date.getTimezoneOffset() * 60000;
                                    const localISOTime = (new Date(date.getTime() - offset)).toISOString().slice(0, 16);
                                    handleChange("date", localISOTime);
                                }}
                                className="w-[70px]"
                            >
                                {Array.from({ length: 12 }, (_, i) => i + 1).map((h) => (
                                    <NativeSelectOption key={h} value={h}>
                                        {h}
                                    </NativeSelectOption>
                                ))}
                            </NativeSelect>

                            <span className="text-muted-foreground">:</span>

                            {/* Minute */}
                            <NativeSelect
                                value={(() => {
                                    if (!formData.date) return "00";
                                    const m = parseLocalISO(formData.date).getMinutes();
                                    return m.toString().padStart(2, '0');
                                })()}
                                onChange={(e) => {
                                    const newMin = parseInt(e.target.value);
                                    const date = parseLocalISO(formData.date);
                                    date.setMinutes(newMin);
                                    const offset = date.getTimezoneOffset() * 60000;
                                    const localISOTime = (new Date(date.getTime() - offset)).toISOString().slice(0, 16);
                                    handleChange("date", localISOTime);
                                }}
                                className="w-[70px]"
                            >
                                {Array.from({ length: 12 }, (_, i) => i * 5).map((m) => (
                                    <NativeSelectOption key={m} value={m.toString().padStart(2, '0')}>
                                        {m.toString().padStart(2, '0')}
                                    </NativeSelectOption>
                                ))}
                            </NativeSelect>

                            {/* AM/PM */}
                            <NativeSelect
                                value={(() => {
                                    if (!formData.date) return "AM";
                                    return parseLocalISO(formData.date).getHours() >= 12 ? "PM" : "AM";
                                })()}
                                onChange={(e) => {
                                    const newAmPm = e.target.value; // "AM" or "PM"
                                    const date = parseLocalISO(formData.date);
                                    let h = date.getHours();

                                    if (newAmPm === "PM" && h < 12) {
                                        h += 12;
                                    } else if (newAmPm === "AM" && h >= 12) {
                                        h -= 12;
                                    }

                                    date.setHours(h);
                                    const offset = date.getTimezoneOffset() * 60000;
                                    const localISOTime = (new Date(date.getTime() - offset)).toISOString().slice(0, 16);
                                    handleChange("date", localISOTime);
                                }}
                                className="w-[70px]"
                            >
                                <NativeSelectOption value="AM">AM</NativeSelectOption>
                                <NativeSelectOption value="PM">PM</NativeSelectOption>
                            </NativeSelect>
                        </div>
                    </div>

                    {syncToCalendar && (
                        <div className="grid grid-cols-1 sm:grid-cols-4 items-center gap-2 sm:gap-4">
                            <Label className="sm:text-right">
                                End Time
                            </Label>
                            <div className="sm:col-span-3 flex gap-1 items-center">
                                {/* Hour */}
                                <NativeSelect
                                    value={(() => {
                                        if (!endTime) return "12";
                                        const date = parseLocalISO(endTime);
                                        let h = date.getHours();
                                        if (h === 0) h = 12;
                                        else if (h > 12) h -= 12;
                                        return h.toString();
                                    })()}
                                    onChange={(e) => {
                                        const newHour12 = parseInt(e.target.value);
                                        const date = endTime ? parseLocalISO(endTime) : parseLocalISO(formData.date);
                                        let h = date.getHours();
                                        const isPm = h >= 12;

                                        let newHour24 = newHour12;
                                        if (isPm) {
                                            if (newHour12 === 12) newHour24 = 12;
                                            else newHour24 = newHour12 + 12;
                                        } else {
                                            if (newHour12 === 12) newHour24 = 0;
                                            else newHour24 = newHour12;
                                        }

                                        date.setHours(newHour24);
                                        const offset = date.getTimezoneOffset() * 60000;
                                        setEndTime((new Date(date.getTime() - offset)).toISOString().slice(0, 16));
                                    }}
                                    className="w-[70px]"
                                >
                                    {Array.from({ length: 12 }, (_, i) => i + 1).map((h) => (
                                        <NativeSelectOption key={h} value={h}>
                                            {h}
                                        </NativeSelectOption>
                                    ))}
                                </NativeSelect>

                                <span className="text-muted-foreground">:</span>

                                {/* Minute */}
                                <NativeSelect
                                    value={(() => {
                                        if (!endTime) return "00";
                                        const m = parseLocalISO(endTime).getMinutes();
                                        return m.toString().padStart(2, '0');
                                    })()}
                                    onChange={(e) => {
                                        const newMin = parseInt(e.target.value);
                                        const date = endTime ? parseLocalISO(endTime) : parseLocalISO(formData.date);
                                        date.setMinutes(newMin);
                                        const offset = date.getTimezoneOffset() * 60000;
                                        setEndTime((new Date(date.getTime() - offset)).toISOString().slice(0, 16));
                                    }}
                                    className="w-[70px]"
                                >
                                    {Array.from({ length: 12 }, (_, i) => i * 5).map((m) => (
                                        <NativeSelectOption key={m} value={m.toString().padStart(2, '0')}>
                                            {m.toString().padStart(2, '0')}
                                        </NativeSelectOption>
                                    ))}
                                </NativeSelect>

                                {/* AM/PM */}
                                <NativeSelect
                                    value={(() => {
                                        if (!endTime) return "AM";
                                        return parseLocalISO(endTime).getHours() >= 12 ? "PM" : "AM";
                                    })()}
                                    onChange={(e) => {
                                        const newAmPm = e.target.value;
                                        const date = endTime ? parseLocalISO(endTime) : parseLocalISO(formData.date);
                                        let h = date.getHours();

                                        if (newAmPm === "PM" && h < 12) {
                                            h += 12;
                                        } else if (newAmPm === "AM" && h >= 12) {
                                            h -= 12;
                                        }

                                        date.setHours(h);
                                        const offset = date.getTimezoneOffset() * 60000;
                                        setEndTime((new Date(date.getTime() - offset)).toISOString().slice(0, 16));
                                    }}
                                    className="w-[70px]"
                                >
                                    <NativeSelectOption value="AM">AM</NativeSelectOption>
                                    <NativeSelectOption value="PM">PM</NativeSelectOption>
                                </NativeSelect>
                            </div>
                        </div>
                    )}
                    </>
                    )}

                    {showFullForm && (
                    <div className="grid grid-cols-1 sm:grid-cols-4 items-center gap-2 sm:gap-4">
                        <Label htmlFor="type" className="sm:text-right">
                            Type
                        </Label>
                        <Input
                            id="type"
                            value={formData.type}
                            onChange={(e) => handleChange("type", e.target.value)}
                            className="sm:col-span-3"
                            placeholder="e.g. Meeting, Call"
                        />
                    </div>
                    )}
                    <div className="grid grid-cols-1 sm:grid-cols-4 items-center gap-2 sm:gap-4">
                        <Label htmlFor="platform" className="sm:text-right">
                            Platform
                        </Label>
                        <NativeSelect
                            id="platform"
                            value={formData.platform}
                            onChange={(e) => handleChange("platform", e.target.value)}
                            className="sm:col-span-3"
                        >
                            {INTERACTION_PLATFORMS.map((p) => (
                                <NativeSelectOption key={p.value} value={p.value}>
                                    {p.label}
                                </NativeSelectOption>
                            ))}
                        </NativeSelect>
                    </div>
                    {/* Recurring toggle — only for new interactions */}
                    {showFullForm && !isEditing && (
                        <div className="grid grid-cols-1 sm:grid-cols-4 items-start gap-2 sm:gap-4">
                            <Label className="sm:text-right">Recurring</Label>
                            <div className="sm:col-span-3 space-y-3">
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={isRecurring}
                                        onChange={(e) => setIsRecurring(e.target.checked)}
                                        className="rounded border-input"
                                    />
                                    <span className="text-sm">Make this a recurring interaction</span>
                                </label>
                                {isRecurring && (
                                    <div className="space-y-4 pl-6 border-l-2 border-muted">
                                        <NativeSelect
                                            value={recurringType}
                                            onChange={(e) => {
                                                const val = e.target.value as "DAILY" | "WEEKLY" | "BIWEEKLY" | "MONTHLY" | "CUSTOM";
                                                setRecurringType(val);
                                                if (val !== "CUSTOM") {
                                                    setRecurringInterval("1");
                                                    setRecurringDaysOfWeek([]);
                                                } else {
                                                    setCustomPeriod("WEEKLY"); // default back to Custom Weekly type
                                                }
                                            }}
                                        >
                                            <NativeSelectOption value="DAILY">Daily</NativeSelectOption>
                                            <NativeSelectOption value="WEEKLY">Weekly</NativeSelectOption>
                                            <NativeSelectOption value="BIWEEKLY">Every 2 Weeks</NativeSelectOption>
                                            <NativeSelectOption value="MONTHLY">Monthly</NativeSelectOption>
                                            <NativeSelectOption value="CUSTOM">Custom...</NativeSelectOption>
                                        </NativeSelect>

                                        {recurringType === "CUSTOM" && (
                                            <div className="space-y-4 pt-2 pb-2 bg-muted/30 p-3 rounded-md border border-border/50">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-sm">Repeat every</span>
                                                    <Input
                                                        type="number"
                                                        min="1"
                                                        className="w-20"
                                                        value={recurringInterval}
                                                        onChange={(e) => setRecurringInterval(e.target.value)}
                                                    />
                                                    <NativeSelect
                                                        value={customPeriod}
                                                        onChange={(e) => setCustomPeriod(e.target.value as "DAILY" | "WEEKLY" | "MONTHLY")}
                                                        className="w-32"
                                                    >
                                                        <NativeSelectOption value="DAILY">day(s)</NativeSelectOption>
                                                        <NativeSelectOption value="WEEKLY">week(s)</NativeSelectOption>
                                                        <NativeSelectOption value="MONTHLY">month(s)</NativeSelectOption>
                                                    </NativeSelect>
                                                </div>

                                                {/* Day of week selector if Weekly is chosen */}
                                                {customPeriod === "WEEKLY" && (
                                                    <div className="space-y-2">
                                                        <span className="text-sm block">Repeat on</span>
                                                        <div className="flex gap-2 flex-wrap">
                                                            {["S", "M", "T", "W", "T", "F", "S"].map((day, i) => (
                                                                <button
                                                                    key={i}
                                                                    type="button"
                                                                    onClick={() => {
                                                                        setRecurringDaysOfWeek(prev =>
                                                                            prev.includes(i)
                                                                                ? prev.filter(d => d !== i)
                                                                                : [...prev, i]
                                                                        );
                                                                    }}
                                                                    className={cn(
                                                                        "w-8 h-8 rounded-full text-xs font-medium border flex items-center justify-center transition-colors",
                                                                        recurringDaysOfWeek.includes(i)
                                                                            ? "bg-primary text-primary-foreground border-primary"
                                                                            : "bg-background text-muted-foreground hover:bg-muted"
                                                                    )}
                                                                >
                                                                    {day}
                                                                </button>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        )}

                                        <div className="flex flex-col mt-2">
                                            <Label className="text-xs text-muted-foreground mb-1">End date (optional)</Label>
                                            <Popover>
                                                <PopoverTrigger asChild>
                                                    <Button
                                                        variant={"outline"}
                                                        className={cn(
                                                            "w-[240px] pl-3 text-left font-normal",
                                                            !recurringEndDate && "text-muted-foreground"
                                                        )}
                                                    >
                                                        {recurringEndDate ? (
                                                            format(new Date(recurringEndDate + "T12:00:00"), "PPP")
                                                        ) : (
                                                            <span>Pick a date</span>
                                                        )}
                                                        <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                                    </Button>
                                                </PopoverTrigger>
                                                <PopoverContent className="w-auto p-0" align="start">
                                                    <Calendar
                                                        mode="single"
                                                        selected={recurringEndDate ? new Date(recurringEndDate + "T12:00:00") : undefined}
                                                        onSelect={(date) => {
                                                            if (date) {
                                                                const year = date.getFullYear();
                                                                const month = String(date.getMonth() + 1).padStart(2, '0');
                                                                const day = String(date.getDate()).padStart(2, '0');
                                                                setRecurringEndDate(`${year}-${month}-${day}`);
                                                            } else {
                                                                setRecurringEndDate("");
                                                            }
                                                        }}
                                                        disabled={(date) =>
                                                            date < new Date(new Date(formData.date).setHours(0, 0, 0, 0))
                                                        }
                                                        initialFocus
                                                    />
                                                </PopoverContent>
                                            </Popover>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Duration, Total Messages, Notes — bottom right above Save */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 items-center gap-x-3 sm:gap-x-4 gap-y-3 w-full">
                        <Label htmlFor="durationMinutes" className="sm:text-right text-muted-foreground text-sm">
                            Duration (mins)
                        </Label>
                        <Input
                            id="durationMinutes"
                            type="number"
                            min="0"
                            value={formData.durationMinutes}
                            onChange={(e) => handleChange("durationMinutes", e.target.value)}
                            className="w-full sm:w-24 justify-self-start"
                            placeholder="—"
                        />
                        <Label htmlFor="messageCount" className="sm:text-right text-muted-foreground text-sm">
                            Total Messages
                        </Label>
                        <Input
                            id="messageCount"
                            type="number"
                            min="1"
                            value={formData.messageCount}
                            onChange={(e) => handleChange("messageCount", e.target.value)}
                            className="w-full sm:w-24 justify-self-start"
                            placeholder="—"
                        />
                        <Label htmlFor="content" className="sm:text-right text-muted-foreground text-sm pt-2 self-start">
                            Notes
                        </Label>
                        <Textarea
                            id="content"
                            value={formData.content}
                            onChange={(e) => handleChange("content", e.target.value)}
                            className="col-span-1 sm:col-span-3 resize-none justify-self-stretch"
                            placeholder="Optional notes..."
                            rows={2}
                        />
                    </div>

                    <DialogFooter>
                        {isEditing && (
                            <Button
                                type="button"
                                variant="destructive"
                                onClick={handleDelete}
                                disabled={deleting}
                                className="mr-auto"
                            >
                                {deleting ? "Deleting..." : "Delete"}
                            </Button>
                        )}
                        <Button type="button" variant="outline" onClick={() => embedFormOnly ? onCancel?.() : onOpenChange?.(false)}>
                            Cancel
                        </Button>
                        <Button type="submit" disabled={loading}>
                            {loading ? "Saving..." : isEditing ? "Update" : "Save"}
                        </Button>
                    </DialogFooter>
        </>
    );

    if (embedFormOnly) {
        return <form onSubmit={handleSubmit} className="grid gap-4 py-4">{formBody}</form>;
    }
    return (
        <Dialog open={open} onOpenChange={onOpenChange!}>
            <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto border border-border dark:border-border/30">
                <DialogHeader>
                    <DialogTitle>{isEditing ? "Edit Interaction" : "Log Interaction"}</DialogTitle>
                    <DialogDescription>
                        {isEditing ? "Update this interaction." : "Record a new interaction."}
                    </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="grid gap-4 py-4">{formBody}</form>
            </DialogContent>
        </Dialog>
    );
}
