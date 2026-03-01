"use client";

import { useState } from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export type Contact = {
    id: string;
    name: string;
    lastInteractionAt?: string;
    interactions?: { date: string }[];
};

interface DueSoonListProps {
    className?: string;
    onSelect?: (contact: Contact) => void;
    contacts: Contact[];
    isLoading?: boolean;
}

export function DueSoonList({ className, onSelect, contacts, isLoading = false }: DueSoonListProps) {
    const [isExpanded, setIsExpanded] = useState(true);

    if (isLoading) {
        return <div className="text-sm text-muted-foreground animate-pulse">Checking contacts...</div>;
    }

    if (contacts.length === 0) {
        return (
            <Card className={className}>
                <CardHeader
                    className="cursor-pointer select-none"
                    onClick={() => setIsExpanded(!isExpanded)}
                >
                    <div className="flex items-center justify-between">
                        <div>
                            <CardTitle>Catch Up</CardTitle>
                            <CardDescription>Consider catching up with these contacts.</CardDescription>
                        </div>
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width="16"
                            height="16"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            className={`text-muted-foreground transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
                        >
                            <polyline points="6 9 12 15 18 9" />
                        </svg>
                    </div>
                </CardHeader>
                {isExpanded && (
                    <CardContent>
                        <p className="text-sm text-muted-foreground">All caught up! No contacts pending.</p>
                    </CardContent>
                )}
            </Card>
        );
    }

    return (
        <Card className={className}>
            <CardHeader
                className="cursor-pointer select-none"
                onClick={() => setIsExpanded(!isExpanded)}
            >
                <div className="flex items-center justify-between">
                    <div>
                        <CardTitle>Catch Up</CardTitle>
                        <CardDescription>Consider catching up with these contacts.</CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs">
                            {contacts.length}
                        </Badge>
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width="16"
                            height="16"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            className={`text-muted-foreground transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
                        >
                            <polyline points="6 9 12 15 18 9" />
                        </svg>
                    </div>
                </div>
            </CardHeader>
            {isExpanded && (
                <CardContent className="grid gap-4">
                    {contacts.map((contact) => (
                        <div
                            key={contact.id}
                            className={`flex items-center justify-between p-2 border rounded-lg bg-background/50 ${onSelect ? 'cursor-pointer hover:bg-accent transition-colors' : ''}`}
                            onClick={() => onSelect?.(contact)}
                        >
                            <div>
                                <p className="font-medium text-sm">{contact.name}</p>
                                <p className="text-xs text-muted-foreground">
                                    Last: {contact.lastInteractionAt ? new Date(contact.lastInteractionAt).toLocaleDateString() : 'Never'}
                                </p>
                            </div>
                            <Badge variant="secondary" className="text-xs">
                                Catch Up
                            </Badge>
                        </div>
                    ))}
                </CardContent>
            )}
        </Card>
    );
}
