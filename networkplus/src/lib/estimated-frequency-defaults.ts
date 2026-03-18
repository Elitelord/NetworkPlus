import { Platform } from "@prisma/client";
import { type GroupType, classifyGroupTypeWithOverrides } from "./group-type-classifier";

export type EstimatedFrequencyPreset = {
    count: number;
    cadence: "DAILY" | "WEEKLY" | "BIWEEKLY" | "MONTHLY";
    platform: Platform;
};

const GROUP_TYPE_FREQUENCY_DEFAULTS: Record<GroupType, EstimatedFrequencyPreset> = {
    employment: { count: 5, cadence: "WEEKLY", platform: Platform.IN_PERSON },
    school:     { count: 3, cadence: "WEEKLY", platform: Platform.IN_PERSON },
    family:     { count: 2, cadence: "WEEKLY", platform: Platform.CALL },
    social:     { count: 1, cadence: "WEEKLY", platform: Platform.OTHER },
    community:  { count: 2, cadence: "MONTHLY", platform: Platform.IN_PERSON },
    other:      { count: 1, cadence: "WEEKLY", platform: Platform.SMS },
};

const GROUP_TYPE_PRIORITY: GroupType[] = [
    "employment", "school", "family", "social", "community", "other",
];

/**
 * Returns the default frequency preset for a GroupType.
 */
export function getPresetForGroupType(type: GroupType): EstimatedFrequencyPreset {
    return GROUP_TYPE_FREQUENCY_DEFAULTS[type];
}

/**
 * Given a contact's groups, classify them and return the default estimated
 * frequency for the highest-priority group type found.
 *
 * Returns null only when groups is empty.
 */
export function getDefaultEstimatedFrequency(
    groups: string[],
    overrides?: Record<string, GroupType> | null,
): EstimatedFrequencyPreset | null {
    if (!groups || groups.length === 0) return null;

    let bestType: GroupType | null = null;
    let bestPriority = Infinity;

    for (const g of groups) {
        const type = classifyGroupTypeWithOverrides(g, overrides);
        const priority = GROUP_TYPE_PRIORITY.indexOf(type);
        if (priority < bestPriority) {
            bestPriority = priority;
            bestType = type;
        }
    }

    if (bestType === null) return null;
    return { ...GROUP_TYPE_FREQUENCY_DEFAULTS[bestType] };
}

/**
 * Cadence labels for display.
 */
export const CADENCE_OPTIONS = [
    { value: "DAILY", label: "Daily" },
    { value: "WEEKLY", label: "Weekly" },
    { value: "BIWEEKLY", label: "Biweekly" },
    { value: "MONTHLY", label: "Monthly" },
] as const;

/**
 * Format an estimated frequency as a human-readable string.
 * e.g. "~3x/week via WhatsApp"
 */
export function formatEstimatedFrequency(
    count: number,
    cadence: string,
    platform: string,
): string {
    const cadenceLabel: Record<string, string> = {
        DAILY: "day",
        WEEKLY: "week",
        BIWEEKLY: "2 weeks",
        MONTHLY: "month",
    };
    const platformLabel: Record<string, string> = {
        SMS: "SMS",
        CALL: "Call",
        EMAIL: "Email",
        INSTAGRAM: "Instagram",
        DISCORD: "Discord",
        WHATSAPP: "WhatsApp",
        FACEBOOK: "Facebook",
        LINKEDIN: "LinkedIn",
        SNAPCHAT: "Snapchat",
        TELEGRAM: "Telegram",
        IN_PERSON: "In Person",
        OTHER: "Other",
    };

    const cLabel = cadenceLabel[cadence] ?? cadence.toLowerCase();
    const pLabel = platformLabel[platform] ?? platform;
    return `~${count}x/${cLabel} via ${pLabel}`;
}
