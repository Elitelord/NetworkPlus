"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LogInteractionModal, EditInteractionData } from "@/components/log-interaction-modal";
import { ReachOutModal } from "@/components/reach-out-modal";

type CalendarEvent = {
    id: string;
    summary: string;
    description: string;
    location: string;
    start: string;
    end: string;
    attendees: { email: string; displayName?: string; responseStatus: string }[];
    htmlLink?: string;
};

type Interaction = {
    id: string;
    type: string;
    platform: string;
    date: string;
    content?: string;
    calendarEventId?: string;
    isRecurring?: boolean;
    contacts?: { id: string; name: string }[];
    durationSeconds?: number;
    messageCount?: number;
};

type Contact = {
    id: string;
    name: string;
    email?: string | null;
};

/* ── Helpers ─────────────────────────────────────────── */

function isSameDay(a: Date, b: Date) {
    return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function getDaysInMonth(year: number, month: number) {
    return new Date(year, month + 1, 0).getDate();
}

function getMonthStartDay(year: number, month: number) {
    return new Date(year, month, 1).getDay();
}

const MONTH_NAMES = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
];

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const PLATFORM_COLORS: Record<string, string> = {
    CALL: "bg-blue-500/20 text-blue-700 dark:text-blue-300",
    IN_PERSON: "bg-green-500/20 text-green-700 dark:text-green-300",
    EMAIL: "bg-orange-500/20 text-orange-700 dark:text-orange-300",
    DISCORD: "bg-indigo-500/20 text-indigo-700 dark:text-indigo-300",
    WHATSAPP: "bg-emerald-500/20 text-emerald-700 dark:text-emerald-300",
    SMS: "bg-teal-500/20 text-teal-700 dark:text-teal-300",
    LINKEDIN: "bg-sky-500/20 text-sky-700 dark:text-sky-300",
    OTHER: "bg-gray-500/20 text-gray-700 dark:text-gray-300",
};

/* ── Component ───────────────────────────────────────── */

