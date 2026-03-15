/**
 * Canonical list of interaction platforms. Must match Prisma Platform enum.
 * Used by LogInteractionModal and ReachOutModal for consistent options.
 */
export const INTERACTION_PLATFORMS = [
    { value: "SMS", label: "SMS / iMessage" },
    { value: "CALL", label: "Call" },
    { value: "EMAIL", label: "Email" },
    { value: "INSTAGRAM", label: "Instagram" },
    { value: "DISCORD", label: "Discord" },
    { value: "WHATSAPP", label: "WhatsApp" },
    { value: "FACEBOOK", label: "Facebook" },
    { value: "LINKEDIN", label: "LinkedIn" },
    { value: "SNAPCHAT", label: "Snapchat" },
    { value: "TELEGRAM", label: "Telegram" },
    { value: "IN_PERSON", label: "In Person" },
    { value: "OTHER", label: "Other" },
] as const;
