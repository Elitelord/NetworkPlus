import Papa from "papaparse";

// ─── Types ───────────────────────────────────────────────────────────────────

export type NormalizedContact = {
    name: string;
    email?: string;
    phone?: string;
    group?: string;
    description?: string;
    metadata?: Record<string, any>;
};

export type SkippedRow = {
    row: number;
    name: string;
    reason: string;
};

export type ParseResult = {
    valid: NormalizedContact[];
    skipped: SkippedRow[];
    fileType: "csv" | "vcf";
};

// ─── Header Normalization Maps ───────────────────────────────────────────────

const EMAIL_HEADERS = new Set([
    "email",
    "e-mail",
    "email address",
    "e-mail address",
    "email 1 - value",
]);

const PHONE_HEADERS = new Set([
    "phone",
    "phone number",
    "mobile",
    "mobile number",
    "phone 1 - value",
    "telephone",
    "tel",
]);

const GROUP_HEADERS = new Set([
    "group",
    "groups",
    "labels",
    "label",
    "category",
    "categories",
    "group membership",
]);

const DESCRIPTION_HEADERS = new Set([
    "description",
    "notes",
    "note",
    "bio",
]);

const NAME_HEADERS = new Set([
    "name",
    "full name",
    "fn",
    "display name",
]);

const FIRST_NAME_HEADERS = new Set([
    "first name",
    "given name",
    "first",
]);

const LAST_NAME_HEADERS = new Set([
    "last name",
    "family name",
    "last",
    "surname",
]);

// Headers we handle explicitly — everything else becomes metadata
const KNOWN_HEADERS = new Set([
    ...EMAIL_HEADERS,
    ...PHONE_HEADERS,
    ...GROUP_HEADERS,
    ...DESCRIPTION_HEADERS,
    ...NAME_HEADERS,
    ...FIRST_NAME_HEADERS,
    ...LAST_NAME_HEADERS,
]);

// ─── File Type Detection ─────────────────────────────────────────────────────

export function detectFileType(file: File): "csv" | "vcf" | null {
    const ext = file.name.split(".").pop()?.toLowerCase();
    if (ext === "csv") return "csv";
    if (ext === "vcf" || ext === "vcard") return "vcf";
    return null;
}

// ─── Name Derivation ─────────────────────────────────────────────────────────

function findHeaderValue(
    row: Record<string, string>,
    candidates: Set<string>
): string | undefined {
    for (const key of Object.keys(row)) {
        if (candidates.has(key.toLowerCase().trim())) {
            return row[key];
        }
    }
    return undefined;
}

function deriveName(row: Record<string, string>): string {
    // 1. Direct name field
    const directName = findHeaderValue(row, NAME_HEADERS);
    if (directName?.trim()) return directName.trim();

    // 2. First Name + Last Name
    const first = findHeaderValue(row, FIRST_NAME_HEADERS)?.trim() || "";
    const last = findHeaderValue(row, LAST_NAME_HEADERS)?.trim() || "";
    const combined = `${first} ${last}`.trim();
    if (combined) return combined;

    return "";
}

// ─── CSV Parsing ─────────────────────────────────────────────────────────────

function normalizeCSVRow(
    row: Record<string, string>,
    rowNum: number
): { contact: NormalizedContact } | { skipped: SkippedRow } {
    const name = deriveName(row);
    if (!name) {
        return {
            skipped: { row: rowNum, name: "Unknown", reason: "Could not derive name from any column" },
        };
    }

    const email = findHeaderValue(row, EMAIL_HEADERS)?.trim() || undefined;
    const phone = findHeaderValue(row, PHONE_HEADERS)?.trim() || undefined;
    const group = findHeaderValue(row, GROUP_HEADERS)?.trim() || undefined;
    const description = findHeaderValue(row, DESCRIPTION_HEADERS)?.trim() || undefined;

    // Collect unknown headers into metadata
    const metadata: Record<string, any> = {};
    for (const key of Object.keys(row)) {
        const lower = key.toLowerCase().trim();
        if (!KNOWN_HEADERS.has(lower) && row[key]?.trim()) {
            metadata[key] = row[key].trim();
        }
    }

    return {
        contact: {
            name,
            email,
            phone,
            group,
            description,
            metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
        },
    };
}

