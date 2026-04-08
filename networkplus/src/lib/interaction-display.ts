/**
 * Primary line to show for an interaction (e.g. email subject from sync metadata).
 */
export function emailInteractionPreview(interaction: {
    content?: string | null;
    metadata?: unknown;
}): string | undefined {
    const c = interaction.content?.trim();
    if (c) return c;
    const m = interaction.metadata;
    if (m && typeof m === "object" && m !== null && "subject" in m) {
        const s = (m as { subject?: unknown }).subject;
        if (typeof s === "string" && s.trim()) return s.trim();
    }
    return undefined;
}
