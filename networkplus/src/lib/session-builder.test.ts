import { describe, it, expect } from "vitest";
import { buildSessions, RawMessage } from "./session-builder";

describe("Session Builder", () => {
    it("groups emails strictly by threadId", () => {
        const messages: RawMessage[] = [
            {
                id: "1",
                threadId: "thread-1",
                platform: "EMAIL",
                date: new Date("2026-02-21T10:00:00Z"),
                contactId: "contact-1",
                direction: "INBOUND"
            },
            {
                id: "2",
                threadId: "thread-1",
                platform: "EMAIL",
                date: new Date("2026-02-21T10:15:00Z"),
                contactId: "contact-1",
                direction: "OUTBOUND"
            },
            {
                id: "3",
                threadId: "thread-2",
                platform: "EMAIL",
                date: new Date("2026-02-21T10:05:00Z"), // Even if date is within 30 min, threadId separates it
                contactId: "contact-1",
                direction: "INBOUND"
            }
        ];

        const sessions = buildSessions(messages);

        expect(sessions.length).toBe(2);

        const thread1Session = sessions.find(s => s.threadId === "thread-1");
        expect(thread1Session).toBeDefined();
        expect(thread1Session?.messageCount).toBe(2);
        expect(thread1Session?.directionSummary).toBe("MIXED");
        expect(thread1Session?.durationSeconds).toBe(15 * 60);

        const thread2Session = sessions.find(s => s.threadId === "thread-2");
        expect(thread2Session).toBeDefined();
        expect(thread2Session?.messageCount).toBe(1);
        expect(thread2Session?.directionSummary).toBe("INBOUND");
    });

    it("groups platform messages by 30-minute gaps", () => {
        const messages: RawMessage[] = [
            {
                id: "1",
                platform: "SMS",
                date: new Date("2026-02-21T10:00:00Z"),
                contactId: "contact-1",
                direction: "INBOUND"
            },
            {
                id: "2",
                platform: "SMS",
                date: new Date("2026-02-21T10:15:00Z"), // 15 mins gap
                contactId: "contact-1",
                direction: "OUTBOUND"
            },
            {
                id: "3",
                platform: "SMS",
                date: new Date("2026-02-21T11:00:00Z"), // 45 mins gap - NEW SESSION
                contactId: "contact-1",
                direction: "INBOUND"
            }
        ];

        const sessions = buildSessions(messages);

        expect(sessions.length).toBe(2);
        expect(sessions[0].messageCount).toBe(2);
        expect(sessions[0].durationSeconds).toBe(15 * 60);
        expect(sessions[0].directionSummary).toBe("MIXED");

        expect(sessions[1].messageCount).toBe(1);
        expect(sessions[1].directionSummary).toBe("INBOUND");
    });

    it("breaks session if platform changes, even within 30 mins", () => {
        const messages: RawMessage[] = [
            {
                id: "1",
                platform: "SMS",
                date: new Date("2026-02-21T10:00:00Z"),
                contactId: "contact-1",
                direction: "INBOUND"
            },
            {
                id: "2",
                platform: "CALL",
                date: new Date("2026-02-21T10:05:00Z"), // 5 mins gap, but different platform
                contactId: "contact-1",
                direction: "INBOUND"
            },
        ];

        const sessions = buildSessions(messages);

        expect(sessions.length).toBe(2);
        expect(sessions[0].platform).toBe("SMS");
        expect(sessions[1].platform).toBe("CALL");
    });

    it("handles heavy load: 10,000 interactions efficiently", () => {
        const messages: RawMessage[] = [];
        const baseDate = new Date("2026-01-01T00:00:00Z").getTime();

        for (let i = 0; i < 10000; i++) {
            // Space messages by 10 minutes usually, but force a 1 hour gap every 10 messages
            const gap = (i % 10 === 0) ? 3600000 : 600000;
            messages.push({
                id: `msg-${i}`,
                platform: "SMS",
                date: new Date(baseDate + (i * gap)),
                contactId: "contact-1",
                direction: i % 2 === 0 ? "INBOUND" : "OUTBOUND"
            });
        }

        const start = performance.now();
        const sessions = buildSessions(messages);
        const end = performance.now();

        // 10000 messages chunked into sessions. Since every 10th message has a 1hr gap,
        // we should roughly see 1000 sessions.
        expect(sessions.length).toBeGreaterThan(0);
        expect(end - start).toBeLessThan(1000); // Should be very fast
    });

    it("verifies precise behavior exactly on the 30-minute gap boundary", () => {
        const messages: RawMessage[] = [
            {
                id: "1",
                platform: "SMS",
                date: new Date("2026-02-21T10:00:00.000Z"),
                contactId: "contact-1",
                direction: "INBOUND"
            },
            {
                id: "2",
                platform: "SMS",
                date: new Date("2026-02-21T10:30:00.000Z"), // EXACTLY 30 minutes gap
                contactId: "contact-1",
                direction: "OUTBOUND"
            },
            {
                id: "3",
                platform: "SMS",
                date: new Date("2026-02-21T11:00:00.001Z"), // 30 minutes and 1 millisecond gap
                contactId: "contact-1",
                direction: "INBOUND"
            }
        ];

        const sessions = buildSessions(messages);

        // The session builder uses strictly greater than (Gap > 30 mins) to split,
        // so EXACTLY 30 mins should be in the same session, 
        // > 30 mins should be in a new session.
        expect(sessions.length).toBe(2);

        // Session 1 should have msg 1 and 2
        expect(sessions[0].messageCount).toBe(2);
        expect(sessions[0].durationSeconds).toBe(30 * 60);

        // Session 2 should have msg 3
        expect(sessions[1].messageCount).toBe(1);
    });
});