export function parseCSV(file: File): Promise<ParseResult> {
    return new Promise((resolve, reject) => {
        Papa.parse(file, {
            header: true,
            skipEmptyLines: true,
            complete: (results) => {
                const valid: NormalizedContact[] = [];
                const skipped: SkippedRow[] = [];

                (results.data as Record<string, string>[]).forEach((row, index) => {
                    const rowNum = index + 2; // header is row 1
                    const result = normalizeCSVRow(row, rowNum);

                    if ("contact" in result) {
                        valid.push(result.contact);
                    } else {
                        skipped.push(result.skipped);
                    }
                });

                resolve({ valid, skipped, fileType: "csv" });
            },
            error: (err) => {
                reject(new Error(`CSV parse error: ${err.message}`));
            },
        });
    });
}

// ─── VCF Parsing ─────────────────────────────────────────────────────────────

function parseVCardBlock(lines: string[]): NormalizedContact | null {
    let name = "";
    const emails: string[] = [];
    const phones: string[] = [];
    let note = "";
    const metadata: Record<string, any> = {};

    for (const line of lines) {
        // vCard lines can be "KEY;PARAMS:VALUE" or "KEY:VALUE"
        const colonIdx = line.indexOf(":");
        if (colonIdx === -1) continue;

        const rawKey = line.substring(0, colonIdx).toUpperCase();
        const value = line.substring(colonIdx + 1).trim();

        // Strip parameters (e.g., "TEL;TYPE=CELL" → "TEL")
        const key = rawKey.split(";")[0];

        switch (key) {
            case "FN":
                name = value;
                break;
            case "EMAIL":
                if (value) emails.push(value);
                break;
            case "TEL":
                if (value) phones.push(value);
                break;
            case "ORG":
                if (value) metadata.company = value.replace(/;/g, " ").trim();
                break;
            case "TITLE":
                if (value) metadata.title = value;
                break;
            case "NOTE":
                note = value;
                break;
            case "N":
                // N:LastName;FirstName;MiddleName;Prefix;Suffix
                // Use as fallback if FN is empty
                if (!name) {
                    const parts = value.split(";");
                    const derived = `${parts[1] || ""} ${parts[0] || ""}`.trim();
                    if (derived) name = derived;
                }
                break;
        }
    }

    if (!name.trim()) return null;

    // Store extra emails/phones in metadata
    if (emails.length > 1) {
        metadata.additionalEmails = emails.slice(1);
    }
    if (phones.length > 1) {
        metadata.additionalPhones = phones.slice(1);
    }

    return {
        name: name.trim(),
        email: emails[0] || undefined,
        phone: phones[0] || undefined,
        description: note || undefined,
        metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
    };
}

export function parseVCF(file: File): Promise<ParseResult> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();

        reader.onload = () => {
            try {
                const text = reader.result as string;
                if (!text.trim()) {
                    reject(new Error("File is empty"));
                    return;
                }

                const valid: NormalizedContact[] = [];
                const skipped: SkippedRow[] = [];
                const lines = text.split(/\r?\n/);

                let currentBlock: string[] = [];
                let inCard = false;
                let cardIndex = 0;

                for (const line of lines) {
                    const trimmed = line.trim();

                    if (trimmed.toUpperCase() === "BEGIN:VCARD") {
                        inCard = true;
                        currentBlock = [];
                        continue;
                    }

                    if (trimmed.toUpperCase() === "END:VCARD") {
                        cardIndex++;
                        inCard = false;

                        const contact = parseVCardBlock(currentBlock);
                        if (contact) {
                            valid.push(contact);
                        } else {
                            skipped.push({
                                row: cardIndex,
                                name: "Unknown",
                                reason: "Could not derive name from vCard entry",
                            });
                        }

                        currentBlock = [];
                        continue;
                    }

                    if (inCard) {
                        // Handle line folding (RFC 6350: continuation lines start with space/tab)
                        if (
                            (line.startsWith(" ") || line.startsWith("\t")) &&
                            currentBlock.length > 0
                        ) {
                            currentBlock[currentBlock.length - 1] += trimmed;
                        } else {
                            currentBlock.push(trimmed);
                        }
                    }
                }

                resolve({ valid, skipped, fileType: "vcf" });
            } catch (err) {
                reject(err);
            }
        };

        reader.onerror = () => reject(new Error("Failed to read VCF file"));
        reader.readAsText(file);
    });
}

// ─── Top-Level Dispatcher ────────────────────────────────────────────────────

export async function parseFile(file: File): Promise<ParseResult> {
    const type = detectFileType(file);

    if (!type) {
        throw new Error("Unsupported file type. Please upload a .csv or .vcf file.");
    }

    if (type === "csv") return parseCSV(file);
    return parseVCF(file);
}
