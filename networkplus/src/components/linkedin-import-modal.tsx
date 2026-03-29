"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
    Upload,
    FileUp,
    AlertCircle,
    CheckCircle,
    Loader2,
    XCircle,
    MessageSquare,
    UserCheck,
    UserX,
    Info,
} from "lucide-react";
import {
    parseLinkedInMessages,
    type LinkedInConversation,
    type SkippedConversation,
} from "@/lib/linkedin-message-parser";
import { MAX_UPLOAD_FILE_BYTES } from "@/lib/api-utils";

type MatchedConversation = LinkedInConversation & {
    matched: boolean;
    contactId?: string;
    possibleDuplicate: boolean;
    selected: boolean;
};

type ImportSummary = {
    imported: number;
    skipped: number;
};

export function LinkedInImportModal({
    onSuccess,
}: {
    onSuccess: () => void;
}) {
    const { data: session } = useSession();
    const userName = session?.user?.name || "";
    const [open, setOpen] = useState(false);
    const [step, setStep] = useState<
        "IDLE" | "PARSING" | "PREVIEW" | "UPLOADING" | "SUCCESS"
    >("IDLE");
    const [conversations, setConversations] = useState<MatchedConversation[]>(
        []
    );
    const [skippedConversations, setSkippedConversations] = useState<
        SkippedConversation[]
    >([]);
    const [uploadError, setUploadError] = useState<string | null>(null);
    const [summary, setSummary] = useState<ImportSummary | null>(null);
    const [serverSkipped, setServerSkipped] = useState<
        { name: string; reason: string }[]
    >([]);

    const handleFileChange = async (
        e: React.ChangeEvent<HTMLInputElement>
    ) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setUploadError(null);

        if (file.size > MAX_UPLOAD_FILE_BYTES) {
            setUploadError(`File size exceeds ${MAX_UPLOAD_FILE_BYTES / (1024 * 1024)}MB limit.`);
            return;
        }

        if (!file.name.toLowerCase().endsWith(".csv")) {
            setUploadError("Please upload a .csv file.");
            return;
        }

        setStep("PARSING");

        try {
            const text = await file.text();
            const result = parseLinkedInMessages(text, userName);

            if (
                result.conversations.length === 0 &&
                result.skipped.length === 0
            ) {
                setUploadError(
                    "No conversations found in the file. Make sure this is a LinkedIn messages.csv export."
                );
                setStep("IDLE");
                return;
            }

            setSkippedConversations(result.skipped);

            // Match conversations to existing contacts
            const contactsRes = await fetch("/api/contacts?includeLinkedIn=true");
            if (!contactsRes.ok) throw new Error("Failed to fetch contacts");
            const contacts: { id: string; name: string; interactions?: { date: string; platform: string }[] }[] =
                await contactsRes.json();

            // Case-insensitive full-name lookup; duplicate display names → no auto-match (avoid wrong person)
            const nameBuckets = new Map<
                string,
                { id: string; name: string; interactions?: { date: string; platform: string }[] }[]
            >();
            for (const c of contacts) {
                const k = c.name.trim().toLowerCase();
                if (!nameBuckets.has(k)) nameBuckets.set(k, []);
                nameBuckets.get(k)!.push(c);
            }

            const matched: MatchedConversation[] = result.conversations.map(
                (conv) => {
                    const bucket = nameBuckets.get(conv.contactName.trim().toLowerCase());
                    const contact = bucket?.length === 1 ? bucket[0] : undefined;
                    let possibleDuplicate = false;

                    if (contact?.interactions) {
                        // Check for existing LinkedIn interactions on the same date
                        const convDate = new Date(conv.latestDate)
                            .toISOString()
                            .slice(0, 10);
                        possibleDuplicate = contact.interactions.some(
                            (i) =>
                                i.platform === "LINKEDIN" &&
                                new Date(i.date)
                                    .toISOString()
                                    .slice(0, 10) === convDate
                        );
                    }

                    return {
                        ...conv,
                        matched: !!contact,
                        contactId: contact?.id,
                        possibleDuplicate,
                        selected: !!contact && !possibleDuplicate, // auto-select matched non-duplicates
                    };
                }
            );

            setConversations(matched);
            setStep("PREVIEW");
        } catch (err: any) {
            console.error("Parse error:", err);
            setUploadError(err.message || "Failed to parse file.");
            setStep("IDLE");
        }
    };

    const toggleConversation = (convId: string) => {
        setConversations((prev) =>
            prev.map((c) =>
                c.conversationId === convId && c.matched
                    ? { ...c, selected: !c.selected }
                    : c
            )
        );
    };

    const selectAll = () => {
        setConversations((prev) =>
            prev.map((c) => (c.matched ? { ...c, selected: true } : c))
        );
    };

    const deselectAll = () => {
        setConversations((prev) =>
            prev.map((c) => ({ ...c, selected: false }))
        );
    };

    const handleImport = async () => {
        const selected = conversations.filter((c) => c.selected && c.matched);
        if (selected.length === 0) return;

        setStep("UPLOADING");
        try {
            const res = await fetch("/api/interactions/import", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    conversations: selected.map((c) => ({
                        contactName: c.contactName,
                        messageCount: c.messageCount,
                        latestDate: c.latestDate,
                        contentPreview: c.contentPreview,
                    })),
                }),
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.error || "Import failed");
            }

            setSummary({
                imported: data.importedCount,
                skipped:
                    data.skippedCount +
                    conversations.filter((c) => !c.selected || !c.matched)
                        .length,
            });

            if (data.skippedRows) {
                setServerSkipped(data.skippedRows);
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
            setConversations([]);
            setSkippedConversations([]);
            setUploadError(null);
            setSummary(null);
            setServerSkipped([]);
        }, 300);
    };

    const matchedCount = conversations.filter((c) => c.matched).length;
    const unmatchedCount = conversations.filter((c) => !c.matched).length;
    const selectedCount = conversations.filter(
        (c) => c.selected && c.matched
    ).length;
    const duplicateCount = conversations.filter(
        (c) => c.possibleDuplicate
    ).length;

    return (
        <Dialog
            open={open}
            onOpenChange={(val) => {
                if (!val) reset();
                else setOpen(true);
            }}
        >
            <Button
                variant="outline"
                className="w-full justify-start gap-2"
                onClick={() => setOpen(true)}
            >
                <MessageSquare className="size-4" />
                Import Messages
            </Button>
            <DialogContent className="sm:max-w-[650px] max-h-[85vh] overflow-y-auto flex flex-col border border-border dark:border-border/30">
                <DialogHeader>
                    <DialogTitle>Import LinkedIn Messages</DialogTitle>
                    <DialogDescription>
                        Upload your LinkedIn <code>messages.csv</code> export to
                        import past conversations as interactions.
                    </DialogDescription>
                </DialogHeader>

                <div className="py-4 space-y-4 flex-1 overflow-y-auto min-h-0">
                    {/* IDLE - File Upload */}
                    {step === "IDLE" && (
                        <div className="border-2 border-dashed rounded-xl p-10 flex flex-col items-center justify-center text-muted-foreground hover:bg-muted/50 transition-colors relative cursor-pointer">
                            <input
                                type="file"
                                accept=".csv"
                                className="absolute inset-0 opacity-0 cursor-pointer"
                                onChange={handleFileChange}
                            />
                            <FileUp className="size-10 mb-3" />
                            <p className="text-sm font-medium">
                                Click to upload messages.csv
                            </p>
                            <p className="text-xs">
                                From LinkedIn Data Export (Settings → Get a copy
                                of your data)
                            </p>
                        </div>
                    )}

                    {/* PARSING */}
                    {step === "PARSING" && (
                        <div className="flex flex-col items-center justify-center py-10 gap-3">
                            <Loader2 className="size-8 animate-spin text-muted-foreground" />
                            <p className="text-sm text-muted-foreground">
                                Parsing conversations...
                            </p>
                        </div>
                    )}

                    {/* PREVIEW */}
                    {(step === "PREVIEW" || step === "UPLOADING") && (
                        <div className="space-y-4">
                            {/* Stats bar */}
                            <div className="flex items-center gap-4 text-sm flex-wrap">
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wide bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                                    <MessageSquare className="size-3" />
                                    LinkedIn
                                </span>
                                <div className="flex items-center gap-1.5 text-green-600">
                                    <UserCheck className="size-4" />
                                    <span className="font-semibold">
                                        {matchedCount}
                                    </span>{" "}
                                    matched
                                </div>
                                <div className="flex items-center gap-1.5 text-amber-600">
                                    <UserX className="size-4" />
                                    <span className="font-semibold">
                                        {unmatchedCount}
                                    </span>{" "}
                                    unmatched
                                </div>
                                {duplicateCount > 0 && (
                                    <div className="flex items-center gap-1.5 text-orange-500">
                                        <Info className="size-4" />
                                        <span className="font-semibold">
                                            {duplicateCount}
                                        </span>{" "}
                                        possible dupe
                                        {duplicateCount !== 1 ? "s" : ""}
                                    </div>
                                )}
                            </div>

                            {/* Select all / none */}
                            <div className="flex gap-2 text-xs">
                                <button
                                    onClick={selectAll}
                                    className="text-blue-600 hover:underline"
                                >
                                    Select all matched
                                </button>
                                <span className="text-muted-foreground">·</span>
                                <button
                                    onClick={deselectAll}
                                    className="text-blue-600 hover:underline"
                                >
                                    Deselect all
                                </button>
                            </div>

                            {/* Conversation list */}
                            <div className="border rounded-md overflow-hidden max-h-[340px] overflow-y-auto">
                                <table className="w-full text-xs text-left">
                                    <thead className="bg-muted text-muted-foreground font-medium sticky top-0">
                                        <tr>
                                            <th className="p-2 w-8"></th>
                                            <th className="p-2">Contact</th>
                                            <th className="p-2">Messages</th>
                                            <th className="p-2">Date</th>
                                            <th className="p-2">Status</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y">
                                        {conversations.map((c) => (
                                            <tr
                                                key={c.conversationId}
                                                className={`${!c.matched
                                                    ? "opacity-50"
                                                    : ""
                                                    } ${c.possibleDuplicate
                                                        ? "bg-orange-50 dark:bg-orange-900/10"
                                                        : ""
                                                    }`}
                                            >
                                                <td className="p-2">
                                                    <input
                                                        type="checkbox"
                                                        checked={c.selected}
                                                        disabled={!c.matched}
                                                        onChange={() =>
                                                            toggleConversation(
                                                                c.conversationId
                                                            )
                                                        }
                                                        className="rounded"
                                                    />
                                                </td>
                                                <td className="p-2 font-medium">
                                                    {c.contactName}
                                                </td>
                                                <td className="p-2 text-muted-foreground">
                                                    {c.messageCount}
                                                </td>
                                                <td className="p-2 text-muted-foreground">
                                                    {new Date(
                                                        c.latestDate
                                                    ).toLocaleDateString()}
                                                </td>
                                                <td className="p-2">
                                                    {c.matched ? (
                                                        c.possibleDuplicate ? (
                                                            <span className="text-orange-500 flex items-center gap-1">
                                                                <Info className="size-3" />
                                                                Possible dupe
                                                            </span>
                                                        ) : (
                                                            <span className="text-green-600 flex items-center gap-1">
                                                                <CheckCircle className="size-3" />
                                                                Matched
                                                            </span>
                                                        )
                                                    ) : (
                                                        <span className="text-amber-600 flex items-center gap-1">
                                                            <UserX className="size-3" />
                                                            No match
                                                        </span>
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            {/* Possible duplicates info */}
                            {duplicateCount > 0 && (
                                <div className="rounded-md border border-orange-200 bg-orange-50 dark:bg-orange-900/10 p-3 flex items-start gap-2">
                                    <Info className="size-4 text-orange-500 mt-0.5 shrink-0" />
                                    <p className="text-xs text-orange-700 dark:text-orange-400">
                                        <span className="font-semibold">
                                            {duplicateCount} possible duplicate
                                            {duplicateCount !== 1
                                                ? "s"
                                                : ""}{" "}
                                            detected.
                                        </span>{" "}
                                        These conversations share the same
                                        contact and date as an existing LinkedIn
                                        interaction. They are unchecked by
                                        default — check them if you still want
                                        to import.
                                    </p>
                                </div>
                            )}

                            {/* Skipped sponsored messages */}
                            {skippedConversations.length > 0 && (
                                <div className="rounded-md border border-amber-200 bg-amber-50 dark:bg-amber-900/10 p-3">
                                    <p className="text-xs font-semibold text-amber-800 dark:text-amber-400 mb-2">
                                        Filtered out (
                                        {skippedConversations.length}):
                                    </p>
                                    <ul className="space-y-1 max-h-24 overflow-y-auto">
                                        {skippedConversations.map((s, i) => (
                                            <li
                                                key={i}
                                                className="text-xs text-amber-700 dark:text-amber-500 flex gap-2"
                                            >
                                                <span>{s.reason}</span>
                                                <span className="font-medium">
                                                    ({s.title})
                                                </span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}

                            {/* Unmatched info */}
                            {unmatchedCount > 0 && (
                                <p className="text-xs text-muted-foreground">
                                    💡{" "}
                                    <span className="font-medium">
                                        {unmatchedCount} conversation
                                        {unmatchedCount !== 1 ? "s" : ""}
                                    </span>{" "}
                                    couldn&apos;t be matched to existing
                                    contacts. Create the contacts first, then
                                    re-import.
                                </p>
                            )}
                        </div>
                    )}

                    {/* SUCCESS */}
                    {step === "SUCCESS" && summary && (
                        <div className="flex flex-col items-center justify-center py-6 text-center space-y-2">
                            <div className="size-12 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mb-2">
                                <CheckCircle className="size-6 text-green-600 dark:text-green-400" />
                            </div>
                            <h3 className="text-lg font-semibold">
                                Import Complete
                            </h3>
                            <p className="text-sm text-muted-foreground">
                                Successfully imported{" "}
                                <span className="text-foreground font-medium">
                                    {summary.imported}
                                </span>{" "}
                                interaction
                                {summary.imported !== 1 ? "s" : ""}.
                            </p>
                            {serverSkipped.length > 0 && (
                                <div className="rounded-md border border-amber-200 bg-amber-50 dark:bg-amber-900/10 p-3 mt-4 w-full text-left">
                                    <p className="text-xs font-semibold text-amber-800 dark:text-amber-400 mb-2">
                                        Skipped during import:
                                    </p>
                                    <ul className="space-y-1 max-h-32 overflow-y-auto">
                                        {serverSkipped.map((s, i) => (
                                            <li
                                                key={i}
                                                className="text-xs text-amber-700 dark:text-amber-500 flex gap-2"
                                            >
                                                <span>{s.reason}</span>
                                                <span className="font-medium">
                                                    ({s.name})
                                                </span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Error */}
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
                        <Button
                            variant="ghost"
                            onClick={() => {
                                setStep("IDLE");
                                setConversations([]);
                                setSkippedConversations([]);
                                setUploadError(null);
                            }}
                        >
                            Cancel
                        </Button>
                    )}

                    {(step === "PREVIEW" || step === "UPLOADING") && (
                        <Button
                            onClick={handleImport}
                            disabled={
                                step === "UPLOADING" || selectedCount === 0
                            }
                        >
                            {step === "UPLOADING" ? (
                                <>
                                    <Loader2 className="mr-2 size-4 animate-spin" />
                                    Importing...
                                </>
                            ) : (
                                `Import ${selectedCount} Interaction${selectedCount !== 1 ? "s" : ""}`
                            )}
                        </Button>
                    )}

                    {step === "SUCCESS" && (
                        <Button
                            onClick={reset}
                            className="w-full sm:w-auto"
                        >
                            Done
                        </Button>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
