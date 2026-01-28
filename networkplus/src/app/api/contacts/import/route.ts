import { NextResponse } from "next/server";
import { auth } from "@/auth";
import prisma from "@/lib/prisma";
import { Category, Platform } from "../../../../generated/prisma/client";

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
        const session = await auth();
        let userId = session?.user?.id;

        // Dev fallback
        if (!userId && process.env.NODE_ENV === "development") {
            const u = await prisma.user.findFirst();
            userId = u?.id;
        }

        if (!userId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const body = await req.json();
        const { contacts } = body;

        if (!Array.isArray(contacts)) {
            return NextResponse.json({ error: "Invalid input: contacts must be an array" }, { status: 400 });
        }

        // Limit batch size if needed, but for now 1000 is small enough to process
        // We'll process sequentially or in parallel? Parallel for DB checks might be faster but need to handle race conditions if duplicates within CSV.
        // Given the constraints, let's process sequentially for simplicity and safety or use a map for in-memory dedup first.

        // 1. In-memory dedup of the incoming list itself (prefer first occurrence)
        const uniqueIncoming = new Map<string, any>();
        const skippedRows: any[] = [];

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
            const { name, email, phone, description, group, category, metadata, lastInteractionAt, originalIndex } = item;

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
                    continue;
                }

                // Create
                const newContact = await prisma.contact.create({
                    data: {
                        ownerId: userId!,
                        name,
                        email: email || null,
                        phone: phone || null,
                        description: description || null,
                        group: group || null,
                        category: normalizeEnum<Category>(category, Category) || Category.FRIEND,
                        metadata: metadata || undefined,
                        lastInteractionAt: parseDate(lastInteractionAt),
                        // Default usage for other fields handled by schema
                    },
                });

                importedContacts.push(newContact);

            } catch (err) {
                console.error(`Error importing row ${originalIndex + 1}:`, err);
                errors.push(`Row ${originalIndex + 1}: ${(err as Error).message}`);
                skippedRows.push({ row: originalIndex + 1, name: name, reason: "Database error" });
            }
        }

        return NextResponse.json({
            importedCount: importedContacts.length,
            skippedCount: skippedRows.length,
            errors,
            skippedRows,
        });

    } catch (err) {
        console.error("Import failed:", err);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
