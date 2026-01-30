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
import {
    NativeSelect,
    NativeSelectOption,
} from "@/components/ui/native-select"

// Match the Platform enum from Prisma
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

export type EditNodeData = {
    id: string;
    name: string;
    description?: string;
    group?: string;
    phone?: string;
    email?: string;
    commonPlatform?: string;
};

interface EditNodeDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    node: EditNodeData | null;
    groups: string[];
    onSave: (id: string, updates: Partial<EditNodeData>) => Promise<void>;
}

export function EditNodeDialog({
    open,
    onOpenChange,
    node,
    groups,
    onSave,
}: EditNodeDialogProps) {
    const [formData, setFormData] = useState<Partial<EditNodeData>>({});
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (node) {
            setFormData({
                name: node.name,
                description: node.description || "",
                group: node.group || "",
                phone: node.phone || "",
                email: node.email || "",
                commonPlatform: node.commonPlatform || "",
            });
        }
    }, [node]);

    const handleChange = (field: keyof EditNodeData, value: string) => {
        setFormData((prev) => ({ ...prev, [field]: value }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!node) return;

        setLoading(true);
        try {
            await onSave(node.id, formData);
            onOpenChange(false);
        } catch (error) {
            console.error("Failed to save node:", error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Edit Node</DialogTitle>
                    <DialogDescription>
                        Make changes to the node details here. Click save when you&apos;re done.
                    </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="grid gap-4 py-4">
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="name" className="text-right">
                            Name
                        </Label>
                        <Input
                            id="name"
                            value={formData.name || ""}
                            onChange={(e) => handleChange("name", e.target.value)}
                            className="col-span-3"
                            required
                        />
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="description" className="text-right">
                            Description
                        </Label>
                        <Input
                            id="description"
                            value={formData.description || ""}
                            onChange={(e) => handleChange("description", e.target.value)}
                            className="col-span-3"
                        />
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="group" className="text-right">
                            Group
                        </Label>
                        <div className="col-span-3 relative">
                            <Input
                                id="group"
                                list="group-suggestions-dialog"
                                value={formData.group || ""}
                                onChange={(e) => handleChange("group", e.target.value)}
                                placeholder="None"
                            />
                            <datalist id="group-suggestions-dialog">
                                {groups.map((g) => (
                                    <option key={g} value={g} />
                                ))}
                            </datalist>
                        </div>
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="phone" className="text-right">
                            Phone
                        </Label>
                        <Input
                            id="phone"
                            value={formData.phone || ""}
                            onChange={(e) => handleChange("phone", e.target.value)}
                            className="col-span-3"
                        />
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="email" className="text-right">
                            Email
                        </Label>
                        <Input
                            id="email"
                            type="email"
                            value={formData.email || ""}
                            onChange={(e) => handleChange("email", e.target.value)}
                            className="col-span-3"
                        />
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="commonPlatform" className="text-right">
                            Platform
                        </Label>
                        <NativeSelect
                            id="commonPlatform"
                            value={formData.commonPlatform || ""}
                            onChange={(e) => handleChange("commonPlatform", e.target.value)}
                            className="col-span-3"
                        >
                            <NativeSelectOption value="">None</NativeSelectOption>
                            {PLATFORMS.map(p => (
                                <NativeSelectOption key={p} value={p}>{p}</NativeSelectOption>
                            ))}
                        </NativeSelect>
                    </div>
                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                            Cancel
                        </Button>
                        <Button type="submit" disabled={loading}>
                            {loading ? "Saving..." : "Save changes"}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog >
    );
}
