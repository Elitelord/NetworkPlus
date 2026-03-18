/**
 * Intelligent group-type classifier.
 *
 * Parses a group name for keywords and classifies it into a high-level type
 * (school, employment, social, family, community, other).
 *
 * Supports per-user manual overrides via an optional overrides map.
 */

export type GroupType = "school" | "employment" | "social" | "family" | "community" | "other";

export const ALL_GROUP_TYPES: GroupType[] = ["school", "employment", "social", "family", "community", "other"];

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
    "fraternity", "sorority", "dorm", "dormitory",
    "classmates", "cohort", "graduate", "undergrad",
    "scholarship", "study group", "major", "minor",
    "honors", "valedictorian", "commencement",
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
    "coworker", "coworkers", "colleague", "colleagues",
    "client", "clients", "mentor", "mentee",
    "manager", "staff", "employee", "contractor",
    "freelance", "remote team", "project team",
    "corporate", "business", "work",
];

const SOCIAL_KEYWORDS = [
    "club", "meetup", "discord", "hangout", "squad", "crew",
    "friends", "buddy", "buddies", "gaming", "sports",
    "hobby", "hobbies", "league", "party",
    "book club", "workout", "gym",
    "hiking", "running", "cycling", "basketball",
    "soccer", "football", "tennis", "volleyball",
    "poker", "trivia", "board game", "video game",
    "band", "music", "concert", "travel",
    "roommate", "roommates", "housemates",
    "group chat", "online friends",
];

const FAMILY_KEYWORDS = [
    "family", "relatives", "cousins", "siblings",
    "in-laws", "inlaws",
    "parents", "grandparents", "uncle", "aunt",
    "nephew", "niece", "brother", "sister",
    "extended family", "immediate family",
];

const COMMUNITY_KEYWORDS = [
    "church", "mosque", "temple", "synagogue", "chapel",
    "volunteer", "nonprofit", "non-profit",
    "organization", "organisation", "association",
    "charity", "foundation", "society",
    "rotary", "lions club", "habitat",
    "neighborhood", "neighbourhood", "community",
    "congregation", "parish", "ministry",
    "civic", "council", "committee", "board",
    "outreach", "shelter", "food bank",
    "youth group", "scouts", "girl scouts", "boy scouts",
    "pta", "hoa", "homeowners",
];

// ── Classifier ─────────────────────────────────────────────────────────────

/**
 * Word-boundary aware keyword matching.
 * Short keywords (<=4 chars) like "work", "co.", "inc" use word-boundary
 * checks to avoid false positives inside longer words (e.g. "network", "workout").
 * Longer keywords use simple substring matching since they're unlikely to be substrings.
 */
function matchesAny(lower: string, keywords: string[]): boolean {
    return keywords.some((kw) => {
        const idx = lower.indexOf(kw);
        if (idx === -1) return false;

        if (kw.length <= 4) {
            const before = idx > 0 ? lower[idx - 1] : " ";
            const after = idx + kw.length < lower.length ? lower[idx + kw.length] : " ";
            const isWordBoundaryBefore = /[\s\-_.,;:!?()/]/.test(before) || idx === 0;
            const isWordBoundaryAfter = /[\s\-_.,;:!?()/]/.test(after) || (idx + kw.length) === lower.length;
            return isWordBoundaryBefore && isWordBoundaryAfter;
        }

        return true;
    });
}

/**
 * Classify a group name into a GroupType using keyword matching only.
 *
 * Priority: family → school → community → social → employment (fallback)
 *
 * Employment is the fallback for unrecognized names because most LinkedIn
 * imports produce bare company names (e.g. "Google", "Accenture") that
 * don't contain explicit keywords. Empty/blank names return "other".
 */
export function classifyGroupType(name: string): GroupType {
    if (!name || name.trim().length === 0) return "other";

    const lower = name.toLowerCase().trim();

    if (matchesAny(lower, FAMILY_KEYWORDS)) return "family";
    if (matchesAny(lower, SCHOOL_KEYWORDS) || SCHOOL_YEAR_REGEX.test(lower)) return "school";
    if (matchesAny(lower, EMPLOYMENT_KEYWORDS)) return "employment";
    if (matchesAny(lower, COMMUNITY_KEYWORDS)) return "community";
    if (matchesAny(lower, SOCIAL_KEYWORDS)) return "social";

    return "employment";
}

/**
 * Classify a group name, checking user overrides first.
 * If the user has manually assigned a type for this group name, that takes priority.
 */
export function classifyGroupTypeWithOverrides(
    name: string,
    overrides?: Record<string, GroupType> | null,
): GroupType {
    if (overrides && name in overrides) {
        return overrides[name];
    }
    return classifyGroupType(name);
}

/**
 * Classify every group in a list and return a map of groupName → GroupType.
 */
export function classifyGroups(
    groups: string[],
    overrides?: Record<string, GroupType> | null,
): Map<string, GroupType> {
    const map = new Map<string, GroupType>();
    for (const g of groups) {
        map.set(g, classifyGroupTypeWithOverrides(g, overrides));
    }
    return map;
}

/**
 * Group a list of group names by their classified type.
 * Returns a map of GroupType → group names[].
 */
export function groupsByType(
    groups: string[],
    overrides?: Record<string, GroupType> | null,
): Map<GroupType, string[]> {
    const map = new Map<GroupType, string[]>();
    for (const g of groups) {
        const t = classifyGroupTypeWithOverrides(g, overrides);
        if (!map.has(t)) map.set(t, []);
        map.get(t)!.push(g);
    }
    return map;
}

/**
 * Validates that a value is a valid GroupType string.
 */
export function isValidGroupType(value: string): value is GroupType {
    return ALL_GROUP_TYPES.includes(value as GroupType);
}
