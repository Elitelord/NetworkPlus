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

type Contact = {
    id: string;
    name: string;
    email?: string | null;
};

interface ScheduleEventModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    contacts: Contact[];
    defaultDate?: string;
    onSuccess: () => void;
}

export function ScheduleEventModal({
    open,
    onOpenChange,
    contacts,
    defaultDate,
    onSuccess,
}: ScheduleEventModalProps) {
    const [title, setTitle] = useState("");
    const [description, setDescription] = useState("");
    const [startTime, setStartTime] = useState("");
    const [endTime, setEndTime] = useState("");
    const [selectedContactIds, setSelectedContactIds] = useState<string[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [contactSearch, setContactSearch] = useState("");

    useEffect(() => {
        if (open && defaultDate) {
            setStartTime(defaultDate.slice(0, 16));
            // Default end = start + 1 hour
            const d = new Date(defaultDate);
            d.setHours(d.getHours() + 1);
            setEndTime(d.toISOString().slice(0, 16));
        }
    }, [open, defaultDate]);

    function reset() {
        setTitle("");
        setDescription("");
        setStartTime("");
        setEndTime("");
        setSelectedContactIds([]);
        setError(null);
        setContactSearch("");
    }

    function toggleContact(id: string) {
        setSelectedContactIds(prev =>
            prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]
        );
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        if (!title.trim() || !startTime) return;

        setLoading(true);
        setError(null);

        try {
            // Get emails of selected contacts
            const attendeeEmails = selectedContactIds
                .map(id => contacts.find(c => c.id === id)?.email)
                .filter(Boolean) as string[];

            const res = await fetch("/api/calendar/events", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    title: title.trim(),
                    description: description.trim(),
                    startTime,
                    endTime: endTime || undefined,
                    contactIds: selectedContactIds,
                    attendeeEmails,
                }),
            });

            if (!res.ok) {
                const data = await res.json().catch(() => null);
                throw new Error(data?.error || "Failed to create event");
            }

            reset();
            onOpenChange(false);
            onSuccess();
        } catch (err: any) {
            setError(err.message || "Something went wrong");
        } finally {
            setLoading(false);
        }
    }

    const filteredContacts = contacts.filter(c =>
        c.name.toLowerCase().includes(contactSearch.toLowerCase())
    );

    return (
        <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v); }}>
            <DialogContent className="sm:max-w-[480px]">
                <DialogHeader>
                    <DialogTitle>Schedule Event</DialogTitle>
                    <DialogDescription>
                        Create a Google Calendar event and log it as an interaction.
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="event-title">Title</Label>
                        <Input
                            id="event-title"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            placeholder="e.g. Coffee with John"
                            required
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="event-desc">Description (optional)</Label>
                        <Textarea
                            id="event-desc"
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder="Add details..."
                            rows={2}
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-2">
                            <Label htmlFor="event-start">Start</Label>
                            <Input
                                id="event-start"
                                type="datetime-local"
                                value={startTime}
                                onChange={(e) => setStartTime(e.target.value)}
                                required
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="event-end">End</Label>
                            <Input
                                id="event-end"
                                type="datetime-local"
                                value={endTime}
                                onChange={(e) => setEndTime(e.target.value)}
                            />
                        </div>
                    </div>

                    {/* Contact selection */}
                    <div className="space-y-2">
                        <Label>Contacts (optional)</Label>
                        <Input
                            value={contactSearch}
                            onChange={(e) => setContactSearch(e.target.value)}
                            placeholder="Search contacts..."
                            className="mb-2"
                        />

                        {/* Selected contacts */}
                        {selectedContactIds.length > 0 && (
                            <div className="flex flex-wrap gap-1.5 mb-2">
                                {selectedContactIds.map(id => {
                                    const c = contacts.find(c => c.id === id);
                                    return c ? (
                                        <button
                                            key={id}
                                            type="button"
                                            onClick={() => toggleContact(id)}
                                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
                                        >
                                            {c.name}
                                            <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                                        </button>
                                    ) : null;
                                })}
                            </div>
                        )}

                        <div className="max-h-32 overflow-y-auto border rounded-md">
                            {filteredContacts.slice(0, 10).map(contact => (
                                <button
                                    key={contact.id}
                                    type="button"
                                    onClick={() => toggleContact(contact.id)}
                                    className={`w-full text-left px-3 py-1.5 text-sm border-b last:border-0 transition-colors
                                        ${selectedContactIds.includes(contact.id) ? "bg-primary/5" : "hover:bg-accent"}
                                    `}
                                >
                                    <span className="font-medium">{contact.name}</span>
                                    {contact.email && (
                                        <span className="text-xs text-muted-foreground ml-2">{contact.email}</span>
                                    )}
                                    {selectedContactIds.includes(contact.id) && (
                                        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="inline ml-1 text-primary"><polyline points="20 6 9 17 4 12" /></svg>
                                    )}
                                </button>
                            ))}
                            {filteredContacts.length === 0 && (
                                <p className="text-xs text-muted-foreground p-3 text-center">No contacts found</p>
                            )}
                        </div>
                    </div>

                    {error && (
                        <p className="text-sm text-destructive">{error}</p>
                    )}

                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => { reset(); onOpenChange(false); }}>
                            Cancel
                        </Button>
                        <Button type="submit" disabled={loading || !title.trim() || !startTime}>
                            {loading ? "Creating…" : "Create Event"}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
