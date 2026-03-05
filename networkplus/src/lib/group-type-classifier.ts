/**
 * Intelligent group-type classifier.
 *
 * Parses a group name for keywords and classifies it into a high-level type
 * (school, employment, social, family, community, other).
 */

export type GroupType = "school" | "employment" | "social" | "family" | "community" | "other";

export const GROUP_TYPE_LABELS: Record<GroupType, string> = {
    school: "School / Education",
    employment: "Employment",
    social: "Social",
    family: "Family",
    community: "Community / Org",
    other: "Other",
};

export const GROUP_TYPE_COLORS: Record<GroupType, string> = {
    school: "#6366f1",     // indigo
    employment: "#0ea5e9", // sky
    social: "#f59e0b",     // amber
    family: "#ef4444",     // red
    community: "#10b981",  // emerald
    other: "#71717a",      // zinc
};

// ── Keyword banks (all lowercase) ──────────────────────────────────────────

const SCHOOL_KEYWORDS = [
    "university", "college", "school", "academy", "institute",
    "education", "alumni", "class of", "graduating",
    "high school", "middle school", "elementary",
    "bachelor", "master", "phd", "mba",
    "campus", "faculty", "dean", "semester",
];

/** Year-suffix patterns like `'20`, `'21`, `Class of 2024` */
const SCHOOL_YEAR_REGEX = /(?:class\s*(?:of\s*)?|')\d{2,4}\b/i;

const EMPLOYMENT_KEYWORDS = [
    "inc", "corp", "corporation", "llc", "ltd", "limited",
    "company", "co.", "team", "department", "dept",
    "engineering", "startup", "consulting",
    "technologies", "solutions", "labs", "studio",
    "ventures", "partners", "associates", "enterprises",
    "industries", "services", "agency", "firm",
    "workplace", "office", "employer", "job",
    "intern", "internship",
];

const SOCIAL_KEYWORDS = [
    "club", "meetup", "discord", "hangout", "squad", "crew",
    "friends", "buddy", "buddies", "gaming", "sports",
    "hobby", "hobbies", "league", "party",
    "book club", "workout", "gym",
];

const FAMILY_KEYWORDS = [
    "family", "relatives", "cousins", "siblings",
    "in-laws", "inlaws",
];

const COMMUNITY_KEYWORDS = [
    "church", "mosque", "temple", "synagogue", "chapel",
    "volunteer", "nonprofit", "non-profit",
    "organization", "organisation", "association",
    "charity", "foundation", "society",
    "rotary", "lions club", "habitat",
    "neighborhood", "neighbourhood", "community",
];

// ── Classifier ─────────────────────────────────────────────────────────────

function matchesAny(lower: string, keywords: string[]): boolean {
    return keywords.some((kw) => lower.includes(kw));
}

/**
 * Classify a group name into a GroupType.
 *
 * Uses keyword matching (case-insensitive) with priority ordering:
 *   family → school → employment → community → social → other
 */
export function classifyGroupType(name: string): GroupType {
    if (!name || name.trim().length === 0) return "other";

    const lower = name.toLowerCase().trim();

    // Family is narrow and high-confidence → check first
    if (matchesAny(lower, FAMILY_KEYWORDS)) return "family";

    // School — also check year-suffix patterns
    if (matchesAny(lower, SCHOOL_KEYWORDS) || SCHOOL_YEAR_REGEX.test(lower)) return "school";

    // Employment
    if (matchesAny(lower, EMPLOYMENT_KEYWORDS)) return "employment";

    // Community / Org
    if (matchesAny(lower, COMMUNITY_KEYWORDS)) return "community";

    // Social
    if (matchesAny(lower, SOCIAL_KEYWORDS)) return "social";

    return "other";
}

/**
 * Classify every group in a list and return a map of groupName → GroupType.
 */
export function classifyGroups(groups: string[]): Map<string, GroupType> {
    const map = new Map<string, GroupType>();
    for (const g of groups) {
        map.set(g, classifyGroupType(g));
    }
    return map;
}

/**
 * Group a list of group names by their classified type.
 * Returns a map of GroupType → group names[].
 */
export function groupsByType(groups: string[]): Map<GroupType, string[]> {
    const map = new Map<GroupType, string[]>();
    for (const g of groups) {
        const t = classifyGroupType(g);
        if (!map.has(t)) map.set(t, []);
        map.get(t)!.push(g);
    }
    return map;
}
