/**
 * Detects whether a full contact display name appears as its own phrase in free text,
 * avoiding false positives like matching "Sam" inside "Samsung" or "Chris" inside "Christmas".
 */
export function textMentionsDistinctName(
    haystack: string,
    normalizedFullName: string
): boolean {
    const n = normalizedFullName.trim().toLowerCase();
    if (n.length < 2) return false;
    const h = haystack.toLowerCase();
    let from = 0;
    while (from <= h.length - n.length) {
        const idx = h.indexOf(n, from);
        if (idx === -1) return false;
        const before = idx > 0 ? h[idx - 1]! : " ";
        const afterIdx = idx + n.length;
        const after = afterIdx < h.length ? h[afterIdx]! : " ";
        const isWordChar = (c: string) => /[a-z0-9\u00C0-\u024F]/i.test(c);
        if (!isWordChar(before) && !isWordChar(after)) return true;
        from = idx + 1;
    }
    return false;
}
