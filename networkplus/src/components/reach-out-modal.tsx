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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Sparkles, Calendar, FileText, MessageSquare, ChevronDown, CheckCircle2, ArrowLeft } from "lucide-react";

import { MultiSelect } from "@/components/ui/multi-select";
import { LogInteractionModal } from "@/components/log-interaction-modal";

type SendPlatform = "email" | "sms" | "whatsapp" | "call" | "instagram";

const SEND_PLATFORM_OPTIONS: { value: SendPlatform; label: string }[] = [
  { value: "email", label: "Email" },
  { value: "sms", label: "SMS / iMessage" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "call", label: "Phone Call" },
  { value: "instagram", label: "Instagram" },
];

function normalizePhone(phone: string): string {
  return phone.replace(/[\s\-\(\)\.]/g, "");
}

function buildSmsUri(phone: string, body: string): string {
  const normalized = normalizePhone(phone);
  const encoded = encodeURIComponent(body);
  return `sms:${normalized}?body=${encoded}`;
}

function buildWhatsAppUri(phone: string, body: string): string {
  const normalized = normalizePhone(phone).replace(/^\+/, "");
  const encoded = encodeURIComponent(body);
  return `https://wa.me/${normalized}?text=${encoded}`;
}

/** Instagram usernames: letters, numbers, periods, underscores (no @). */
const IG_USERNAME_RE = /^[A-Za-z0-9._]{1,30}$/;

/**
 * Normalize whatever the user saved: @handle, full profile URL, direct thread URL, or numeric thread id.
 */
