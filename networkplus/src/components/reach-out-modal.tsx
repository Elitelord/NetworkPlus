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
import { Loader2, Sparkles, Send, Calendar, CheckSquare } from "lucide-react";

import { MultiSelect } from "@/components/ui/multi-select";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";

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
}

export function ReachOutModal({ allContacts, initialContact, open, onOpenChange, onSuccess }: ReachOutModalProps) {
  const [activeTab, setActiveTab] = useState<string>("email");
  const [selectedContactIds, setSelectedContactIds] = useState<string[]>([]);
  const [message, setMessage] = useState("");
  const [subject, setSubject] = useState("");
  const [meetingTime, setMeetingTime] = useState("");
  const [platform, setPlatform] = useState("OTHER");
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  React.useEffect(() => {
    if (open && initialContact) {
      setSelectedContactIds([initialContact.id]);
    } else if (!open) {
      setSelectedContactIds([]);
      setMessage("");
      setSubject("");
      setMeetingTime("");
      setPlatform("OTHER");
    }
  }, [open, initialContact]);

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
      console.warn("AI Generation failed, using fallback:", err);
      setError(`AI Error: ${err.message}. Using template instead.`);
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
        endpoint = "/api/interactions";
        payload = {
          contactIds: selectedContactIds,
          type: "Manual",
          platform: platform,
          content: message,
          date: new Date().toISOString(),
        };
      }

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(errText || "Failed to submit");
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
      <DialogContent className="sm:max-w-[525px] flex flex-col max-h-[90vh]">
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

        <div className="overflow-y-auto flex-1 space-y-4 px-1 pb-4">
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
              <TabsTrigger value="email" className="flex items-center gap-2">
                <Send className="w-4 h-4" /> Email
              </TabsTrigger>
              <TabsTrigger value="meeting" className="flex items-center gap-2">
                <Calendar className="w-4 h-4" /> Meeting
              </TabsTrigger>
              <TabsTrigger value="log" className="flex items-center gap-2">
                <CheckSquare className="w-4 h-4" /> Log Only
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

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>{activeTab === "log" ? "Interaction Notes" : "Message Body"}</Label>
                {activeTab !== "log" && (
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
                )}
              </div>
              <Textarea 
                placeholder={activeTab === "log" ? "What did you discuss?" : "Write your message here..."}
                className="min-h-[150px]"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
              />
            </div>

            {activeTab === "log" && (
              <div className="space-y-2 pt-2">
                <Label>Platform</Label>
                <NativeSelect value={platform} onChange={(e) => setPlatform(e.target.value)}>
                    <NativeSelectOption value="LINKEDIN">LinkedIn</NativeSelectOption>
                    <NativeSelectOption value="WHATSAPP">WhatsApp</NativeSelectOption>
                    <NativeSelectOption value="IMESSAGE">iMessage / SMS</NativeSelectOption>
                    <NativeSelectOption value="EMAIL">Email</NativeSelectOption>
                    <NativeSelectOption value="MEETING">Meeting</NativeSelectOption>
                    <NativeSelectOption value="CALL">Call</NativeSelectOption>
                    <NativeSelectOption value="SOCIAL_MEDIA">Social Media</NativeSelectOption>
                    <NativeSelectOption value="IN_PERSON">In Person</NativeSelectOption>
                    <NativeSelectOption value="OTHER">Other</NativeSelectOption>
                </NativeSelect>
              </div>
            )}
          </div>
        </Tabs>
        </div>

        <div className="flex justify-end gap-3 mt-2 flex-shrink-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={isSubmitting || selectedContactIds.length === 0 || (activeTab === "meeting" && !meetingTime)}>
            {isSubmitting ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : null}
            {activeTab === "email" ? "Send Email & Log" : activeTab === "meeting" ? "Schedule & Log" : "Save Log"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
