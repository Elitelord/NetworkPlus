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
  const [city, setCity] = useState("");
  const [currentCompany, setCurrentCompany] = useState("");
  const [currentSchool, setCurrentSchool] = useState("");
  const [showProfileFields, setShowProfileFields] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const isNodeNameEmpty = title.trim() === "";

  async function createNode(e: FormEvent) {
    e.preventDefault();
    if (isNodeNameEmpty) return;

    setError(null);
    setLoading(true);

    try {
      const profile: Record<string, string> = {};
      if (city.trim()) profile.city = city.trim();
      if (currentCompany.trim()) profile.currentCompany = currentCompany.trim();
      if (currentSchool.trim()) profile.currentSchool = currentSchool.trim();

      const res = await fetch("/api/contacts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: title,
          description,
          groups: selectedGroups,
          ...(Object.keys(profile).length > 0 ? { profile } : {}),
        }),
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
      setCity("");
      setCurrentCompany("");
      setCurrentSchool("");
      setShowProfileFields(false);

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
      <DialogContent className="sm:max-w-[425px] border border-border dark:border-border/30">
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

            <button
              type="button"
              className="text-xs text-muted-foreground underline text-left"
              onClick={() => setShowProfileFields((v) => !v)}
            >
              {showProfileFields ? "Hide" : "Add"} city / company / school
            </button>
            {showProfileFields && (
              <div className="flex flex-col gap-2 border rounded-md p-3 bg-muted/30">
                <input
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="City (optional)"
                  className="w-full p-2 border rounded-md text-sm bg-background"
                />
                <input
                  value={currentCompany}
                  onChange={(e) => setCurrentCompany(e.target.value)}
                  placeholder="Current company (optional)"
                  className="w-full p-2 border rounded-md text-sm bg-background"
                />
                <input
                  value={currentSchool}
                  onChange={(e) => setCurrentSchool(e.target.value)}
                  placeholder="Current school (optional)"
                  className="w-full p-2 border rounded-md text-sm bg-background"
                />
              </div>
            )}
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
