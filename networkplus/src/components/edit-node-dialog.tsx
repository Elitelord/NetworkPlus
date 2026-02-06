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

import { MultiSelect } from "@/components/ui/multi-select";

// Match the Platform enum from Prisma
// Match the Platform enum from Prisma but provide nice labels
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

export type EditContactData = {
    id: string;
    name: string;
    description?: string;
    groups?: string[];
    phone?: string;
    email?: string;
    commonPlatform?: string;
    manualStrengthBias?: number;
    strengthScore?: number;
};

interface EditNodeDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    node: EditContactData | null;
    groups: string[];
    onSave: (id: string, updates: Partial<EditContactData>) => Promise<void>;
}

export function EditNodeDialog({
    open,
    onOpenChange,
    node,
    groups,
    onSave,
}: EditNodeDialogProps) {
    const [formData, setFormData] = useState<Partial<EditContactData>>({});
    const [biasInput, setBiasInput] = useState("0");
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (node) {
            setFormData({
                name: node.name,
                description: node.description || "",
                groups: node.groups || [],
                phone: node.phone || "",
                email: node.email || "",
                commonPlatform: node.commonPlatform || "",
                manualStrengthBias: node.manualStrengthBias || 0,
            });
            setBiasInput((node.manualStrengthBias ?? 0).toString());
        }
    }, [node]);

    const handleChange = (field: keyof EditContactData, value: any) => {
        setFormData((prev) => ({ ...prev, [field]: value }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!node) return;

        setLoading(true);
        try {
            const finalBias = parseFloat(biasInput);
            await onSave(node.id, {
                ...formData,
                manualStrengthBias: isNaN(finalBias) ? 0 : finalBias
            });
            onOpenChange(false);
        } catch (error) {
            console.error("Failed to save contact:", error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Edit Contact</DialogTitle>
                    <DialogDescription>
                        Make changes to the contact details here. Click save when you&apos;re done.
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
                        <Label htmlFor="groups" className="text-right">
                            Groups
                        </Label>
                        <div className="col-span-3">
                            <MultiSelect
                                options={groups}
                                selected={formData.groups || []}
                                onChange={(newGroups) => handleChange("groups", newGroups)}
                                placeholder="Select groups..."
                            />
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
                                <NativeSelectOption key={p.value} value={p.value}>{p.label}</NativeSelectOption>
                            ))}
                        </NativeSelect>
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="manualStrengthBias" className="text-right">
                            Bias
                        </Label>
                        <div className="col-span-3">
                            <Input
                                id="manualStrengthBias"
                                type="number"
                                min={-20}
                                max={20}
                                value={biasInput}
                                onChange={(e) => setBiasInput(e.target.value)}
                            />
                            <p className="text-[10px] text-muted-foreground mt-1">
                                Adjust score manually (-20 to +20). Current Score: {(node?.strengthScore || 0).toFixed(1)}
                            </p>
                        </div>
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
