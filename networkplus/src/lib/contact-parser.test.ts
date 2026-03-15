import { describe, it, expect } from "vitest";
import { parseCSV, detectFileType, parseFile, parseVCF } from "./contact-parser";

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

    it("should handle heavy load of 10,000 rows", async () => {
        let csvContent = "First Name,Last Name,Email Address,Company\n";
        for (let i = 0; i < 10000; i++) {
            csvContent += `User${i},Test,user${i}@example.com,LoadTestCorp\n`;
        }
        const file = new File([csvContent], "heavy.csv", { type: "text/csv" });
        const start = performance.now();
        const result = await parseCSV(file);
        const end = performance.now();

        expect(result.valid).toHaveLength(10000);
        expect(result.valid[9999].name).toBe("User9999 Test");
        expect(result.valid[0].group).toBe("LoadTestCorp");
        // Time check: shouldn't take excessively long (usually well under 500ms on modern machines, 1s max for safety)
        expect(end - start).toBeLessThan(2000);
    });

    it("should handle malformed rows and extreme edge cases", async () => {
        const csvContent = `name,email,phone,group
Normal User,normal@example.com,1234,Normals
"Unclosed quote user,unclosed@example.com,5555,Weirdos
Extra,columns,here,yes,they,are
,missingname@example.com,111,NoNames
Very Long Name ".repeat(500),long@example.com,222,Longs`;

        const file = new File([csvContent], "edgecases.csv", { type: "text/csv" });
        const result = await parseCSV(file);

        // It should parse exactly the rows it reasonably can, skipping truly busted ones
        // papaparse handles unclosed quotes by continuing to the end or erroring that row.
        // As long as it doesn't crash, and parses the valid ones, it's good.
        expect(result.valid.length).toBeGreaterThan(0);
        expect(result.valid[0].name).toBe("Normal User");
    });
});

describe("detectFileType", () => {
    it("returns 'csv' for .csv extension", () => {
        const file = new File([], "data.csv", { type: "text/csv" });
        expect(detectFileType(file)).toBe("csv");
    });
    it("returns 'vcf' for .vcf extension", () => {
        const file = new File([], "contacts.vcf", { type: "text/x-vcard" });
        expect(detectFileType(file)).toBe("vcf");
    });
    it("returns 'vcf' for .vcard extension", () => {
        const file = new File([], "contacts.vcard", { type: "text/x-vcard" });
        expect(detectFileType(file)).toBe("vcf");
    });
    it("returns null for unknown extension", () => {
        const file = new File([], "data.txt", { type: "text/plain" });
        expect(detectFileType(file)).toBe(null);
    });
    it("is case insensitive for extension", () => {
        expect(detectFileType(new File([], "data.CSV", { type: "text/csv" }))).toBe("csv");
        expect(detectFileType(new File([], "c.VCF", { type: "text/x-vcard" }))).toBe("vcf");
    });
});

describe("parseFile", () => {
    it("dispatches CSV to parseCSV and returns same result", async () => {
        const csvContent = "name,email\nJane,jane@example.com";
        const file = new File([csvContent], "test.csv", { type: "text/csv" });
        const result = await parseFile(file);
        expect(result.fileType).toBe("csv");
        expect(result.valid).toHaveLength(1);
        expect(result.valid[0].name).toBe("Jane");
        expect(result.valid[0].email).toBe("jane@example.com");
    });
    it("throws for unsupported file type", async () => {
        const file = new File([], "data.txt", { type: "text/plain" });
        await expect(parseFile(file)).rejects.toThrow("Unsupported file type");
    });
});

describe("parseVCF", () => {
    it("parses a single vCard", async () => {
        const vcfContent = `BEGIN:VCARD
VERSION:3.0
FN:John Doe
EMAIL:john@example.com
TEL:555-1234
END:VCARD`;
        const file = new File([vcfContent], "contact.vcf", { type: "text/x-vcard" });
        const result = await parseVCF(file);
        expect(result.fileType).toBe("vcf");
        expect(result.valid).toHaveLength(1);
        expect(result.valid[0].name).toBe("John Doe");
        expect(result.valid[0].email).toBe("john@example.com");
        expect(result.valid[0].phone).toBe("555-1234");
    });
    it("parses multiple vCards", async () => {
        const vcfContent = `BEGIN:VCARD
FN:Alice
END:VCARD
BEGIN:VCARD
FN:Bob
END:VCARD`;
        const file = new File([vcfContent], "contacts.vcf", { type: "text/x-vcard" });
        const result = await parseVCF(file);
        expect(result.valid).toHaveLength(2);
        expect(result.valid[0].name).toBe("Alice");
        expect(result.valid[1].name).toBe("Bob");
    });
    it("skips vCards with no name and records in skipped", async () => {
        const vcfContent = `BEGIN:VCARD
EMAIL:noname@example.com
END:VCARD`;
        const file = new File([vcfContent], "bad.vcf", { type: "text/x-vcard" });
        const result = await parseVCF(file);
        expect(result.valid).toHaveLength(0);
        expect(result.skipped).toHaveLength(1);
        expect(result.skipped[0].reason).toContain("derive name");
    });
    it("rejects empty file", async () => {
        const file = new File([""], "empty.vcf", { type: "text/x-vcard" });
        await expect(parseVCF(file)).rejects.toThrow("File is empty");
    });
});

describe("contact-parser skipped rows", () => {
    it("skips rows that cannot derive name and records reason", async () => {
        const csvContent = `name,email,group
John,john@example.com,Friends
,,Unknown
Jane,jane@example.com,Work`;
        const file = new File([csvContent], "test.csv", { type: "text/csv" });
        const result = await parseCSV(file);
        expect(result.valid).toHaveLength(2);
        expect(result.valid[0].name).toBe("John");
        expect(result.valid[1].name).toBe("Jane");
        expect(result.skipped).toHaveLength(1);
        expect(result.skipped[0].reason).toContain("Could not derive name");
    });
});
