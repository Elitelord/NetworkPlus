import { parseLinkedInMessages } from "./linkedin-message-parser";
import { describe, it, expect } from "vitest";

const dummyCsv = `CONVERSATION ID,CONVERSATION TITLE,FROM,SENDER PROFILE URL,TO,RECIPIENT PROFILE URLS,DATE,SUBJECT,CONTENT,FOLDER,ATTACHMENTS
2-Mjk2Mjc1MWItY2M2ZS00YzE1LWI4NjgtMThjNWI1Y2ZkZWNiXzEwMA==,,Sameer Agarwal,https://www.linkedin.com/in/sameera07,Aniket Gupta,https://www.linkedin.com/in/aniketgupta25,2026-02-15 00:04:28 UTC,,I think I applied to the Applied AI Engineering role on the Google form.,INBOX,
2-Mjk2Mjc1MWItY2M2ZS00YzE1LWI4NjgtMThjNWI1Y2ZkZWNiXzEwMA==,,Aniket Gupta,https://www.linkedin.com/in/aniketgupta25,Sameer Agarwal,https://www.linkedin.com/in/sameera07,2026-02-14 22:48:14 UTC,,"Hey Sameer, sure. Have you applied via the link?",INBOX,
2-Yjk3ZmJlYWItYmJmYi00ZjFlLTk0YjEtODhlMDk5YTJjNTIyXzEwMA==,Looking for a Spring Internship?,Sean Parker,https://www.linkedin.com/in/sean,Sameer Agarwal,https://www.linkedin.com/in/sameera07,2026-02-14 18:23:34 UTC,Following up,"Hi Sameer, I just thought I'd follow up on my previous message.",INBOX,
2-NDQ5NDU3ZDMtYzVlMy00MzM3LWI0ZjUtZmFjMWNhOGQ5NTYxXzEwMA==,Sponsored Conversation,LinkedIn Member,,Sameer Agarwal,https://www.linkedin.com/in/sameera07,2026-02-07 15:48:30 UTC,,<p>Hi there</p>,INBOX,
`;

describe("parseLinkedInMessages", () => {
    it("should parse conversations correctly and filter sponsored messages", () => {
        const result = parseLinkedInMessages(dummyCsv, "Sameer Agarwal");

        // 2 valid conversations, 1 sponsored
        expect(result.conversations.length).toBe(2);
        expect(result.skipped.length).toBe(1);

        // Ensure Aniket Gupta conversation is merged
        const aniketConv = result.conversations.find(c => c.contactName === "Aniket Gupta");
        expect(aniketConv).toBeDefined();
        expect(aniketConv?.messageCount).toBe(2);

        // Ensure Sean Parker is correctly identified as contact
        const seanConv = result.conversations.find(c => c.contactName === "Sean Parker");
        expect(seanConv).toBeDefined();
        expect(seanConv?.messageCount).toBe(1);

        // Ensure Sponsored is skipped
        expect(result.skipped[0].reason).toBe("Sponsored or automated message");
    });

    it("should handle heavy load of 50,000 rows quickly", () => {
        let csvContent = "CONVERSATION ID,CONVERSATION TITLE,FROM,SENDER PROFILE URL,TO,RECIPIENT PROFILE URLS,DATE,SUBJECT,CONTENT,FOLDER,ATTACHMENTS\n";

        // Generate 50,000 rows. Note that Papaparse is fast, but generating the string locally takes memory.
        for (let i = 0; i < 50000; i++) {
            const date = new Date(Date.now() - i * 10000).toISOString().replace("T", " ").replace("Z", " UTC");
            csvContent += `conv-${i % 100},Title,User ${i % 500},url,Sameer Agarwal,url,${date},Subject,Test message content ${i},INBOX,\n`;
        }

        const start = performance.now();
        const result = parseLinkedInMessages(csvContent, "Sameer Agarwal");
        const end = performance.now();

        // Should return valid parsed conversations spanning the 500 users
        expect(result.conversations.length).toBeGreaterThan(0);
        // Should parse 50,000 messages total (some may be skipped if invalid, but in this synthetic data they are valid)
        const totalMessages = result.conversations.reduce((acc, conv) => acc + conv.messageCount, 0);
        expect(totalMessages).toBe(50000);
        // Time check: shouldn't take excessively long (should be well under a few seconds)
        expect(end - start).toBeLessThan(3000);
    });

    it("should handle edge cases including multiline content and missing fields", () => {
        const edgeCaseCsv = `CONVERSATION ID,CONVERSATION TITLE,FROM,SENDER PROFILE URL,TO,RECIPIENT PROFILE URLS,DATE,SUBJECT,CONTENT,FOLDER,ATTACHMENTS
1-MISSING-DATE,,Jane Doe,url,Sameer Agarwal,url,,,"Message missing date",INBOX,
2-WEIRD-DATE,,John Smith,url,Sameer Agarwal,url,Not A real date,,"Message with weird date",INBOX,
3-MULTILINE,,Alice Jones,url,Sameer Agarwal,url,2026-02-14 22:48:14 UTC,,"This message
has multiple
lines and ""quotes"" inside it.",INBOX,
,,Sameer Agarwal,,Sameer Agarwal,,2026-02-14 22:48:14,,,INBOX,
`;

        const result = parseLinkedInMessages(edgeCaseCsv, "Sameer Agarwal");

        // Missing dates/weird dates should either be skipped or parsed as Invalid Date depending on implementation.
        // The multiline message should be parsed correctly.
        const aliceConv = result.conversations.find(c => c.contactName === "Alice Jones");
        expect(aliceConv).toBeDefined();
        // Since we didn't specify the exact internal data structure here, we just verify it extracted Alice.
        expect(aliceConv?.messageCount).toBe(1);
    });

    it("throws when required columns are missing", () => {
        const badCsv = "SOME COLUMN,OTHER\nval1,val2";
        expect(() => parseLinkedInMessages(badCsv, "Me")).toThrow(
            "Invalid LinkedIn messages CSV. Missing required columns"
        );
    });

    it("returns empty conversations for empty or single-line CSV", () => {
        expect(parseLinkedInMessages("", "Me")).toEqual({ conversations: [], skipped: [] });
        expect(parseLinkedInMessages("Just one line", "Me")).toEqual({ conversations: [], skipped: [] });
    });
});
