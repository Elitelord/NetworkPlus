import Papa from "papaparse";

// ─── Types ───────────────────────────────────────────────────────────────────

export type NormalizedContact = {
    name: string;
    email?: string;
    phone?: string;
    group?: string;
    description?: string;
    /** CSV columns mapped to contact profile */
    city?: string;
    currentCompany?: string;
    currentSchool?: string;
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
    "company",
    "organization",
    "org",
    "company name",
]);

const DESCRIPTION_HEADERS = new Set([
    "description",
    "notes",
    "note",
    "bio",
]);

const CITY_HEADERS = new Set(["city", "hometown", "location"]);

const CURRENT_COMPANY_HEADERS = new Set([
    "current company",
    "current employer",
    "workplace",
    "employer",
]);

const CURRENT_SCHOOL_HEADERS = new Set([
    "current school",
    "school",
    "university",
    "college",
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

// Helper to normalize strings for comparison (lowercase, remove non-alphanumeric)
const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

const normalizeSet = (s: Set<string>) => new Set([...s].map(normalize));

const N_EMAIL_HEADERS = normalizeSet(EMAIL_HEADERS);
const N_PHONE_HEADERS = normalizeSet(PHONE_HEADERS);
const N_GROUP_HEADERS = normalizeSet(GROUP_HEADERS);
const N_DESCRIPTION_HEADERS = normalizeSet(DESCRIPTION_HEADERS);
const N_NAME_HEADERS = normalizeSet(NAME_HEADERS);
const N_FIRST_NAME_HEADERS = normalizeSet(FIRST_NAME_HEADERS);
const N_LAST_NAME_HEADERS = normalizeSet(LAST_NAME_HEADERS);
const N_CITY_HEADERS = normalizeSet(CITY_HEADERS);
const N_CURRENT_COMPANY_HEADERS = normalizeSet(CURRENT_COMPANY_HEADERS);
const N_CURRENT_SCHOOL_HEADERS = normalizeSet(CURRENT_SCHOOL_HEADERS);

// Headers we handle explicitly — everything else becomes metadata
const KNOWN_HEADERS = new Set([
    ...EMAIL_HEADERS,
    ...PHONE_HEADERS,
    ...GROUP_HEADERS,
    ...DESCRIPTION_HEADERS,
    ...NAME_HEADERS,
    ...FIRST_NAME_HEADERS,
    ...LAST_NAME_HEADERS,
    ...CITY_HEADERS,
    ...CURRENT_COMPANY_HEADERS,
    ...CURRENT_SCHOOL_HEADERS,
]);

const N_KNOWN_HEADERS = normalizeSet(KNOWN_HEADERS);

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
    normalizedCandidates: Set<string>
): string | undefined {
    for (const key of Object.keys(row)) {
        if (normalizedCandidates.has(normalize(key))) {
            return row[key];
        }
    }
    return undefined;
}

function deriveName(row: Record<string, string>): string {
    // 1. Direct name field
    const directName = findHeaderValue(row, N_NAME_HEADERS);
    if (directName?.trim()) return directName.trim();

    // 2. First Name + Last Name
    const first = findHeaderValue(row, N_FIRST_NAME_HEADERS)?.trim() || "";
    const last = findHeaderValue(row, N_LAST_NAME_HEADERS)?.trim() || "";
    const combined = `${first} ${last}`.trim();
    if (combined) return combined;

    return "";
}

// ─── CSV Parsing ─────────────────────────────────────────────────────────────


// All known header candidates flattened for detecting the real header row
const ALL_KNOWN_NORMALIZED = new Set([
    ...N_KNOWN_HEADERS,
    "url", "position", "connectedon", "title", "website",
]);

/**
 * Heuristic: a line is a "real header row" if it has 2+ comma-separated
 * fields and at least 2 of them normalize to something we recognise.
 */
function looksLikeHeaderRow(line: string): boolean {
    const fields = line.split(",").map(f => f.trim().toLowerCase().replace(/[^a-z0-9]/g, ""));
    if (fields.length < 2) return false;
    const hits = fields.filter(f => ALL_KNOWN_NORMALIZED.has(f)).length;
    return hits >= 2;
}

export function parseCSV(file: File): Promise<ParseResult> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();

        reader.onload = () => {
            try {
                let text = (reader.result as string).replace(/^\ufeff/, ""); // strip BOM

                // Find the real header row (skip preamble lines like LinkedIn's "Notes:" row)
                const lines = text.split(/\r?\n/);
                let headerIdx = -1;
                for (let i = 0; i < Math.min(lines.length, 10); i++) {
                    if (looksLikeHeaderRow(lines[i])) {
                        headerIdx = i;
                        break;
                    }
                }

                // Reconstruct CSV from the real header row onward
                if (headerIdx > 0) {
                    text = lines.slice(headerIdx).join("\n");
                } else if (headerIdx === -1 && lines.length > 0) {
                    // If no header found in first 10 rows, use first row anyway as fallback
                    headerIdx = 0;
                }

                Papa.parse(text, {
                    header: true,
                    skipEmptyLines: true,
                    complete: (results) => {
                        const valid: NormalizedContact[] = [];
                        const skipped: SkippedRow[] = [];

                        if (results.data.length === 0) {
                            resolve({ valid: [], skipped: [], fileType: "csv" });
                            return;
                        }

                        // Determine field mappings once
                        const firstRow = results.data[0] as Record<string, string>;
                        const keys = Object.keys(firstRow);
                        
                        const colMap = {
                            name: keys.find(k => N_NAME_HEADERS.has(normalize(k))),
                            first: keys.find(k => N_FIRST_NAME_HEADERS.has(normalize(k))),
                            last: keys.find(k => N_LAST_NAME_HEADERS.has(normalize(k))),
                            email: keys.find(k => N_EMAIL_HEADERS.has(normalize(k))),
                            phone: keys.find(k => N_PHONE_HEADERS.has(normalize(k))),
                            group: keys.find(k => N_GROUP_HEADERS.has(normalize(k))),
                            description: keys.find(k => N_DESCRIPTION_HEADERS.has(normalize(k))),
                            city: keys.find(k => N_CITY_HEADERS.has(normalize(k))),
                            currentCompany: keys.find(k => N_CURRENT_COMPANY_HEADERS.has(normalize(k))),
                            currentSchool: keys.find(k => N_CURRENT_SCHOOL_HEADERS.has(normalize(k))),
                        };

                        const metadataKeys = keys.filter(k => {
                            const nk = normalize(k);
                            return !N_KNOWN_HEADERS.has(nk) && !N_FIRST_NAME_HEADERS.has(nk) && !N_LAST_NAME_HEADERS.has(nk);
                        });

                        (results.data as Record<string, string>[]).forEach((row, index) => {
                            const rowNum = index + 2; // header is row 1
                            
                            // Derive name
                            let name = "";
                            if (colMap.name) {
                                name = row[colMap.name]?.trim() || "";
                            } 
                            
                            if (!name && colMap.first) {
                                const first = row[colMap.first]?.trim() || "";
                                const last = colMap.last ? (row[colMap.last]?.trim() || "") : "";
                                name = `${first} ${last}`.trim();
                            }

                            if (!name) {
                                skipped.push({ row: rowNum, name: "Unknown", reason: "Could not derive name from any column" });
                                return;
                            }

                            const contact: NormalizedContact = {
                                name,
                                email: colMap.email ? (row[colMap.email]?.trim() || undefined) : undefined,
                                phone: colMap.phone ? (row[colMap.phone]?.trim() || undefined) : undefined,
                                group: colMap.group ? (row[colMap.group]?.trim() || undefined) : undefined,
                                description: colMap.description ? (row[colMap.description]?.trim() || undefined) : undefined,
                                city: colMap.city ? (row[colMap.city]?.trim() || undefined) : undefined,
                                currentCompany: colMap.currentCompany ? (row[colMap.currentCompany]?.trim() || undefined) : undefined,
                                currentSchool: colMap.currentSchool ? (row[colMap.currentSchool]?.trim() || undefined) : undefined,
                            };

                            const metadata: Record<string, any> = {};
                            for (const k of metadataKeys) {
                                const val = row[k]?.trim();
                                if (val) metadata[k] = val;
                            }

                            if (Object.keys(metadata).length > 0) {
                                contact.metadata = metadata;
                            }

                            valid.push(contact);
                        });

                        resolve({ valid, skipped, fileType: "csv" });
                    },
                    error: (err: any) => {
                        reject(new Error(`CSV parse error: ${err.message}`));
                    },
                });
            } catch (err) {
                reject(err);
            }
        };

        reader.onerror = () => reject(new Error("Failed to read CSV file"));
        reader.readAsText(file);
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
