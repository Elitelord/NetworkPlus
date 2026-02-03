
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
import { useState, useEffect } from "react";

interface EditLinkDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    link: { id: string; label?: string; fromName?: string; toName?: string } | null;
    onUpdate: (id: string, label: string) => Promise<void>;
    onDelete: (id: string) => Promise<void>;
}

export function EditLinkDialog({
    open,
    onOpenChange,
    link,
    onUpdate,
    onDelete,
}: EditLinkDialogProps) {
    const [label, setLabel] = useState("");

    useEffect(() => {
        if (link) {
            setLabel(link.label || "");
        }
    }, [link]);

    const handleUpdate = async () => {
        if (!link) return;
        await onUpdate(link.id, label);
        onOpenChange(false);
    };

    const handleDelete = async () => {
        if (!link) return;
        if (confirm("Are you sure you want to delete this link?")) {
            await onDelete(link.id);
            onOpenChange(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Edit Link</DialogTitle>
                    <DialogDescription>
                        {link ? `Relationship between ${link.fromName} and ${link.toName}` : "Edit relationship"}
                    </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="link-label" className="text-right">
                            Label
                        </Label>
                        <Input
                            id="link-label"
                            value={label}
                            onChange={(e) => setLabel(e.target.value)}
                            className="col-span-3"
                        />
                    </div>
                </div>
                <DialogFooter className="flex justify-between sm:justify-between">
                    <Button variant="destructive" onClick={handleDelete}>
                        Delete
                    </Button>
                    <Button type="submit" onClick={handleUpdate}>
                        Save changes
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
