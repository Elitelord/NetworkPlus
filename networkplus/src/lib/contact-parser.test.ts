import { describe, it, expect } from "vitest";
import { parseCSV } from "./contact-parser";

describe("contact-parser", () => {
    it("should parse CSV with standard headers", async () => {
        const csvContent = `name,email,phone,group
John Doe,john@example.com,1234567890,Friends`;
        const file = new File([csvContent], "test.csv", { type: "text/csv" });
        const result = await parseCSV(file);

        expect(result.valid).toHaveLength(1);
        expect(result.valid[0]).toEqual({
            name: "John Doe",
            email: "john@example.com",
            phone: "1234567890",
            group: "Friends",
            metadata: undefined
        });
    });

    it("should handle 'First Name' and 'Last Name' mixed case headers", async () => {
        const csvContent = `First Name,Last Name,Email Address,Company
John,Doe,john@example.com,Acme Corp`;
        const file = new File([csvContent], "test.csv", { type: "text/csv" });
        const result = await parseCSV(file);

        expect(result.valid).toHaveLength(1);
        expect(result.valid[0]).toEqual({
            name: "John Doe",
            email: "john@example.com",
            group: "Acme Corp",
            phone: undefined,
            description: undefined,
            metadata: undefined
        });
    });

    it("should handle 'Company' mapping to group", async () => {
        const csvContent = `Name,Company
Jane Smith,Tech Inc`;
        const file = new File([csvContent], "test.csv", { type: "text/csv" });
        const result = await parseCSV(file);

        expect(result.valid).toHaveLength(1);
        expect(result.valid[0].group).toBe("Tech Inc");
    });

    it("should parse user sample data correctly", async () => {
        const userSample = `First Name,Last Name,URL,Email Address,Company,Position,Connected On
Adetola,Adetunji,https://www.linkedin.com/in/adetola-adetunji,,Sustainable Building Initiative,Software Engineer,15 Feb 2026
Andrew,Nguyen,https://www.linkedin.com/in/andrew-nguyen-2026b93a1,,FinTech UTD,Corporate Relations Officer,15 Feb 2026
Adenifemi,Soyemi,https://www.linkedin.com/in/adenifemisoyemi,,,,13 Feb 2026
Advay,Kotla,https://www.linkedin.com/in/advay-kotla-a71431325,,,,13 Feb 2026
Max,Hartfield,https://www.linkedin.com/in/max-hartfield,,Amazon,Software Development Engineering Intern,12 Feb 2026`;

        const file = new File([userSample], "user-sample.csv", { type: "text/csv" });
        const result = await parseCSV(file);

        expect(result.valid).toHaveLength(5);

        // Check first entry
        expect(result.valid[0]).toEqual({
            name: "Adetola Adetunji",
            group: "Sustainable Building Initiative", // From Company
            email: undefined,
            phone: undefined,
            description: undefined,
            metadata: {
                "URL": "https://www.linkedin.com/in/adetola-adetunji",
                "Position": "Software Engineer",
                "Connected On": "15 Feb 2026"
            }
        });

        // Check entry with empty company (Adenifemi Soyemi)
        expect(result.valid[2]).toEqual({
            name: "Adenifemi Soyemi",
            group: undefined,
            email: undefined,
            phone: undefined,
            description: undefined,
            metadata: {
                "URL": "https://www.linkedin.com/in/adenifemisoyemi",
                "Connected On": "13 Feb 2026"
            }
        });

        // Check entry with different company (Max Hartfield)
        expect(result.valid[4].name).toBe("Max Hartfield");
        expect(result.valid[4].group).toBe("Amazon");
        expect(result.valid[4].metadata?.["Position"]).toBe("Software Development Engineering Intern");
    });

    it("should handle CSV with BOM (Byte Order Mark)", async () => {
        const csvContent = `\ufeffFirst Name,Last Name,Email
John,Doe,john@example.com`;
        const file = new File([csvContent], "test.csv", { type: "text/csv" });
        const result = await parseCSV(file);

        expect(result.valid).toHaveLength(1);
        expect(result.valid[0].name).toBe("John Doe");
    });

    it("should match headers fuzzily (ignoring symbols)", async () => {
        const csvContent = `First_Name,Last-Name,Email.Address,Company*Name
John,Doe,john@example.com,Acme`;
        const file = new File([csvContent], "test.csv", { type: "text/csv" });
        const result = await parseCSV(file);
        expect(result.valid).toHaveLength(1);
        expect(result.valid[0]).toEqual({
            name: "John Doe",
            email: "john@example.com",
            group: "Acme",
            phone: undefined,
            description: undefined,
            metadata: undefined
        });
    });

    it("should handle LinkedIn CSV with preamble row", async () => {
        const csvContent = `Notes: "When exporting your connection data, you may notice..."
First Name,Last Name,URL,Email Address,Company,Position,Connected On
Adetola,Adetunji,https://www.linkedin.com/in/adetola-adetunji,,Sustainable Building Initiative,Software Engineer,15 Feb 2026`;
        const file = new File([csvContent], "linkedin.csv", { type: "text/csv" });
        const result = await parseCSV(file);

        expect(result.valid).toHaveLength(1);
        expect(result.valid[0].name).toBe("Adetola Adetunji");
        expect(result.valid[0].group).toBe("Sustainable Building Initiative");
    });
});
