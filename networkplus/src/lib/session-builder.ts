import { Platform } from "@prisma/client";

export type Direction = "INBOUND" | "OUTBOUND" | "MIXED";

export interface RawMessage {
    id: string; // Unique message ID
    threadId?: string; // Optional thread/conversation ID for emails
    platform: Platform;
    date: Date;
    contactId: string; // Grouping ID for individuals
    direction: "INBOUND" | "OUTBOUND";
    content?: string; // Optional snippet or content
}

export interface SessionInteraction {
    startTime: Date;
    endTime: Date;
    durationSeconds: number;
    messageCount: number;
    platform: Platform;
    contactId: string;
    directionSummary: Direction;
    rawMessageCount: number;
    threadId?: string;
    metadata?: any;
}

/**
 * Summarizes an array of directions into a single session direction.
 */
function getDirectionSummary(directions: ("INBOUND" | "OUTBOUND")[]): Direction {
    const hasInbound = directions.includes("INBOUND");
    const hasOutbound = directions.includes("OUTBOUND");

    if (hasInbound && hasOutbound) return "MIXED";
    if (hasInbound) return "INBOUND";
    if (hasOutbound) return "OUTBOUND";
    return "MIXED"; // Default fallback
}

/**
 * Groups raw messages into parsed sessions.
 */
export function buildSessions(messages: RawMessage[]): SessionInteraction[] {
    if (!messages || messages.length === 0) return [];

    // Sort messages earliest first to build chronological sessions
    const sortedMessages = [...messages].sort((a, b) => a.date.getTime() - b.date.getTime());

    const sessions: SessionInteraction[] = [];

    // 1. Group emails strictly by threadId and contactId
    // The system requires we use threadId for emails (Gmail) or conversationId (Outlook)
    // We assume the threadId field is populated for email platforms.
    const emailMessages = sortedMessages.filter(m => m.platform === "EMAIL" && m.threadId);
    const nonEmailMessages = sortedMessages.filter(m => m.platform !== "EMAIL" || !m.threadId);

    // Process Emails
    const emailGroups = new Map<string, RawMessage[]>();
    for (const msg of emailMessages) {
        // We group by threadId. Optionally, if a thread involves multiple contacts, 
        // it would be split by contactId to maintain interaction stats per contact.
        const key = `${msg.contactId}-${msg.threadId}`;
        if (!emailGroups.has(key)) {
            emailGroups.set(key, []);
        }
        emailGroups.get(key)!.push(msg);
    }

    for (const [key, group] of emailGroups.entries()) {
        const contactId = group[0].contactId;
        const threadId = group[0].threadId;
        const startTime = group[0].date;
        const endTime = group[group.length - 1].date;
        const durationSeconds = Math.floor((endTime.getTime() - startTime.getTime()) / 1000);
        const directions = group.map(m => m.direction);

        sessions.push({
            contactId,
            platform: "EMAIL",
            startTime,
            endTime,
            durationSeconds,
            messageCount: group.length,
            rawMessageCount: group.length,
            directionSummary: getDirectionSummary(directions),
            threadId,
        });
    }

    // Process other platforms (Messaging/Calls/etc)
    // Group by contactId, then apply 30 minute gap logic
    const contactGroups = new Map<string, RawMessage[]>();
    for (const msg of nonEmailMessages) {
        if (!contactGroups.has(msg.contactId)) {
            contactGroups.set(msg.contactId, []);
        }
        contactGroups.get(msg.contactId)!.push(msg);
    }

    const THIRTY_MINUTES_MS = 30 * 60 * 1000;

    for (const [contactId, group] of contactGroups.entries()) {
        if (group.length === 0) continue;

        let currentSessionMessages: RawMessage[] = [group[0]];

        for (let i = 1; i < group.length; i++) {
            const msg = group[i];
            const lastMsg = currentSessionMessages[currentSessionMessages.length - 1];

            if (msg.platform === lastMsg.platform) {
                const timeGap = msg.date.getTime() - lastMsg.date.getTime();

                if (timeGap <= THIRTY_MINUTES_MS) {
                    // Keep in same session
                    currentSessionMessages.push(msg);
                } else {
                    // Break session
                    pushSession(sessions, currentSessionMessages);
                    currentSessionMessages = [msg];
                }
            } else {
                // Different platform, break session
                pushSession(sessions, currentSessionMessages);
                currentSessionMessages = [msg];
            }
        }

        if (currentSessionMessages.length > 0) {
            pushSession(sessions, currentSessionMessages);
        }
    }

    return sessions;
}

function pushSession(sessions: SessionInteraction[], messages: RawMessage[]) {
    if (messages.length === 0) return;

    const startTime = messages[0].date;
    const endTime = messages[messages.length - 1].date;
    const durationSeconds = Math.floor((endTime.getTime() - startTime.getTime()) / 1000);
    const directions = messages.map(m => m.direction);

    sessions.push({
        contactId: messages[0].contactId,
        platform: messages[0].platform,
        startTime,
        endTime,
        durationSeconds,
        messageCount: messages.length,
        rawMessageCount: messages.length,
        directionSummary: getDirectionSummary(directions),
    });
}
