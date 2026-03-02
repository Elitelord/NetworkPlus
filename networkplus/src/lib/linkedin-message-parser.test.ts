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
});
