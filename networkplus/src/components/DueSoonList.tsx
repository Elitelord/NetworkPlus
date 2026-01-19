"use client";

import { useEffect, useState } from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

type Contact = {
    id: string;
    name: string;
    lastInteractionAt?: string;
    interactions?: { date: string }[];
};

export function DueSoonList({ className }: { className?: string }) {
    const [contacts, setContacts] = useState<Contact[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        async function fetchDueSoon() {
            try {
                const res = await fetch("/api/contacts/due-soon?days=30");
                if (!res.ok) {
                    throw new Error(`Failed to fetch: ${res.status}`);
                }
                const data = await res.json();
                setContacts(data);
            } catch (err: any) {
                setError(err.message);
            } finally {
                setLoading(false);
            }
        }

        fetchDueSoon();
    }, []);

    if (loading) {
        return <div className="text-sm text-muted-foreground animate-pulse">Checking for due contacts...</div>;
    }

    if (error) {
        return <div className="text-sm text-red-500">Error: {error}</div>;
    }

    if (contacts.length === 0) {
        return (
            <Card className={className}>
                <CardHeader>
                    <CardTitle>Due Soon</CardTitle>
                    <CardDescription>Contacts you haven't reached out to in a while.</CardDescription>
                </CardHeader>
                <CardContent>
                    <p className="text-sm text-muted-foreground">All caught up! No contacts pending.</p>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card className={className}>
            <CardHeader>
                <CardTitle>Due Soon</CardTitle>
                <CardDescription>Re-connect with these contacts.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4">
                {contacts.map((contact) => (
                    <div key={contact.id} className="flex items-center justify-between p-2 border rounded-lg bg-background/50">
                        <div>
                            <p className="font-medium text-sm">{contact.name}</p>
                            <p className="text-xs text-muted-foreground">
                                Last: {contact.lastInteractionAt ? new Date(contact.lastInteractionAt).toLocaleDateString() : 'Never'}
                            </p>
                        </div>
                        <Badge variant="secondary" className="text-xs">
                            Due
                        </Badge>
                    </div>
                ))}
            </CardContent>
        </Card>
    );
}
