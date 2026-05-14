import { CommunicationTone } from "@prisma/client"

const FORMAL_INDUSTRIES = new Set([
  "Legal",
  "Finance",
  "Government",
])

const RELAXED_INDUSTRIES = new Set(["Arts & Entertainment", "Retail"])

export const TONE_OPTIONS: {
  value: CommunicationTone
  label: string
  description: string
}[] = [
  { value: CommunicationTone.WARM, label: "Warm", description: "Friendly and personable" },
  {
    value: CommunicationTone.PROFESSIONAL,
    label: "Professional",
    description: "Polished and business-appropriate",
  },
  { value: CommunicationTone.CONCISE, label: "Concise", description: "Brief and direct" },
  { value: CommunicationTone.FRIENDLY, label: "Friendly", description: "Casual and approachable" },
]

export function getDefaultTone(
  useCase: string | null | undefined,
  industryField: string | null | undefined,
  primaryGoal: string | null | undefined
): CommunicationTone {
  const industry = (industryField || "").trim()
  const uc = (useCase || "").trim().toLowerCase()
  const goal = (primaryGoal || "").trim()

  if (industry && FORMAL_INDUSTRIES.has(industry)) {
    return CommunicationTone.PROFESSIONAL
  }

  if (
    industry &&
    RELAXED_INDUSTRIES.has(industry) &&
    (uc === "personal" || goal === "Maintaining connections")
  ) {
    return CommunicationTone.WARM
  }

  if (uc === "professional") return CommunicationTone.PROFESSIONAL
  if (uc === "personal") return CommunicationTone.WARM
  if (uc === "both") return CommunicationTone.FRIENDLY

  return CommunicationTone.FRIENDLY
}

export function toneToPromptInstruction(tone: CommunicationTone | null | undefined): string {
  switch (tone) {
    case CommunicationTone.PROFESSIONAL:
      return "Use a polished, business-appropriate tone. Avoid slang; be respectful and clear."
    case CommunicationTone.WARM:
      return "Use a warm, personable tone—genuine and caring without being overly casual."
    case CommunicationTone.CONCISE:
      return "Be brief and direct. Favor short sentences; avoid filler and pleasantries beyond a single line."
    case CommunicationTone.FRIENDLY:
      return "Use a friendly, approachable tone—conversational and upbeat but still respectful."
    default:
      return "Use a balanced, friendly-professional tone."
  }
}
