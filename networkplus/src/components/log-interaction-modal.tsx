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

const PLATFORMS = [
    { value: "SMS", label: "SMS" },
    { value: "CALL", label: "Call" },
    { value: "EMAIL", label: "Email" },
    { value: "INSTAGRAM", label: "Instagram" },
    { value: "DISCORD", label: "Discord" },
    { value: "WHATSAPP", label: "WhatsApp" },
    { value: "FACEBOOK", label: "Facebook" },
    { value: "LINKEDIN", label: "LinkedIn" },
    { value: "SNAPCHAT", label: "Snapchat" },
    { value: "TELEGRAM", label: "Telegram" },
    { value: "IN_PERSON", label: "In Person" },
    { value: "OTHER", label: "Other" },
];

interface LogInteractionModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    contactId: string;
    onSuccess: (contactIds: string[]) => void;
}

interface ContactOption {
    id: string;
    name: string;
}

export function LogInteractionModal({
    open,
    onOpenChange,
    contactId,
    onSuccess,
}: LogInteractionModalProps) {
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        type: "Interaction",
        platform: "OTHER",
        date: new Date().toISOString().slice(0, 16), // datetime-local format YYYY-MM-DDTHH:mm
        content: "",
    });

    const [selectedContactIds, setSelectedContactIds] = useState<string[]>([]);
    const [contacts, setContacts] = useState<ContactOption[]>([]);
    const [openCombobox, setOpenCombobox] = useState(false);

    useEffect(() => {
        if (open) {
            // Reset selection to just the current contact when opening (or keep previous if desired?)
            // Usually we want to start with the current contact selected.
            setSelectedContactIds([contactId]);

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
    }, [open, contactId]);

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

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            const res = await fetch("/api/interactions", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    contactIds: selectedContactIds, // Send array
                    type: formData.type,
                    platform: formData.platform,
                    content: formData.content,
                    date: new Date(formData.date).toISOString(),
                }),
            });

            if (!res.ok) {
                throw new Error("Failed to log interaction");
            }

            onSuccess(selectedContactIds);
            onOpenChange(false);
            setFormData((prev) => ({ ...prev, date: new Date().toISOString().slice(0, 16), content: "" }));
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle>Log Interaction</DialogTitle>
                    <DialogDescription>
                        Record a new interaction.
                    </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="grid gap-4 py-4">
                    <div className="grid grid-cols-4 items-start gap-4">
                        <Label className="text-right pt-2">
                            Contacts
                        </Label>
                        <div className="col-span-3 space-y-2">
                            <div className="flex flex-wrap gap-2 mb-2">
                                {selectedContactIds.map(id => {
                                    const contact = contacts.find(c => c.id === id);
                                    if (!contact && id !== contactId) return null; // Wait for load
                                    // Fallback name if not found yet (e.g. current contact)
                                    const name = contact?.name || (id === contactId ? "Current Contact" : "Unknown");
                                    return (
                                        <Badge key={id} variant="secondary" className="pr-1 gap-1">
                                            {name}
                                            <button
                                                type="button"
                                                onClick={() => removeContact(id)}
                                                className="hover:bg-muted p-0.5 rounded-full"
                                            >
                                                <X className="h-3 w-3" />
                                            </button>
                                        </Badge>
                                    );
                                })}
                            </div>

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
                                                            // Keep open for multi-select
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
                        </div>
                    </div>

                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="date" className="text-right pt-2">
                            Date
                        </Label>
                        <div className="col-span-3">
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
                                                const current = new Date(formData.date);
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
                        </div>
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label className="text-right">
                            Time
                        </Label>
                        <div className="col-span-3 flex gap-1 items-center">
                            {/* Hour */}
                            <NativeSelect
                                value={(() => {
                                    if (!formData.date) return "12";
                                    const date = new Date(formData.date);
                                    let h = date.getHours();
                                    if (h === 0) h = 12;
                                    else if (h > 12) h -= 12;
                                    return h.toString();
                                })()}
                                onChange={(e) => {
                                    const newHour12 = parseInt(e.target.value);
                                    const date = new Date(formData.date);
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
                                    const m = new Date(formData.date).getMinutes();
                                    return m.toString().padStart(2, '0');
                                })()}
                                onChange={(e) => {
                                    const newMin = parseInt(e.target.value);
                                    const date = new Date(formData.date);
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
                                    return new Date(formData.date).getHours() >= 12 ? "PM" : "AM";
                                })()}
                                onChange={(e) => {
                                    const newAmPm = e.target.value; // "AM" or "PM"
                                    const date = new Date(formData.date);
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
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="type" className="text-right">
                            Type
                        </Label>
                        <Input
                            id="type"
                            value={formData.type}
                            onChange={(e) => handleChange("type", e.target.value)}
                            className="col-span-3"
                            placeholder="e.g. Meeting, Call"
                        />
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="platform" className="text-right">
                            Platform
                        </Label>
                        <NativeSelect
                            id="platform"
                            value={formData.platform}
                            onChange={(e) => handleChange("platform", e.target.value)}
                            className="col-span-3"
                        >
                            {PLATFORMS.map((p) => (
                                <NativeSelectOption key={p.value} value={p.value}>
                                    {p.label}
                                </NativeSelectOption>
                            ))}
                        </NativeSelect>
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="content" className="text-right">
                            Notes
                        </Label>
                        <Textarea
                            id="content"
                            value={formData.content}
                            onChange={(e) => handleChange("content", e.target.value)}
                            className="col-span-3"
                            placeholder="Optional notes..."
                        />
                    </div>
                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                            Cancel
                        </Button>
                        <Button type="submit" disabled={loading}>
                            {loading ? "Saving..." : "Save"}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
