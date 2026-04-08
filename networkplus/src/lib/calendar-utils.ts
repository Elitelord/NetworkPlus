import { Platform } from "@prisma/client";

/**
 * Infers the best Platform enum value from a Google Calendar event's
 * summary, description, and location fields.
 * Falls back to OTHER if no keywords match.
 */
export function inferPlatformFromEvent(
    summary?: string | null,
    description?: string | null,
    location?: string | null
): Platform {
    const text = [summary, description, location]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

    // Video/voice call platforms
    if (/\b(zoom|teams|google meet|meet\.google|webex|skype|facetime|call|phone|ring|dial)\b/.test(text)) {
        return Platform.CALL;
    }

    // In-person indicators
    if (/\b(lunch|coffee|dinner|breakfast|office|in[- ]person|on[- ]?site|meetup|visit|gym|park|restaurant|bar|cafe)\b/.test(text)) {
        return Platform.IN_PERSON;
    }

    // Messaging platforms
    if (/\b(discord)\b/.test(text)) return Platform.DISCORD;
    if (/\b(whatsapp)\b/.test(text)) return Platform.WHATSAPP;
    if (/\b(telegram)\b/.test(text)) return Platform.TELEGRAM;
    if (/\b(linkedin)\b/.test(text)) return Platform.LINKEDIN;
    if (/\b(instagram|ig\b)/.test(text)) return Platform.INSTAGRAM;
    if (/\b(facebook|fb\b|messenger)\b/.test(text)) return Platform.FACEBOOK;
    if (/\b(snapchat|snap)\b/.test(text)) return Platform.SNAPCHAT;
    if (/\b(email|mail|gmail|outlook)\b/.test(text)) return Platform.EMAIL;
    if (/\b(text|sms|imessage)\b/.test(text)) return Platform.SMS;

    return Platform.OTHER;
}

/**
 * Extracts a valid Google access token for the given account,
 * refreshing if expired. Shared between Gmail and Calendar sync.
 */
export async function getValidGoogleAccessToken(account: any, prisma: any): Promise<string | null> {
    if (!account.access_token) return null;

    const expiresAt = account.expires_at ? account.expires_at * 1000 : 0;

    if (Date.now() < expiresAt) {
        return account.access_token;
    }

    if (!account.refresh_token) {
        return null;
    }

    const response = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
            client_id: process.env.AUTH_GOOGLE_ID!,
            client_secret: process.env.AUTH_GOOGLE_SECRET!,
            grant_type: "refresh_token",
            refresh_token: account.refresh_token,
        }),
    });

    const tokens = await response.json();

    if (!response.ok) {
        console.error("Failed to refresh Google token", tokens);
        return null;
    }

    const newExpiresAt = Math.floor(Date.now() / 1000) + tokens.expires_in;

    await prisma.account.update({
        where: { id: account.id },
        data: {
            access_token: tokens.access_token,
            expires_at: newExpiresAt,
            refresh_token: tokens.refresh_token ?? account.refresh_token,
        },
    });

    return tokens.access_token;
}

/** Minimal shape Google Calendar accepts in attendees[].email (rejects names, placeholders, etc.). */
const ATTENDEE_EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function filterValidAttendeeEmails(emails: unknown): string[] {
    if (!Array.isArray(emails)) return [];
    const seen = new Set<string>();
    const out: string[] = [];
    for (const e of emails) {
        if (typeof e !== "string") continue;
        const trimmed = e.trim();
        if (!trimmed || !ATTENDEE_EMAIL_RE.test(trimmed)) continue;
        const key = trimmed.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        out.push(trimmed);
    }
    return out;
}
