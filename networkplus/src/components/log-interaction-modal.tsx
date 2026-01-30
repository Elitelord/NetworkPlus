"use client";

import { useState } from "react";
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

const PLATFORMS = [
    "SMS",
    "CALL",
    "EMAIL",
    "INSTAGRAM",
    "DISCORD",
    "WHATSAPP",
    "FACEBOOK",
    "LINKEDIN",
    "SNAPCHAT",
    "TELEGRAM",
    "IN_PERSON",
    "OTHER",
];

interface LogInteractionModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    contactId: string;
    onSuccess: () => void;
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

    const handleChange = (field: string, value: string) => {
        setFormData((prev) => ({ ...prev, [field]: value }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            const res = await fetch("/api/interactions", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    contactId,
                    type: formData.type,
                    platform: formData.platform,
                    content: formData.content,
                    date: new Date(formData.date).toISOString(),
                }),
            });

            if (!res.ok) {
                throw new Error("Failed to log interaction");
            }

            onSuccess();
            onOpenChange(false);
            // Reset form slightly but keep some defaults if needed? 
            // Better to reset date to now
            setFormData(prev => ({ ...prev, date: new Date().toISOString().slice(0, 16), content: "" }));
        } catch (err) {
            console.error(err);
            // Determine how to show error. For now, log it.
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Log Interaction</DialogTitle>
                    <DialogDescription>
                        Record a new interaction with this contact.
                    </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="grid gap-4 py-4">
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="date" className="text-right">
                            Date
                        </Label>
                        <Input
                            id="date"
                            type="datetime-local"
                            value={formData.date}
                            onChange={(e) => handleChange("date", e.target.value)}
                            className="col-span-3"
                            required
                        />
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
                                <NativeSelectOption key={p} value={p}>
                                    {p}
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
