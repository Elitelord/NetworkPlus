"use client";

import { useState, useMemo, type FormEvent } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { LinkIcon } from "lucide-react";

interface AddLinkModalProps {
  nodes: { id: string; name: string }[];
  links: { fromId: string; toId: string; label?: string | null }[];
  onSuccess: () => void;
}

export function AddLinkModal({ nodes, links, onSuccess }: AddLinkModalProps) {
  const [open, setOpen] = useState(false);
  const [fromId, setFromId] = useState("");
  const [toId, setToId] = useState("");
  const [linkLabel, setLinkLabel] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const isSelfLink = fromId !== "" && toId !== "" && fromId === toId;
  const isDuplicateLink = useMemo(() => {
    if (fromId === "" || toId === "") return false;
    const normLabel = linkLabel?.trim() ?? "";
    return links.some((l) => {
      const [lFrom, lTo] = l.fromId < l.toId ? [l.fromId, l.toId] : [l.toId, l.fromId];
      const [f, t] = fromId < toId ? [fromId, toId] : [toId, fromId];
      if (lFrom !== f || lTo !== t) return false;
      const existingLabel = (l.label ?? "").trim();
      return existingLabel === normLabel;
    });
  }, [fromId, toId, linkLabel, links]);

  const isLinkInvalid = fromId === "" || toId === "" || isSelfLink || isDuplicateLink;

  async function createLink(e: FormEvent) {
    e.preventDefault();
    if (isLinkInvalid) return;

    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/links", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fromId, toId, label: linkLabel }),
      });
      if (!res.ok) {
        const txt = await res.text();
        setError(`Create link failed: ${res.status}`);
        return;
      }
      
      // Reset form
      setFromId("");
      setToId("");
      setLinkLabel("");
      
      setOpen(false);
      onSuccess();
    } catch (err: any) {
      console.error(err);
      setError(String(err?.message ?? err));
    } finally {
      setLoading(false);
    }
  }

  // Handle dialog close/open to reset state if needed
  const handleOpenChange = (newOpen: boolean) => {
    setOpen(newOpen);
    if (!newOpen) {
      // Optional: don't reset form unless successful
      setError(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" className="w-full justify-start gap-2">
          <LinkIcon className="size-4" />
          Add Link
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Add Link</DialogTitle>
        </DialogHeader>
        <form onSubmit={createLink} className="flex flex-col gap-4 py-4">
          {error && (
            <div className="bg-destructive/10 text-destructive text-sm p-3 rounded-md">
              {error}
            </div>
          )}
          
          <div className="flex flex-col gap-3">
            <select 
              value={fromId} 
              onChange={(e) => setFromId(e.target.value)} 
              className="w-full p-2 border rounded-md text-sm bg-background"
              required
            >
              <option value="">Select source</option>
              {nodes.map((n) => (
                <option key={n.id} value={n.id}>{n.name}</option>
              ))}
            </select>

            <select 
              value={toId} 
              onChange={(e) => setToId(e.target.value)} 
              className="w-full p-2 border rounded-md text-sm bg-background"
              required
            >
              <option value="">Select target</option>
              {nodes.map((n) => (
                <option key={n.id} value={n.id}>{n.name}</option>
              ))}
            </select>

            <input 
              value={linkLabel} 
              onChange={(e) => setLinkLabel(e.target.value)} 
              placeholder="Label (optional)" 
              className="w-full p-2 border rounded-md text-sm bg-background" 
            />
          </div>

          <Button type="submit" className="w-full mt-2" disabled={isLinkInvalid || loading}>
            {loading ? "Creating..." : "Create Link"}
          </Button>
          {isSelfLink && <p className="text-xs text-destructive">Cannot link a contact to itself.</p>}
          {isDuplicateLink && <p className="text-xs text-destructive">Link already exists.</p>}
        </form>
      </DialogContent>
    </Dialog>
  );
}
