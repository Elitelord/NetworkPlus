/**
 * Parser for LinkedIn messages.csv data export.
 * Groups messages by conversation thread and extracts interaction data.
 */

export interface LinkedInConversation {
    conversationId: string;
    contactName: string;
    profileUrl: string;
    messageCount: number;
    latestDate: string; // ISO string
    earliestDate: string; // ISO string
    contentPreview: string; // first non-empty message snippet
}

export interface SkippedConversation {
    conversationId: string;
    title: string;
    reason: string;
}

export interface LinkedInParseResult {
    conversations: LinkedInConversation[];
    skipped: SkippedConversation[];
}

interface RawMessage {
    conversationId: string;
    conversationTitle: string;
    from: string;
    senderProfileUrl: string;
    to: string;
    recipientProfileUrls: string;
    date: string;
    subject: string;
    content: string;
    folder: string;
}

/**
 * Parse a LinkedIn messages.csv file and group by conversation thread.
 * @param csvText - raw CSV text content
 * @param userName - the current user's LinkedIn display name (to identify "the other person")
 */
export function parseLinkedInMessages(
    csvText: string,
    userName: string
): LinkedInParseResult {
    const lines = parseCSVLines(csvText);
    if (lines.length < 2) {
        return { conversations: [], skipped: [] };
    }

    const headers = lines[0].map((h) => h.trim().toUpperCase());
    const colIdx = {
        conversationId: headers.indexOf("CONVERSATION ID"),
        conversationTitle: headers.indexOf("CONVERSATION TITLE"),
        from: headers.indexOf("FROM"),
        senderProfileUrl: headers.indexOf("SENDER PROFILE URL"),
        to: headers.indexOf("TO"),
        recipientProfileUrls: headers.indexOf("RECIPIENT PROFILE URLS"),
        date: headers.indexOf("DATE"),
        subject: headers.indexOf("SUBJECT"),
        content: headers.indexOf("CONTENT"),
        folder: headers.indexOf("FOLDER"),
    };

    // Validate required columns exist
    if (colIdx.conversationId === -1 || colIdx.from === -1 || colIdx.date === -1) {
        throw new Error(
            "Invalid LinkedIn messages CSV. Missing required columns: CONVERSATION ID, FROM, or DATE."
        );
    }

    // Parse rows into messages
    const messages: RawMessage[] = [];
    for (let i = 1; i < lines.length; i++) {
        const row = lines[i];
        if (row.length < 2) continue; // skip empty rows

        messages.push({
            conversationId: row[colIdx.conversationId]?.trim() || "",
            conversationTitle: row[colIdx.conversationTitle]?.trim() || "",
            from: row[colIdx.from]?.trim() || "",
            senderProfileUrl: row[colIdx.senderProfileUrl]?.trim() || "",
            to: row[colIdx.to]?.trim() || "",
            recipientProfileUrls: row[colIdx.recipientProfileUrls]?.trim() || "",
            date: row[colIdx.date]?.trim() || "",
            subject: row[colIdx.subject]?.trim() || "",
            content: row[colIdx.content]?.trim() || "",
            folder: row[colIdx.folder]?.trim() || "",
        });
    }

    // Group by conversation ID
    const convMap = new Map<string, RawMessage[]>();
    for (const msg of messages) {
        if (!msg.conversationId) continue;
        if (!convMap.has(msg.conversationId)) {
            convMap.set(msg.conversationId, []);
        }
        convMap.get(msg.conversationId)!.push(msg);
    }

    const conversations: LinkedInConversation[] = [];
    const skipped: SkippedConversation[] = [];
    const normalizedUserName = userName.trim().toLowerCase();

    for (const [convId, msgs] of convMap) {
        const firstMsg = msgs[0];

        // Filter: skip sponsored conversations
        if (
            firstMsg.conversationTitle === "Sponsored Conversation" ||
            msgs.every((m) => m.from === "LinkedIn Member" || m.from === "")
        ) {
            skipped.push({
                conversationId: convId,
                title: firstMsg.conversationTitle || firstMsg.subject || "Sponsored",
                reason: "Sponsored or automated message",
            });
            continue;
        }

        // Identify the other person (the contact, not the user)
        let contactName = "";
        let profileUrl = "";

        for (const m of msgs) {
            const fromLower = m.from.toLowerCase();
            if (fromLower && fromLower !== normalizedUserName) {
                contactName = m.from;
                profileUrl = m.senderProfileUrl;
                break;
            }
        }

        // If no other person found, try the "TO" field from user's sent messages
        if (!contactName) {
            for (const m of msgs) {
                if (m.from.toLowerCase() === normalizedUserName && m.to) {
                    contactName = m.to;
                    profileUrl = m.recipientProfileUrls;
                    break;
                }
            }
        }

        if (!contactName) {
            skipped.push({
                conversationId: convId,
                title: firstMsg.conversationTitle || firstMsg.subject || "Unknown",
                reason: "Could not identify contact",
            });
            continue;
        }

        // Aggregate conversation data
        const dates = msgs
            .map((m) => new Date(m.date))
            .filter((d) => !isNaN(d.getTime()))
            .sort((a, b) => a.getTime() - b.getTime());

        if (dates.length === 0) {
            skipped.push({
                conversationId: convId,
                title: contactName,
                reason: "No valid dates found",
            });
            continue;
        }

        // Find first non-empty content for preview
        const contentPreview =
            msgs.find((m) => m.content && !m.content.startsWith("<"))?.content?.slice(0, 120) || "";

        conversations.push({
            conversationId: convId,
            contactName,
            profileUrl,
            messageCount: msgs.length,
            latestDate: dates[dates.length - 1].toISOString(),
            earliestDate: dates[0].toISOString(),
            contentPreview,
        });
    }

    // Sort by latest date descending
    conversations.sort(
        (a, b) => new Date(b.latestDate).getTime() - new Date(a.latestDate).getTime()
    );

    return { conversations, skipped };
}

/**
 * Simple CSV parser that handles quoted fields with commas and newlines.
 */
function parseCSVLines(text: string): string[][] {
    const result: string[][] = [];
    let current: string[] = [];
    let field = "";
    let inQuotes = false;
    let i = 0;

    while (i < text.length) {
        const ch = text[i];

        if (inQuotes) {
            if (ch === '"') {
                if (i + 1 < text.length && text[i + 1] === '"') {
                    // escaped quote
                    field += '"';
                    i += 2;
                } else {
                    // end of quoted field
                    inQuotes = false;
                    i++;
                }
            } else {
                field += ch;
                i++;
            }
        } else {
            if (ch === '"') {
                inQuotes = true;
                i++;
            } else if (ch === ",") {
                current.push(field);
                field = "";
                i++;
            } else if (ch === "\r" || ch === "\n") {
                current.push(field);
                field = "";
                if (current.some((f) => f.trim() !== "")) {
                    result.push(current);
                }
                current = [];
                // handle \r\n
                if (ch === "\r" && i + 1 < text.length && text[i + 1] === "\n") {
                    i += 2;
                } else {
                    i++;
                }
            } else {
                field += ch;
                i++;
            }
        }
    }

    // Last field / row
    current.push(field);
    if (current.some((f) => f.trim() !== "")) {
        result.push(current);
    }

    return result;
}
