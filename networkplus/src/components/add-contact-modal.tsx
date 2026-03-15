"use client";

import { useState, type FormEvent } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { MultiSelect } from "@/components/ui/multi-select";
import { Plus } from "lucide-react";

interface AddContactModalProps {
  groups: string[];
  onSuccess: () => void;
}

export function AddContactModal({ groups, onSuccess }: AddContactModalProps) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [selectedGroups, setSelectedGroups] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const isNodeNameEmpty = title.trim() === "";

  async function createNode(e: FormEvent) {
    e.preventDefault();
    if (isNodeNameEmpty) return;

    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/contacts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: title, description, groups: selectedGroups }),
      });
      if (!res.ok) {
        const txt = await res.text();
        setError(`Create contact failed: ${res.status}`);
        return;
      }
      
      // Reset form
      setTitle("");
      setDescription("");
      setSelectedGroups([]);
      
      setOpen(false);
      onSuccess();
    } catch (err: any) {
      console.error(err);
      setError(String(err?.message ?? err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="w-full justify-start gap-2" id="tour-add-contact">
          <Plus className="size-4" />
          Add Contact
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px] bg-background/70 backdrop-blur-xl border-border/30">
        <DialogHeader>
          <DialogTitle>Add Contact</DialogTitle>
        </DialogHeader>
        <form onSubmit={createNode} className="flex flex-col gap-4 py-4">
          {error && (
            <div className="bg-destructive/10 text-destructive text-sm p-3 rounded-md">
              {error}
            </div>
          )}
          
          <div className="flex flex-col gap-3">
            <input 
              value={title} 
              onChange={(e) => setTitle(e.target.value)} 
              placeholder="Name" 
              className="w-full p-2 border rounded-md text-sm bg-background" 
              required
            />
            <input 
              value={description} 
              onChange={(e) => setDescription(e.target.value)} 
              placeholder="Description (optional)" 
              className="w-full p-2 border rounded-md text-sm bg-background" 
            />

            <div className="relative">
              <MultiSelect
                options={groups}
                selected={selectedGroups}
                onChange={setSelectedGroups}
                placeholder="Select groups..."
              />
            </div>
          </div>

          <Button type="submit" className="w-full mt-2" disabled={isNodeNameEmpty || loading}>
            {loading ? "Creating..." : "Create Contact"}
          </Button>
          {isNodeNameEmpty && title !== "" && (
            <p className="text-xs text-destructive">Name is required.</p>
          )}
        </form>
      </DialogContent>
    </Dialog>
  );
}
