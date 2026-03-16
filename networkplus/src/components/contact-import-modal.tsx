"use client";

import { useState } from "react";
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
import { Upload, FileUp, AlertCircle, CheckCircle, Loader2, XCircle, FileText, Contact } from "lucide-react";
import {
    parseFile,
    detectFileType,
    type NormalizedContact,
    type SkippedRow,
} from "@/lib/contact-parser";
import { MAX_UPLOAD_FILE_BYTES } from "@/lib/api-utils";

type ImportSummary = {
    imported: number;
    skipped: number;
    duplicates: number;
};

export function ContactImportModal({ onSuccess }: { onSuccess: () => void }) {
    const [open, setOpen] = useState(false);
    const [step, setStep] = useState<"IDLE" | "PREVIEW" | "UPLOADING" | "SUCCESS">("IDLE");
    const [parsedContacts, setParsedContacts] = useState<NormalizedContact[]>([]);
    const [skippedRows, setSkippedRows] = useState<SkippedRow[]>([]);
    const [uploadError, setUploadError] = useState<string | null>(null);
    const [summary, setSummary] = useState<ImportSummary | null>(null);
    const [fileType, setFileType] = useState<"csv" | "vcf" | null>(null);
    const [largeFileWarning, setLargeFileWarning] = useState(false);

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Reset state
        setUploadError(null);
        setLargeFileWarning(false);

        // Validate file size (max 20MB to avoid memory pressure)
        if (file.size > MAX_UPLOAD_FILE_BYTES) {
            setUploadError(`File size exceeds ${MAX_UPLOAD_FILE_BYTES / (1024 * 1024)}MB limit.`);
            return;
        }

        // Validate file type
        const detected = detectFileType(file);
        if (!detected) {
            setUploadError("Unsupported file type. Please upload a .csv or .vcf file.");
            return;
        }

        // Check for empty file
        if (file.size === 0) {
            setUploadError("File is empty.");
            return;
        }

        try {
            const result = await parseFile(file);

            if (result.valid.length === 0 && result.skipped.length === 0) {
                setUploadError("File appears to be empty or contains no parseable data.");
                return;
            }

            if (result.valid.length > 5000) {
                setLargeFileWarning(true);
            }

            if (result.valid.length > 10000) {
                setUploadError("Row limit exceeded. Max 10,000 contacts allowed per import.");
                return;
            }

            setFileType(result.fileType);
            setParsedContacts(result.valid);
            setSkippedRows(result.skipped);
            setStep("PREVIEW");
        } catch (err: any) {
            console.error("Parse error:", err);
            setUploadError(err.message || "Failed to parse file.");
        }
    };

    const loadDemoCsv = async () => {
        setUploadError(null);
        setLargeFileWarning(false);
        try {
            const res = await fetch("/demo-contacts.csv");
            if (!res.ok) throw new Error("Failed to load demo CSV");
            const text = await res.text();
            const file = new File([text], "demo-contacts.csv", { type: "text/csv" });
            
            const result = await parseFile(file);
            
            if (result.valid.length === 0 && result.skipped.length === 0) {
                setUploadError("Demo file appears to be empty.");
                return;
            }
            
            setFileType(result.fileType);
            setParsedContacts(result.valid);
            setSkippedRows(result.skipped);
            setStep("PREVIEW");
        } catch (err: any) {
            console.error("Demo load error:", err);
            setUploadError(err.message || "Failed to load demo file.");
        }
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

            setSummary({
                imported: data.importedCount,
                skipped: data.skippedCount + skippedRows.length,
                duplicates: data.duplicateCount || 0,
            });

            // Merge backend skipped rows with frontend skipped rows
            if (data.skippedRows) {
                setSkippedRows(prev => [...prev, ...data.skippedRows]);
            }

            setStep("SUCCESS");
            onSuccess();
        } catch (err: any) {
            setUploadError(err.message);
            setStep("PREVIEW");
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
            setFileType(null);
            setLargeFileWarning(false);
        }, 300);
    };

    const fileTypeBadge = fileType ? (
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wide ${fileType === "csv"
                ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                : "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400"
            }`}>
            {fileType === "csv" ? <FileText className="size-3" /> : <Contact className="size-3" />}
            {fileType}
        </span>
    ) : null;

    return (
        <Dialog open={open} onOpenChange={(val) => {
            if (!val) reset();
            else setOpen(true);
        }}>
            <DialogTrigger asChild>
                <Button variant="outline" className="w-full justify-start gap-2">
                    <Upload className="size-4" />
                    Import Contacts
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[600px] max-h-[85vh] overflow-y-auto flex flex-col border border-border dark:border-border/30">
                <DialogHeader>
                    <DialogTitle>Import Contacts</DialogTitle>
                    <DialogDescription>
                        Upload a CSV or VCF file to bulk import contacts. Names are derived automatically from common headers.
                    </DialogDescription>
                </DialogHeader>

                <div className="py-4 space-y-4 flex-1 overflow-y-auto min-h-0">
                    {step === "IDLE" && (
                        <div className="space-y-4">
                            <div className="border-2 border-dashed rounded-xl p-10 flex flex-col items-center justify-center text-muted-foreground hover:bg-muted/50 transition-colors relative cursor-pointer">
                                <input
                                    type="file"
                                    accept=".csv,.vcf,.vcard"
                                    className="absolute inset-0 opacity-0 cursor-pointer"
                                    onChange={handleFileChange}
                                />
                                <FileUp className="size-10 mb-3" />
                                <p className="text-sm font-medium">Click to upload or drag and drop</p>
                                <p className="text-xs">CSV or VCF up to 2MB</p>
                            </div>
                            <div className="flex flex-col items-center gap-3 pt-4 border-t">
                                <p className="text-sm text-muted-foreground font-medium">Don't have a file ready?</p>
                                <Button variant="outline" size="sm" onClick={loadDemoCsv} className="gap-2">
                                    <FileText className="size-4" />
                                    Load Demo CSV
                                </Button>
                                <p className="text-xs text-muted-foreground text-center max-w-[250px]">
                                    Try importing with a sample file containing 50 contacts, complete with groups and social links.
                                </p>
                            </div>
                        </div>
                    )}

                    {(step === "PREVIEW" || step === "UPLOADING") && (
                        <div className="space-y-4">
                            <div className="flex items-center gap-4 text-sm">
                                {fileTypeBadge}
                                <div className="flex items-center gap-2 text-green-600">
                                    <CheckCircle className="size-4" />
                                    <span className="font-semibold">{parsedContacts.length}</span> valid
                                </div>
                                <div className="flex items-center gap-2 text-amber-600">
                                    <AlertCircle className="size-4" />
                                    <span className="font-semibold">{skippedRows.length}</span> skipped
                                </div>
                            </div>

                            {/* Large file warning */}
                            {largeFileWarning && (
                                <div className="rounded-md border border-amber-200 bg-amber-50 dark:bg-amber-900/10 p-3 flex items-start gap-2">
                                    <AlertCircle className="size-4 text-amber-600 mt-0.5 shrink-0" />
                                    <p className="text-xs text-amber-700 dark:text-amber-400">
                                        <span className="font-semibold">Large file detected.</span> You are importing over 5,000 contacts. This may take a moment.
                                    </p>
                                </div>
                            )}

                            {/* Preview Table */}
                            <div className="border rounded-md overflow-hidden">
                                <table className="w-full text-xs text-left">
                                    <thead className="bg-muted text-muted-foreground font-medium">
                                        <tr>
                                            <th className="p-2">Name</th>
                                            <th className="p-2">Email</th>
                                            <th className="p-2">Phone</th>
                                            <th className="p-2">Group</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y">
                                        {parsedContacts.slice(0, 5).map((c, i) => (
                                            <tr key={i}>
                                                <td className="p-2 font-medium">{c.name}</td>
                                                <td className="p-2 text-muted-foreground">{c.email || "-"}</td>
                                                <td className="p-2 text-muted-foreground">{c.phone || "-"}</td>
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
                            {summary.duplicates > 0 && (
                                <p className="text-xs text-blue-600">
                                    {summary.duplicates} duplicate{summary.duplicates !== 1 ? "s" : ""} skipped.
                                </p>
                            )}
                            {summary.skipped > 0 && (
                                <p className="text-xs text-amber-600">
                                    {summary.skipped} row{summary.skipped !== 1 ? "s" : ""} skipped (invalid or missing name).
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
                            setLargeFileWarning(false);
                            setFileType(null);
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
                                `Import ${parsedContacts.length} Contact${parsedContacts.length !== 1 ? "s" : ""}`
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