export default function CalendarPage() {
    const today = new Date();
    const [currentMonth, setCurrentMonth] = useState(today.getMonth());
    const [currentYear, setCurrentYear] = useState(today.getFullYear());
    const [selectedDate, setSelectedDate] = useState<Date>(today);
    const [interactions, setInteractions] = useState<Interaction[]>([]);
    const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([]);
    const [contacts, setContacts] = useState<Contact[]>([]);
    const [syncing, setSyncing] = useState<string | null>(null); // 'google' | null
    const [syncResult, setSyncResult] = useState<string | null>(null);
    const [loadingInteractions, setLoadingInteractions] = useState(false);
    const [loadingEvents, setLoadingEvents] = useState(false);
    const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
    const [reachOutState, setReachOutState] = useState<{ preselectedIds: string[]; defaultDate?: string } | null>(null);
    const [editingInteraction, setEditingInteraction] = useState<EditInteractionData | undefined>(undefined);

    /* ── Data fetching ──────────────────────────────── */

    const fetchInteractions = useCallback(async () => {
        setLoadingInteractions(true);
        try {
            // Fetch all interactions (we'll filter by month client-side)
            const res = await fetch("/api/contacts", { credentials: "include" });
            if (!res.ok) return;
            const contactsData: any[] = await res.json();
            setContacts(contactsData.map((c: any) => ({ id: c.id, name: c.name, email: c.email })));

            // Fetch ALL interactions from all contacts in the visible range
            const allInteractions: Interaction[] = [];
            for (const contact of contactsData) {
                const iRes = await fetch(`/api/contacts/${contact.id}/interactions`);
                if (iRes.ok) {
                    const data = await iRes.json();
                    for (const interaction of data) {
                        // Avoid duplicates
                        if (!allInteractions.some(i => i.id === interaction.id)) {
                            allInteractions.push({
                                ...interaction,
                                contacts: [{ id: contact.id, name: contact.name }],
                            });
                        } else {
                            // Merge contact info
                            const existing = allInteractions.find(i => i.id === interaction.id);
                            if (existing && existing.contacts) {
                                if (!existing.contacts.some(c => c.id === contact.id)) {
                                    existing.contacts.push({ id: contact.id, name: contact.name });
                                }
                            }
                        }
                    }
                }
            }
            setInteractions(allInteractions);
        } catch (err) {
            console.error("Failed to fetch interactions:", err);
        } finally {
            setLoadingInteractions(false);
        }
    }, []);

    const fetchCalendarEvents = useCallback(async () => {
        setLoadingEvents(true);
        try {
            const res = await fetch("/api/calendar/events");
            if (res.ok) {
                const data = await res.json();
                setCalendarEvents(data.events || []);
            }
        } catch (err) {
            console.error("Failed to fetch calendar events:", err);
        } finally {
            setLoadingEvents(false);
        }
    }, []);

    useEffect(() => {
        fetchInteractions();
        fetchCalendarEvents();
    }, [fetchInteractions, fetchCalendarEvents]);

    /* ── Sync handler ───────────────────────────────── */

    async function handleSync(provider: "google") {
        setSyncing(provider);
        setSyncResult(null);
        const endpoint = "/api/sync/google-calendar";
        const label = "Google";
        try {
            const res = await fetch(endpoint, {
                method: "POST",
                credentials: "include",
            });
            if (res.ok) {
                const data = await res.json();
                setSyncResult(`${label}: Synced ${data.synced} new events from ${data.eventsProcessed} total`);
                fetchInteractions();
                fetchCalendarEvents();
            } else {
                const data = await res.json().catch(() => null);
                setSyncResult(`${label} sync failed: ${data?.error || res.statusText}`);
            }
        } catch (err) {
            setSyncResult(`${label} sync failed: network error`);
        } finally {
            setSyncing(null);
        }
    }

    /* ── Month navigation ───────────────────────────── */

    function prevMonth() {
        if (currentMonth === 0) {
            setCurrentMonth(11);
            setCurrentYear(y => y - 1);
        } else {
            setCurrentMonth(m => m - 1);
        }
    }

    function nextMonth() {
        if (currentMonth === 11) {
            setCurrentMonth(0);
            setCurrentYear(y => y + 1);
        } else {
            setCurrentMonth(m => m + 1);
        }
    }

    function goToToday() {
        setCurrentMonth(today.getMonth());
        setCurrentYear(today.getFullYear());
        setSelectedDate(today);
    }

    /* ── Computed data ──────────────────────────────── */

    // Map dates to interaction counts for the calendar grid
    const interactionsByDate = useMemo(() => {
        const map = new Map<string, Interaction[]>();
        for (const interaction of interactions) {
            const d = new Date(interaction.date);
            const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
            if (!map.has(key)) map.set(key, []);
            map.get(key)!.push(interaction);
        }
        return map;
    }, [interactions]);

    // Calendar events by date
    const eventsByDate = useMemo(() => {
        const map = new Map<string, CalendarEvent[]>();
        for (const event of calendarEvents) {
            const d = new Date(event.start);
            const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
            if (!map.has(key)) map.set(key, []);
            map.get(key)!.push(event);
        }
        return map;
    }, [calendarEvents]);

    // Selected day data
    const selectedKey = `${selectedDate.getFullYear()}-${selectedDate.getMonth()}-${selectedDate.getDate()}`;
    const selectedDayInteractions = interactionsByDate.get(selectedKey) || [];
    const selectedDayEvents = eventsByDate.get(selectedKey) || [];

    // Upcoming interactions (next 7 days)
    const upcomingInteractions = useMemo(() => {
        const nowTs = Date.now();
        const weekOut = nowTs + 7 * 24 * 60 * 60 * 1000;
        return interactions
            .filter(i => {
                const ts = new Date(i.date).getTime();
                return ts > nowTs && ts <= weekOut;
            })
            .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    }, [interactions]);

    /* ── Calendar grid ──────────────────────────────── */

    const daysInMonth = getDaysInMonth(currentYear, currentMonth);
    const startDay = getMonthStartDay(currentYear, currentMonth);
    const totalCells = Math.ceil((startDay + daysInMonth) / 7) * 7;

    const calendarCells: (number | null)[] = [];
    for (let i = 0; i < totalCells; i++) {
        const day = i - startDay + 1;
        calendarCells.push(day >= 1 && day <= daysInMonth ? day : null);
    }

    /* ── Render ──────────────────────────────────────── */

    return (
        <div className="flex min-h-[calc(100vh-3.5rem)] bg-zinc-50 dark:bg-black font-sans">
            {/* Main content */}
            <div className="flex-1 max-w-6xl mx-auto px-6 py-8">
                {/* Header */}
                <div className="flex items-center justify-between mb-8">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight">Calendar</h1>
                        <p className="text-muted-foreground text-sm mt-1">
                            View and manage your interactions and events
                        </p>
                    </div>
                    <div className="flex items-center gap-3">
                        <Button
                            variant="default"
                            size="sm"
                            onClick={() => handleSync("google")}
                            disabled={syncing !== null}
                        >
                            {syncing === "google" ? (
                                <>
                                    <svg className="animate-spin mr-1.5 h-3.5 w-3.5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                    </svg>
                                    Syncing…
                                </>
                            ) : (
                                <>
                                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-1.5"><polyline points="1 4 1 10 7 10" /><polyline points="23 20 23 14 17 14" /><path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15" /></svg>
                                    Sync Google
                                </>
                            )}
                        </Button>
                    </div>
                </div>

                {syncResult && (
                    <div className={`mb-6 p-3 rounded-lg border text-sm ${syncResult.includes("failed")
                        ? "bg-destructive/10 text-destructive border-destructive/20"
                        : "bg-green-50 text-green-700 border-green-200 dark:bg-green-900/10 dark:text-green-400 dark:border-green-800"
                        }`}>
                        {syncResult}
                    </div>
                )}

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Calendar Grid */}
                    <div className="lg:col-span-2">
                        <Card>
                            <CardHeader className="pb-4">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <button
                                            onClick={prevMonth}
                                            className="p-1.5 rounded-md hover:bg-accent transition-colors"
                                        >
                                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
                                        </button>
                                        <CardTitle className="text-lg min-w-[180px] text-center">
                                            {MONTH_NAMES[currentMonth]} {currentYear}
                                        </CardTitle>
                                        <button
                                            onClick={nextMonth}
                                            className="p-1.5 rounded-md hover:bg-accent transition-colors"
                                        >
                                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6" /></svg>
                                        </button>
                                    </div>
                                    <Button variant="ghost" size="sm" onClick={goToToday}>
                                        Today
                                    </Button>
                                </div>
                            </CardHeader>
                            <CardContent>
                                {/* Day headers */}
                                <div className="grid grid-cols-7 mb-2">
                                    {DAY_NAMES.map(day => (
                                        <div key={day} className="text-center text-xs font-medium text-muted-foreground py-2">
                                            {day}
                                        </div>
                                    ))}
                                </div>

                                {/* Calendar cells */}
                                <div className="grid grid-cols-7 border-t border-l">
                                    {calendarCells.map((day, idx) => {
                                        if (day === null) {
                                            return (
                                                <div key={`empty-${idx}`} className="border-b border-r min-h-[80px] bg-muted/30" />
                                            );
                                        }

                                        const cellDate = new Date(currentYear, currentMonth, day);
                                        const key = `${currentYear}-${currentMonth}-${day}`;
                                        const dayInteractions = interactionsByDate.get(key) || [];
                                        const dayEvents = eventsByDate.get(key) || [];
                                        const isToday = isSameDay(cellDate, today);
                                        const isSelected = isSameDay(cellDate, selectedDate);
                                        const hasContent = dayInteractions.length > 0 || dayEvents.length > 0;
                                        const isFuture = cellDate > today;

                                        return (
                                            <button
                                                key={`day-${day}`}
                                                onClick={() => setSelectedDate(cellDate)}
                                                className={`border-b border-r min-h-[80px] p-1.5 text-left transition-colors relative
                                                    ${isSelected ? "bg-primary/5 ring-2 ring-primary/30 ring-inset" : "hover:bg-accent/50"}
                                                    ${isToday ? "bg-accent/30" : ""}
                                                `}
                                            >
                                                <span className={`text-xs font-medium inline-flex items-center justify-center w-6 h-6 rounded-full
                                                    ${isToday ? "bg-primary text-primary-foreground" : ""}
                                                    ${isFuture && !isToday ? "text-muted-foreground" : ""}
                                                `}>
                                                    {day}
                                                </span>

                                                {/* Event dots */}
                                                {hasContent && (
                                                    <div className="mt-1 space-y-0.5">
                                                        {dayInteractions.slice(0, 2).map((interaction, i) => (
                                                            <div
                                                                key={i}
                                                                className={`text-[10px] leading-tight truncate px-1 py-0.5 rounded ${PLATFORM_COLORS[interaction.platform] || PLATFORM_COLORS.OTHER
                                                                    }`}
                                                            >
                                                                {interaction.content || interaction.type}
                                                            </div>
                                                        ))}
                                                        {dayEvents.filter(e => !dayInteractions.some(i => i.calendarEventId === e.id)).slice(0, 2).map((event, i) => (
                                                            <div
                                                                key={`e-${i}`}
                                                                className="text-[10px] leading-tight truncate px-1 py-0.5 rounded bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
                                                            >
                                                                {event.summary}
                                                            </div>
                                                        ))}
                                                        {(dayInteractions.length + dayEvents.length) > 2 && (
                                                            <div className="text-[10px] text-muted-foreground pl-1">
                                                                +{dayInteractions.length + dayEvents.length - 2} more
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                            </button>
                                        );
                                    })}
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Right panel */}
                    <div className="space-y-6">
                        {/* Selected day detail */}
                        <Card>
                            <CardHeader className="pb-3">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <CardTitle className="text-base">
                                            {selectedDate.toLocaleDateString("en-US", {
                                                weekday: "long",
                                                month: "long",
                                                day: "numeric",
                                            })}
                                        </CardTitle>
                                        <CardDescription>
                                            {selectedDayInteractions.length + selectedDayEvents.length === 0
                                                ? "No events or interactions"
                                                : `${selectedDayInteractions.length + selectedDayEvents.length} item(s)`}
                                        </CardDescription>
                                    </div>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => {
                                            setReachOutState({
                                                preselectedIds: contacts.length > 0 ? [contacts[0].id] : [],
                                                defaultDate: selectedDate.toISOString(),
                                            });
                                        }}
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-1"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
                                        Add
                                    </Button>
                                </div>
                            </CardHeader>
                            <CardContent>
                                {selectedDayInteractions.length === 0 && selectedDayEvents.length === 0 ? (
                                    <p className="text-sm text-muted-foreground py-4 text-center">
                                        Nothing scheduled for this day
                                    </p>
                                ) : (
                                    <div className="space-y-3">
                                        {/* Calendar events (not already in interactions) */}
                                        {selectedDayEvents
                                            .filter(e => !selectedDayInteractions.some(i => i.calendarEventId === e.id))
                                            .map(event => (
                                                <div key={event.id} className="p-3 rounded-lg border bg-blue-50/50 dark:bg-blue-950/20">
                                                    <div className="flex items-start justify-between">
                                                        <div className="flex-1 min-w-0">
                                                            <p className="font-medium text-sm truncate">{event.summary}</p>
                                                            <p className="text-xs text-muted-foreground mt-0.5">
                                                                {new Date(event.start).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                                                                {event.end && ` – ${new Date(event.end).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`}
                                                            </p>
                                                            {event.location && (
                                                                <p className="text-xs text-muted-foreground mt-0.5">📍 {event.location}</p>
                                                            )}
                                                        </div>
                                                        <Badge variant="outline" className="text-[10px] shrink-0 ml-2">
                                                            Calendar
                                                        </Badge>
                                                    </div>
                                                    {event.attendees.length > 0 && (
                                                        <div className="mt-2 flex flex-wrap gap-1">
                                                            {event.attendees.slice(0, 3).map((a, i) => (
                                                                <span key={i} className="text-[10px] px-1.5 py-0.5 rounded-full bg-background border">
                                                                    {a.displayName || a.email}
                                                                </span>
                                                            ))}
                                                            {event.attendees.length > 3 && (
                                                                <span className="text-[10px] text-muted-foreground">
                                                                    +{event.attendees.length - 3}
                                                                </span>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            ))}

                                        {/* Interactions */}
                                        {selectedDayInteractions.map(interaction => (
                                            <div key={interaction.id} className="p-3 rounded-lg border bg-card">
                                                <div className="flex items-start justify-between">
                                                    <div className="flex-1 min-w-0">
                                                        <p className="font-medium text-sm truncate">
                                                            {interaction.isRecurring && "🔁 "}
                                                            {interaction.content || interaction.type}
                                                        </p>
                                                        <p className="text-xs text-muted-foreground mt-0.5">
                                                            {new Date(interaction.date).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                                                        </p>
                                                        {interaction.contacts && interaction.contacts.length > 0 && (
                                                            <div className="mt-1 flex flex-wrap gap-1">
                                                                {interaction.contacts.map(c => (
                                                                    <span key={c.id} className="text-[10px] px-1.5 py-0.5 rounded-full bg-secondary">
                                                                        {c.name}
                                                                    </span>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </div>
                                                    <div className="flex items-center gap-1 shrink-0 ml-2">
                                                        <button
                                                            type="button"
                                                            className="p-1 rounded hover:bg-accent transition-colors"
                                                            title="Edit interaction"
                                                            onClick={() => {
                                                                setEditingInteraction({
                                                                    id: interaction.id,
                                                                    type: interaction.type,
                                                                    platform: interaction.platform,
                                                                    content: interaction.content,
                                                                    date: interaction.date,
                                                                    durationMinutes: interaction.durationSeconds ? String(Math.round(interaction.durationSeconds / 60)) : undefined,
                                                                    messageCount: interaction.messageCount ? String(interaction.messageCount) : undefined,
                                                                    contactIds: interaction.contacts?.map(c => c.id),
                                                                });
                                                            }}
                                                        >
                                                            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
                                                        </button>
                                                        <Badge
                                                            variant="secondary"
                                                            className={`text-[10px] ${PLATFORM_COLORS[interaction.platform] || ""}`}
                                                        >
                                                            {interaction.platform}
                                                        </Badge>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </CardContent>
                        </Card>

                        {/* Upcoming */}
                        <Card>
                            <CardHeader className="pb-3">
                                <CardTitle className="text-base">Upcoming (7 days)</CardTitle>
                                <CardDescription>
                                    {upcomingInteractions.length === 0
                                        ? "No upcoming interactions"
                                        : `${upcomingInteractions.length} scheduled`}
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                {upcomingInteractions.length === 0 ? (
                                    <p className="text-sm text-muted-foreground py-2 text-center">All clear!</p>
                                ) : (
                                    <div className="space-y-2">
                                        {upcomingInteractions.slice(0, 8).map(interaction => (
                                            <button
                                                key={interaction.id}
                                                className="w-full text-left p-2.5 rounded-lg border hover:bg-accent/50 transition-colors"
                                                onClick={() => setSelectedDate(new Date(interaction.date))}
                                            >
                                                <div className="flex items-center justify-between">
                                                    <span className="text-sm font-medium truncate">
                                                        {interaction.isRecurring && "🔁 "}
                                                        {interaction.content || interaction.type}
                                                    </span>
                                                    <Badge variant="outline" className="text-[10px] shrink-0 ml-2">
                                                        {new Date(interaction.date).toLocaleDateString([], { month: "short", day: "numeric" })}
                                                    </Badge>
                                                </div>
                                                {interaction.contacts && interaction.contacts.length > 0 && (
                                                    <p className="text-xs text-muted-foreground mt-0.5 truncate">
                                                        with {interaction.contacts.map(c => c.name).join(", ")}
                                                    </p>
                                                )}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </CardContent>
                        </Card>

                        {/* Loading indicators */}
                        {(loadingInteractions || loadingEvents) && (
                            <div className="text-center text-sm text-muted-foreground animate-pulse py-2">
                                Loading data…
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Reach Out (Other tab) for new log from "Add" */}
            {contacts.length > 0 && (
                <ReachOutModal
                    allContacts={contacts}
                    initialContact={reachOutState && reachOutState.preselectedIds[0] ? (contacts.find(c => c.id === reachOutState.preselectedIds[0]) ?? null) : null}
                    open={!!reachOutState}
                    onOpenChange={(open) => {
                        if (!open) setReachOutState(null);
                    }}
                    onSuccess={() => {
                        fetchInteractions();
                        fetchCalendarEvents();
                        setReachOutState(null);
                    }}
                    initialPreselectedIds={reachOutState?.preselectedIds}
                    initialTab="other"
                    initialDefaultDate={reachOutState?.defaultDate}
                />
            )}
            {/* LogInteractionModal only for editing an existing interaction */}
            {contacts.length > 0 && (
                <LogInteractionModal
                    open={!!editingInteraction}
                    onOpenChange={(open) => {
                        if (!open) setEditingInteraction(undefined);
                    }}
                    contactId={contacts[0]?.id || ""}
                    defaultDate={editingInteraction?.date}
                    editInteraction={editingInteraction}
                    onDelete={() => fetchInteractions()}
                    onSuccess={() => {
                        fetchInteractions();
                        fetchCalendarEvents();
                        setEditingInteraction(undefined);
                    }}
                />
            )}
        </div>
    );
}
