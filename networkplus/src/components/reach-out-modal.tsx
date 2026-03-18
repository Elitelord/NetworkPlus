"use client";

import * as React from "react";
import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Sparkles, Send, Calendar, FileText } from "lucide-react";

import { MultiSelect } from "@/components/ui/multi-select";
import { LogInteractionModal } from "@/components/log-interaction-modal";

export type Contact = {
  id: string;
  name: string;
  email?: string | null;
  description?: string;
  groups?: string[];
  lastInteractionAt?: string;
};

interface ReachOutModalProps {
  allContacts: Contact[];
  initialContact: Contact | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: (contactIds: string[]) => void;
  /** When opening from bulk edit "Log interaction", pre-fill these contacts and open to Other tab. */
  initialPreselectedIds?: string[];
  /** Tab to show when modal opens (e.g. "other" when opening from bulk edit log). */
  initialTab?: "email" | "meeting" | "other";
  /** Pre-fill date in the Other tab form (e.g. from calendar "Add" for selected day). */
  initialDefaultDate?: string;
}

export function ReachOutModal({ allContacts, initialContact, open, onOpenChange, onSuccess, initialPreselectedIds, initialTab, initialDefaultDate }: ReachOutModalProps) {
  const [activeTab, setActiveTab] = useState<string>("email");
  const [selectedContactIds, setSelectedContactIds] = useState<string[]>([]);
  const [message, setMessage] = useState("");
  const [subject, setSubject] = useState("");
  const [meetingTime, setMeetingTime] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  React.useEffect(() => {
    if (!open) {
      setSelectedContactIds([]);
      setMessage("");
      setSubject("");
      setMeetingTime("");
      return;
    }
    if (initialPreselectedIds && initialPreselectedIds.length > 0) {
      setSelectedContactIds(initialPreselectedIds);
      setActiveTab(initialTab ?? "other");
    } else if (initialContact) {
      setSelectedContactIds([initialContact.id]);
      setActiveTab(initialTab ?? "email");
    }
  }, [open, initialContact, initialPreselectedIds, initialTab]);

  const selectedContacts = allContacts.filter(c => selectedContactIds.includes(c.id));
  const contactNames = selectedContacts.map(c => c.name).join(", ");

  async function handleGenerateMessage() {
    if (selectedContactIds.length === 0) {
      setError("Please select at least one contact for AI generation.");
      return;
    }
    
    setIsGenerating(true);
    setError(null);

    const useFallback = () => {
      const firstContact = selectedContacts[0];
      if (activeTab === "email") {
        setSubject(`Catching up / ${firstContact?.name || "Hello"}`);
        setMessage(`Hi ${firstContact?.name || "there"},\n\nIt's been a while since we last spoke. I'd love to catch up and see how things are going with you!\n\nBest,\n[Your Name]`);
      } else {
        setMessage(`Hey ${firstContact?.name || "there"}, reaching out to see if you have time to catch up soon!`);
      }
    };

    try {
      const res = await fetch("/api/reach-out/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          contactId: selectedContactIds[0],
          platform: activeTab 
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        if (res.status === 429 || (data.error && data.error.includes("quota"))) {
          setError("OpenAI quota exceeded. Using a standard template instead.");
          useFallback();
          return;
        }
        throw new Error(data.error || "Failed to generate message");
      }

      const data = await res.json();
      setMessage(data.message);
      if (data.subject && activeTab === "email") {
        setSubject(data.subject);
      }
    } catch (err: any) {
      setError("We couldn't generate a message automatically. Using a standard template instead.");
      useFallback();
    } finally {
      setIsGenerating(false);
    }
  }

  async function handleSubmit() {
    if (selectedContactIds.length === 0) {
      setError("Please select at least one contact to reach out to.");
      return;
    }

    // Other tab has its own embedded form and doesn't use this submit
    if (activeTab === "other") return;

    setIsSubmitting(true);
    setError(null);

    try {
      let endpoint = "";
      let payload: any = {};

      if (activeTab === "email") {
        endpoint = "/api/sync/gmail/send";
        payload = {
          contactIds: selectedContactIds,
          subject,
          body: message,
        };
      } else if (activeTab === "meeting") {
        endpoint = "/api/calendar/events";
        const attendeeEmails = selectedContacts.map(c => c.email).filter(Boolean);
        payload = {
          title: `Meeting with ${contactNames}`,
          description: message,
          startTime: meetingTime,
          contactIds: selectedContactIds,
          attendeeEmails: attendeeEmails,
          createMeetLink: true
        };
      } else {
        // Unreachable: log tab handled at start of handleSubmit
        return;
      }

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        const message = data?.error || (res.status === 400 || res.status === 401
          ? "Please sign in with Google to use this feature."
          : "Something went wrong. Please try again.");
        throw new Error(message);
      }

      onSuccess(selectedContactIds);
      onOpenChange(false);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  }

  const allContactsOptions = React.useMemo(() => {
    return allContacts.map(c => c.id);
  }, [allContacts]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100vw-2rem)] max-w-[525px] flex flex-col max-h-[85dvh] sm:max-h-[90vh] overflow-hidden border border-border shadow-xl dark:border-border/30">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle>Reach Out to Contacts</DialogTitle>
          <DialogDescription>
            Log an interaction or send a message directly.
          </DialogDescription>
        </DialogHeader>

        {error && (
          <div className="bg-destructive/10 text-destructive text-sm p-3 rounded-md flex-shrink-0">
            {error}
          </div>
        )}

        <div className="overflow-y-auto flex-1 min-h-0 space-y-4 px-1 pb-4">
          <div className="space-y-2">
            <Label>Contacts</Label>
            <MultiSelect
              options={allContactsOptions}
              selected={selectedContactIds}
              onChange={setSelectedContactIds}
              placeholder="Search contacts..."
              renderOption={(opt: string) => allContacts.find(c => c.id === opt)?.name || opt}
              renderSelectedItem={(opt: string) => allContacts.find(c => c.id === opt)?.name || opt}
              creatable={false}
            />
          </div>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="email" className="flex items-center gap-1.5 text-xs sm:text-sm sm:gap-2">
                <Send className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" /> Email
              </TabsTrigger>
              <TabsTrigger value="meeting" className="flex items-center gap-1.5 text-xs sm:text-sm sm:gap-2">
                <Calendar className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" /> Meeting
              </TabsTrigger>
              <TabsTrigger value="other" className="flex items-center gap-1.5 text-xs sm:text-sm sm:gap-2">
                <FileText className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" /> Other
              </TabsTrigger>
            </TabsList>

          <div className="mt-4 space-y-4">
            {activeTab === "email" && (
              <div className="space-y-2">
                <Label>Subject</Label>
                <Input 
                  placeholder="Catching up" 
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                />
              </div>
            )}

            {activeTab === "meeting" && (
              <div className="space-y-2">
                <Label>Meeting Time</Label>
                <Input 
                  type="datetime-local" 
                  value={meetingTime}
                  onChange={(e) => setMeetingTime(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">A Google Meet link will be added automatically.</p>
              </div>
            )}

            {activeTab !== "other" && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Message Body</Label>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={handleGenerateMessage}
                  disabled={isGenerating || selectedContactIds.length === 0}
                  className="h-8 text-xs text-blue-500 hover:text-blue-600 focus:text-blue-600"
                >
                  {isGenerating ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Sparkles className="w-3 h-3 mr-1" />}
                  AI Suggestion
                </Button>
              </div>
              <Textarea 
                placeholder="Write your message here..."
                className="min-h-[150px]"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
              />
            </div>
            )}
            {activeTab === "other" && selectedContactIds.length > 0 && (
              <LogInteractionModal
                embedFormOnly
                hideContactSelector
                contactId={selectedContactIds[0]}
                initialContactIds={selectedContactIds}
                variant="simple"
                defaultDate={initialDefaultDate ?? new Date().toISOString()}
                onSuccess={(ids) => {
                  onSuccess(ids);
                  onOpenChange(false);
                }}
                onCancel={() => onOpenChange(false)}
              />
            )}
          </div>
        </Tabs>
        </div>

        {activeTab !== "other" && (
          <div className="flex justify-end gap-2 sm:gap-3 mt-2 flex-shrink-0">
            <Button variant="outline" size="sm" className="sm:size-default" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button size="sm" className="sm:size-default" onClick={handleSubmit} disabled={isSubmitting || selectedContactIds.length === 0 || (activeTab === "meeting" && !meetingTime)}>
              {isSubmitting ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : null}
              <span className="hidden sm:inline">{activeTab === "email" ? "Send Email & Log" : "Schedule & add to calendar"}</span>
              <span className="sm:hidden">{activeTab === "email" ? "Send & Log" : "Schedule"}</span>
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