function parseInstagramRef(raw: string): { kind: "thread"; id: string } | { kind: "username"; handle: string } | null {
  const s = raw.trim();
  if (!s) return null;

  // Plain numeric thread id
  if (/^\d+$/.test(s)) {
    return { kind: "thread", id: s };
  }

  // /direct/t/17846677488209806/ anywhere in the string
  const threadInPath = s.match(/\/direct\/t\/(\d+)/i);
  if (threadInPath) {
    return { kind: "thread", id: threadInPath[1] };
  }

  // ig.me/m/username
  const igMe = s.match(/ig\.me\/m\/([^/?#\s]+)/i);
  if (igMe) {
    const h = decodeURIComponent(igMe[1]).replace(/^@+/, "");
    if (IG_USERNAME_RE.test(h)) return { kind: "username", handle: h };
  }

  // https://www.instagram.com/username/ or instagram.com/username
  try {
    const url = s.startsWith("http") ? new URL(s) : new URL(`https://${s}`);
    if (url.hostname === "instagram.com" || url.hostname.endsWith(".instagram.com")) {
      const parts = url.pathname.split("/").filter(Boolean);
      if (parts[0] === "direct" && parts[1] === "t" && /^\d+$/.test(parts[2] ?? "")) {
        return { kind: "thread", id: parts[2]! };
      }
      const first = parts[0];
      if (
        first &&
        !["p", "reel", "reels", "tv", "stories", "explore", "accounts", "legal", "direct"].includes(first) &&
        IG_USERNAME_RE.test(first)
      ) {
        return { kind: "username", handle: first };
      }
    }
  } catch {
    /* not a URL */
  }

  const handle = s.replace(/^@+/, "").trim();
  if (IG_USERNAME_RE.test(handle)) {
    return { kind: "username", handle };
  }

  return null;
}

function buildInstagramOpenUrl(raw: string): string | null {
  const parsed = parseInstagramRef(raw);
  if (!parsed) return null;
  if (parsed.kind === "thread") {
    return `https://www.instagram.com/direct/t/${parsed.id}/`;
  }
  // ig.me expects the raw handle segment (encoding can break redirects for some clients).
  return `https://ig.me/m/${parsed.handle}`;
}

export type Contact = {
  id: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  instagram?: string | null;
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
  /** Tab to show when modal opens. "message" (or legacy "email") for the send tab. */
  initialTab?: "message" | "email" | "meeting" | "other";
  /** Pre-fill date in the Other tab form (e.g. from calendar "Add" for selected day). */
  initialDefaultDate?: string;
}

export function ReachOutModal({ allContacts, initialContact, open, onOpenChange, onSuccess, initialPreselectedIds, initialTab, initialDefaultDate }: ReachOutModalProps) {
  const resolvedInitialTab = initialTab === "email" ? "message" : initialTab;

  const [activeTab, setActiveTab] = useState<string>("message");
  const [sendPlatform, setSendPlatform] = useState<SendPlatform>("email");
  const [selectedContactIds, setSelectedContactIds] = useState<string[]>([]);
  const [message, setMessage] = useState("");
  const [subject, setSubject] = useState("");
  const [meetingTime, setMeetingTime] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [awaitingConfirmation, setAwaitingConfirmation] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sendPlatformOpen, setSendPlatformOpen] = useState(false);

  React.useEffect(() => {
    if (!open) {
      setSelectedContactIds([]);
      setMessage("");
      setSubject("");
      setMeetingTime("");
      setSendPlatform("email");
      setAwaitingConfirmation(false);
      return;
    }
    if (initialPreselectedIds && initialPreselectedIds.length > 0) {
      setSelectedContactIds(initialPreselectedIds);
      setActiveTab(resolvedInitialTab ?? "other");
    } else if (initialContact) {
      setSelectedContactIds([initialContact.id]);
      setActiveTab(resolvedInitialTab ?? "message");
    }
  }, [open, initialContact, initialPreselectedIds, resolvedInitialTab]);

  React.useEffect(() => {
    if (activeTab !== "message") {
      setSendPlatform("email");
      setAwaitingConfirmation(false);
    }
  }, [activeTab]);

  React.useEffect(() => {
    setAwaitingConfirmation(false);
  }, [sendPlatform]);

  React.useEffect(() => {
    if (!sendPlatformOpen) return;
    const handleClick = () => setSendPlatformOpen(false);
    document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, [sendPlatformOpen]);

  const selectedContacts = allContacts.filter(c => selectedContactIds.includes(c.id));
  const contactNames = selectedContacts.map(c => c.name).join(", ");
  const firstContactPhone = selectedContacts[0]?.phone;
  const firstContactInstagram = selectedContacts[0]?.instagram;
  const isDeepLink = sendPlatform === "sms" || sendPlatform === "whatsapp" || sendPlatform === "call" || sendPlatform === "instagram";

  async function handleGenerateMessage() {
    if (selectedContactIds.length === 0) {
      setError("Please select at least one contact for AI generation.");
      return;
    }
    
    setIsGenerating(true);
    setError(null);

    const useFallback = () => {
      const firstContact = selectedContacts[0];
      if (sendPlatform === "email") {
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
          platform: sendPlatform === "email" ? "email" : sendPlatform,
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
      if (data.subject && sendPlatform === "email") {
        setSubject(data.subject);
      }
    } catch (err: any) {
      setError("We couldn't generate a message automatically. Using a standard template instead.");
      useFallback();
    } finally {
      setIsGenerating(false);
    }
  }

  function handleDeepLinkOpen() {
    if (selectedContactIds.length === 0) return;

    if (sendPlatform === "call") {
      if (!firstContactPhone) return;
      window.open(`tel:${normalizePhone(firstContactPhone)}`, "_self");
      setAwaitingConfirmation(true);
      return;
    }

    if (sendPlatform === "instagram") {
      if (!firstContactInstagram) return;
      const openUrl = buildInstagramOpenUrl(firstContactInstagram);
      if (!openUrl) return;
      navigator.clipboard.writeText(message).catch(() => {});
      window.open(openUrl, "_blank", "noopener,noreferrer");
      setAwaitingConfirmation(true);
      return;
    }

    if (!firstContactPhone) return;
    const uri = sendPlatform === "sms"
      ? buildSmsUri(firstContactPhone, message)
      : buildWhatsAppUri(firstContactPhone, message);

    window.open(uri, "_blank");
    setAwaitingConfirmation(true);
  }

  async function handleConfirmLog() {
    setIsSubmitting(true);
    setError(null);
    try {
      const platformMap: Record<string, { platform: string; type: string }> = {
        sms: { platform: "SMS", type: "Message Sent" },
        whatsapp: { platform: "WHATSAPP", type: "Message Sent" },
        call: { platform: "CALL", type: "Call Made" },
        instagram: { platform: "INSTAGRAM", type: "Message Sent" },
      };
      const { platform: logPlatform, type: logType } = platformMap[sendPlatform] ?? { platform: "OTHER", type: "Message Sent" };

      const res = await fetch("/api/interactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contactIds: selectedContactIds,
          type: logType,
          content: sendPlatform === "call" ? null : (message || null),
          platform: logPlatform,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || "Failed to log interaction.");
      }

      onSuccess(selectedContactIds);
      onOpenChange(false);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleSubmit() {
    if (selectedContactIds.length === 0) {
      setError("Please select at least one contact to reach out to.");
      return;
    }

    if (activeTab === "other") return;

    if (activeTab === "message" && isDeepLink) {
      handleDeepLinkOpen();
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      let endpoint = "";
      let payload: any = {};

      if (activeTab === "message" && sendPlatform === "email") {
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

  const messageFooterLabel: Record<SendPlatform, string> = {
    email: "Send Email & Log",
    sms: "Open in Messages",
    whatsapp: "Open in WhatsApp",
    call: "Start Call",
    instagram: "Copy & Open Instagram",
  };

  const messageFooterLabelShort: Record<SendPlatform, string> = {
    email: "Send & Log",
    sms: "Open in Messages",
    whatsapp: "Open in WhatsApp",
    call: "Start Call",
    instagram: "Copy & Open",
  };

  const needsPhone = sendPlatform === "sms" || sendPlatform === "whatsapp" || sendPlatform === "call";
  const needsInstagram = sendPlatform === "instagram";
  const instagramParsed = firstContactInstagram ? parseInstagramRef(firstContactInstagram) : null;
  const deepLinkDisabled =
    (needsPhone && !firstContactPhone) ||
    (needsInstagram && !instagramParsed);

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
              <TabsTrigger value="message" className="flex items-center gap-1.5 text-xs sm:text-sm sm:gap-2">
                <MessageSquare className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" /> Message
              </TabsTrigger>
              <TabsTrigger value="meeting" className="flex items-center gap-1.5 text-xs sm:text-sm sm:gap-2">
                <Calendar className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" /> Meeting
              </TabsTrigger>
              <TabsTrigger value="other" className="flex items-center gap-1.5 text-xs sm:text-sm sm:gap-2">
                <FileText className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" /> Other
              </TabsTrigger>
            </TabsList>

          <div className="mt-4 space-y-4">
            {activeTab === "message" && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="send-platform">Send via</Label>
                  <div className="relative">
                    <button
                      id="send-platform"
                      type="button"
                      onClick={(e) => { e.stopPropagation(); setSendPlatformOpen(v => !v); }}
                      className="flex h-9 w-full items-center justify-between rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                    >
                      <span>{SEND_PLATFORM_OPTIONS.find(o => o.value === sendPlatform)?.label}</span>
                      <ChevronDown className="h-4 w-4 opacity-50" />
                    </button>
                    {sendPlatformOpen && (
                      <div className="absolute z-50 mt-1 w-full rounded-md border bg-popover p-1 shadow-md">
                        {SEND_PLATFORM_OPTIONS.map(opt => (
                          <button
                            key={opt.value}
                            type="button"
                            onClick={(e) => { e.stopPropagation(); setSendPlatform(opt.value); setSendPlatformOpen(false); }}
                            className={`relative flex w-full cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent hover:text-accent-foreground ${sendPlatform === opt.value ? "bg-accent/50 font-medium" : ""}`}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {sendPlatform === "email" && (
                  <div className="space-y-2">
                    <Label>Subject</Label>
                    <Input 
                      placeholder="Catching up" 
                      value={subject}
                      onChange={(e) => setSubject(e.target.value)}
                    />
                  </div>
                )}

                {deepLinkDisabled && selectedContactIds.length > 0 && (
                  <p className="text-xs text-amber-600 dark:text-amber-400">
                    {needsInstagram
                      ? !firstContactInstagram?.trim()
                        ? `No Instagram username on file for ${selectedContacts[0]?.name || "this contact"}.`
                        : `Could not open Instagram for ${selectedContacts[0]?.name || "this contact"}. Edit the contact and use @username, a profile URL, or a DM thread link (…/direct/t/…/…).`
                      : `No phone number on file for ${selectedContacts[0]?.name || "this contact"}.`}
                  </p>
                )}
              </>
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

            {activeTab !== "other" && !(activeTab === "message" && sendPlatform === "call") && (
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

        {activeTab !== "other" && !awaitingConfirmation && (
          <div className="flex justify-end gap-2 sm:gap-3 mt-2 flex-shrink-0">
            <Button variant="outline" size="sm" className="sm:size-default" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button
              size="sm"
              className="sm:size-default"
              onClick={handleSubmit}
              disabled={
                isSubmitting
                || selectedContactIds.length === 0
                || (activeTab === "meeting" && !meetingTime)
                || (activeTab === "message" && deepLinkDisabled)
              }
            >
              {isSubmitting ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : null}
              {activeTab === "message" && (
                <>
                  <span className="hidden sm:inline">{messageFooterLabel[sendPlatform]}</span>
                  <span className="sm:hidden">{messageFooterLabelShort[sendPlatform]}</span>
                </>
              )}
              {activeTab === "meeting" && (
                <>
                  <span className="hidden sm:inline">Schedule & add to calendar</span>
                  <span className="sm:hidden">Schedule</span>
                </>
              )}
            </Button>
          </div>
        )}

        {awaitingConfirmation && (
          <div className="flex flex-col gap-3 mt-2 flex-shrink-0 border-t pt-3">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
              <span>
                {sendPlatform === "call"
                  ? "Your dialer should have opened. Did you make the call?"
                  : sendPlatform === "instagram"
                  ? "Message copied to clipboard. Did you send it on Instagram?"
                  : `${sendPlatform === "sms" ? "Messages" : "WhatsApp"} should have opened. Did you send it?`}
              </span>
            </div>
            <div className="flex justify-end gap-2 sm:gap-3">
              <Button
                variant="outline"
                size="sm"
                className="sm:size-default"
                onClick={() => setAwaitingConfirmation(false)}
              >
                <ArrowLeft className="w-3.5 h-3.5 mr-1.5" />
                No, Go Back
              </Button>
              <Button
                size="sm"
                className="sm:size-default"
                onClick={handleConfirmLog}
                disabled={isSubmitting}
              >
                {isSubmitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                Yes, Log It
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
