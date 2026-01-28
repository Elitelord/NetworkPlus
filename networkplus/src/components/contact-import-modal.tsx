"use client";

import { useState } from "react";
import Papa from "papaparse";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
    DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Upload, FileUp, AlertCircle, CheckCircle, Loader2, XCircle } from "lucide-react";

type ParseResult = {
    name: string;
    email?: string;
    phone?: string;
    description?: string;
    group?: string;
    category?: string;
    metadata?: any;
    lastInteractionAt?: string;
};

type SkippedRow = {
    row: number;
    name: string;
    reason: string;
};

export function ContactImportModal({ onSuccess }: { onSuccess: () => void }) {
    const [open, setOpen] = useState(false);
    const [step, setStep] = useState<"IDLE" | "PREVIEW" | "UPLOADING" | "SUCCESS">("IDLE");
    const [parsedContacts, setParsedContacts] = useState<ParseResult[]>([]);
    const [skippedRows, setSkippedRows] = useState<SkippedRow[]>([]);
    const [uploadError, setUploadError] = useState<string | null>(null);
    const [summary, setSummary] = useState<{ imported: number; skipped: number } | null>(null);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (file.size > 2 * 1024 * 1024) {
            setUploadError("File size exceeds 2MB limit.");
            return;
        }

        setUploadError(null);
        setStep("IDLE"); // Reset step just in case mainly to show loading state if we want, but synchronous parse is fast

        Papa.parse(file, {
            header: true,
            skipEmptyLines: true,
            complete: (results) => {
                const valid: ParseResult[] = [];
                const skipped: SkippedRow[] = [];

                results.data.forEach((row: any, index) => {
                    // Row index in CSV usually starts at 1, header is 1, so data starts at 2.
                    // index here is 0-based from data array. So row number is index + 2.
                    const rowNum = index + 2;

                    if (!row.name || !row.name.trim()) {
                        skipped.push({ row: rowNum, name: "Unknown", reason: "Missing required field: name" });
                        return;
                    }

                    valid.push({
                        name: row.name,
                        email: row.email,
                        phone: row.phone,
                        description: row.description,
                        group: row.group,
                        category: row.category,
                        metadata: row.metadata ? JSON.parse(JSON.stringify(row.metadata)) : undefined, // basic check
                        lastInteractionAt: row.lastInteractionAt,
                    });
                });

                if (valid.length > 1000) {
                    setUploadError("Row limit exceeded. Max 1000 contacts allowed.");
                    return;
                }

                setParsedContacts(valid);
                setSkippedRows(skipped);
                setStep("PREVIEW");
            },
            error: (err) => {
                console.error("CSV Parse Error:", err);
                setUploadError("Failed to parse CSV file.");
            },
        });
    };

    const handleImport = async () => {
        setStep("UPLOADING");
        try {
            const res = await fetch("/api/contacts/import", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ contacts: parsedContacts }),
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.error || "Import failed");
            }

            setSummary({ imported: data.importedCount, skipped: data.skippedCount + skippedRows.length });

            // Merge backend skipped rows with frontend skipped rows
            if (data.skippedRows) {
                setSkippedRows(prev => [...prev, ...data.skippedRows]);
            }

            setStep("SUCCESS");
            onSuccess();
        } catch (err: any) {
            setUploadError(err.message);
            setStep("PREVIEW"); // Go back to preview to retry or Cancel
        }
    };

    const reset = () => {
        setOpen(false);
        setTimeout(() => {
            setStep("IDLE");
            setParsedContacts([]);
            setSkippedRows([]);
            setUploadError(null);
            setSummary(null);
        }, 300);
    };

    return (
        <Dialog open={open} onOpenChange={(val) => {
            if (!val) reset();
            else setOpen(true);
        }}>
            <DialogTrigger asChild>
                <Button variant="outline" className="w-full justify-start gap-2">
                    <Upload className="size-4" />
                    Import CSV
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[600px] max-h-[85vh] overflow-y-auto flex flex-col">
                <DialogHeader>
                    <DialogTitle>Import Contacts</DialogTitle>
                    <DialogDescription>
                        Upload a CSV file to bulk import contacts. Required column: <code>name</code>.
                    </DialogDescription>
                </DialogHeader>

                <div className="py-4 space-y-4 flex-1 overflow-y-auto min-h-0">
                    {step === "IDLE" && (
                        <div className="border-2 border-dashed rounded-xl p-10 flex flex-col items-center justify-center text-muted-foreground hover:bg-muted/50 transition-colors relative cursor-pointer">
                            <input
                                type="file"
                                accept=".csv"
                                className="absolute inset-0 opacity-0 cursor-pointer"
                                onChange={handleFileChange}
                            />
                            <FileUp className="size-10 mb-3" />
                            <p className="text-sm font-medium">Click to upload or drag and drop</p>
                            <p className="text-xs">CSV up to 2MB</p>
                        </div>
                    )}

                    {(step === "PREVIEW" || step === "UPLOADING") && (
                        <div className="space-y-4">
                            <div className="flex items-center gap-4 text-sm">
                                <div className="flex items-center gap-2 text-green-600">
                                    <CheckCircle className="size-4" />
                                    <span className="font-semibold">{parsedContacts.length}</span> valid
                                </div>
                                <div className="flex items-center gap-2 text-amber-600">
                                    <AlertCircle className="size-4" />
                                    <span className="font-semibold">{skippedRows.length}</span> skipped
                                </div>
                            </div>

                            {/* Preview Table */}
                            <div className="border rounded-md overflow-hidden">
                                <table className="w-full text-xs text-left">
                                    <thead className="bg-muted text-muted-foreground font-medium">
                                        <tr>
                                            <th className="p-2">Name</th>
                                            <th className="p-2">Email</th>
                                            <th className="p-2">Group</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y">
                                        {parsedContacts.slice(0, 5).map((c, i) => (
                                            <tr key={i}>
                                                <td className="p-2 font-medium">{c.name}</td>
                                                <td className="p-2 text-muted-foreground">{c.email || "-"}</td>
                                                <td className="p-2 text-muted-foreground">{c.group || "-"}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                                {parsedContacts.length > 5 && (
                                    <div className="p-2 bg-muted/20 text-center text-xs text-muted-foreground">
                                        ...and {parsedContacts.length - 5} more
                                    </div>
                                )}
                            </div>

                            {skippedRows.length > 0 && (
                                <div className="rounded-md border border-amber-200 bg-amber-50 dark:bg-amber-900/10 p-3">
                                    <p className="text-xs font-semibold text-amber-800 dark:text-amber-400 mb-2">Skipped Rows:</p>
                                    <ul className="space-y-1 max-h-32 overflow-y-auto">
                                        {skippedRows.map((s, i) => (
                                            <li key={i} className="text-xs text-amber-700 dark:text-amber-500 flex gap-2">
                                                <span className="font-mono opacity-50">Row {s.row}</span>
                                                <span>{s.reason}</span>
                                                <span className="font-medium">({s.name})</span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                        </div>
                    )}

                    {step === "SUCCESS" && summary && (
                        <div className="flex flex-col items-center justify-center py-6 text-center space-y-2">
                            <div className="size-12 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mb-2">
                                <CheckCircle className="size-6 text-green-600 dark:text-green-400" />
                            </div>
                            <h3 className="text-lg font-semibold">Import Complete</h3>
                            <p className="text-sm text-muted-foreground">
                                Successfully imported <span className="text-foreground font-medium">{summary.imported}</span> contacts.
                            </p>
                            {summary.skipped > 0 && (
                                <p className="text-xs text-amber-600">
                                    {summary.skipped} rows were skipped (duplicates or invalid).
                                </p>
                            )}
                            {skippedRows.length > 0 && (
                                <div className="rounded-md border border-amber-200 bg-amber-50 dark:bg-amber-900/10 p-3 mt-4 w-full text-left">
                                    <p className="text-xs font-semibold text-amber-800 dark:text-amber-400 mb-2">Details:</p>
                                    <ul className="space-y-1 max-h-32 overflow-y-auto">
                                        {skippedRows.map((s, i) => (
                                            <li key={i} className="text-xs text-amber-700 dark:text-amber-500 flex gap-2">
                                                <span className="font-mono opacity-50">Row {s.row}</span>
                                                <span>{s.reason}</span>
                                                <span className="font-medium">({s.name})</span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                        </div>
                    )}

                    {uploadError && (
                        <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive flex items-center gap-2">
                            <XCircle className="size-4" />
                            {uploadError}
                        </div>
                    )}
                </div>

                <DialogFooter className="sm:justify-between items-center gap-2">
                    {step === "IDLE" && <div />}
                    {step !== "IDLE" && step !== "SUCCESS" && (
                        <Button variant="ghost" onClick={() => {
                            setStep("IDLE");
                            setParsedContacts([]);
                            setSkippedRows([]);
                        }}>
                            Cancel
                        </Button>
                    )}

                    {(step === "PREVIEW" || step === "UPLOADING") && (
                        <Button onClick={handleImport} disabled={step === "UPLOADING" || parsedContacts.length === 0}>
                            {step === "UPLOADING" ? (
                                <>
                                    <Loader2 className="mr-2 size-4 animate-spin" />
                                    Importing...
                                </>
                            ) : (
                                "Import Contacts"
                            )}
                        </Button>
                    )}

                    {step === "SUCCESS" && (
                        <Button onClick={reset} className="w-full sm:w-auto">
                            Done
                        </Button>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
