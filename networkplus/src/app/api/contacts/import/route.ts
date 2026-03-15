import { NextResponse } from "next/server";
import { type Session } from "next-auth";
import { auth } from "@/auth";
import prisma from "@lib/prisma";
import { Category, Prisma } from "@prisma/client";
import {
    parseJsonBody,
    apiError,
    checkRateLimit,
    getRateLimitId,
    RATE_LIMITS,
    LIMITS,
    clampString,
    clampMetadata,
} from "@/lib/api-utils";

// Helper to validate and parse date
function parseDate(dateStr: string | null | undefined): Date | null {
    if (!dateStr) return null;
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? null : d;
}

// Helper to normalize enum values (case-insensitive)
function normalizeEnum<T>(val: string | null | undefined, enumObj: any): T | null {
    if (!val) return null;
    const normalized = val.trim().toUpperCase();
    if (Object.values(enumObj).includes(normalized)) {
        return normalized as T;
    }
    return null;
}

export async function POST(req: Request) {
    try {
        const session = await auth() as Session | null;

        if (!session?.user?.id) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const userId = session.user.id;

        const limited = checkRateLimit(getRateLimitId(req, userId), RATE_LIMITS.import);
        if (limited) return limited;

        const parsed = await parseJsonBody(req);
        if (!parsed.ok) return parsed.response;
        const body = parsed.data as { contacts?: unknown };

        const { contacts } = body;
        if (!Array.isArray(contacts)) {
            return NextResponse.json({ error: "Invalid input: contacts must be an array" }, { status: 400 });
        }

        const MAX_IMPORT_BATCH = 2000;
        if (contacts.length > MAX_IMPORT_BATCH) {
            return NextResponse.json(
                { error: `Too many contacts. Maximum ${MAX_IMPORT_BATCH} per import.` },
                { status: 400 }
            );
        }
        // We'll process sequentially or in parallel? Parallel for DB checks might be faster but need to handle race conditions if duplicates within CSV.
        // Given the constraints, let's process sequentially for simplicity and safety or use a map for in-memory dedup first.

        // 1. In-memory dedup of the incoming list itself (prefer first occurrence)
        const uniqueIncoming = new Map<string, any>();
        const skippedRows: any[] = [];
        let duplicateCount = 0;

        contacts.forEach((contact: any, index: number) => {
            // Basic validation already done on client, but good to be safe
            if (!contact.name) {
                skippedRows.push({ row: index + 1, name: "Unknown", reason: "Missing name" });
                return;
            }

            // Create a composite key for local dedup? Or just trust the user?
            // Let's use name+email as key to avoid duplicates within the upload file
            const key = `${contact.name}|${contact.email || ""}`;
            if (uniqueIncoming.has(key)) {
                skippedRows.push({ row: index + 1, name: contact.name, reason: "Duplicate in import file" });
                duplicateCount++;
            } else {
                uniqueIncoming.set(key, { ...contact, originalIndex: index });
            }
        });

        const importedContacts: any[] = [];
        const errors: string[] = [];

        // Fetch existing contacts for efficient logical dedup
        // Or just check one by one. For 1000 rows, fetching all might be better if user has small db, 
        // but if user has 10k contacts, fetching all is bad.
        // Let's do batch queries or sequential checks. Sequential is safer logic wise.

        for (const item of uniqueIncoming.values()) {
            const { category, lastInteractionAt, originalIndex } = item;
            const name = clampString(item.name, LIMITS.name);
            const email = clampString(item.email, LIMITS.email) ?? undefined;
            const phone = clampString(item.phone, LIMITS.phone) ?? undefined;
            const description = clampString(item.description, LIMITS.description) ?? undefined;
            const group = clampString(item.group, LIMITS.groupItem) ?? undefined;
            const metadata = clampMetadata(item.metadata);

            if (!name) {
                skippedRows.push({ row: originalIndex + 1, name: "Unknown", reason: "Missing or invalid name" });
                continue;
            }

            try {
                // Deduplication Logic
                // 1. Check email
                let existing = null;
                if (email) {
                    existing = await prisma.contact.findFirst({
                        where: {
                            ownerId: userId,
                            email: email,
                        },
                    });
                }

                // 2. Check name if no email match
                if (!existing) {
                    existing = await prisma.contact.findFirst({
                        where: {
                            ownerId: userId,
                            name: name,
                        },
                    });
                }

                if (existing) {
                    skippedRows.push({ row: originalIndex + 1, name: name, reason: "Duplicate found in database" });
                    duplicateCount++;
                    continue;
                }

                // Parse groups (cap length per item and total)
                const rawGroups = group
                    ? String(group).split(',').map(g => g.trim()).filter(g => g)
                    : [];
                const groups = rawGroups
                    .slice(0, LIMITS.groupsArrayLength)
                    .map(g => (g.length > LIMITS.groupItem ? g.slice(0, LIMITS.groupItem) : g));

                const newContact = await prisma.contact.create({
                    data: {
                        ownerId: userId!,
                        name,
                        email: email || null,
                        phone: phone || null,
                        description: description || null,
                        groups,
                        category: normalizeEnum<Category>(category, Category) || Category.FRIEND,
                        metadata: (metadata ?? undefined) as Prisma.InputJsonValue | undefined,
                        lastInteractionAt: parseDate(lastInteractionAt),
                    },
                });

                importedContacts.push(newContact);

            } catch (err) {
                console.error(`Error importing row ${originalIndex + 1}:`, err);
                errors.push(`Row ${originalIndex + 1}: ${(err as Error).message}`);
                skippedRows.push({ row: originalIndex + 1, name: name, reason: "Database error" });
            }
        }

        // Trigger bulk inference for all newly imported contacts
        if (importedContacts.length > 0) {
            const { updateInferredLinksBulk } = await import("@/lib/inference");
            await updateInferredLinksBulk(importedContacts.map(c => c.id));
        }

        return NextResponse.json({
            importedCount: importedContacts.length,
            skippedCount: skippedRows.length,
            duplicateCount,
            errors,
            skippedRows,
        });

    } catch (err) {
        console.error("Import failed:", err);
        return apiError(err);
    }
}
