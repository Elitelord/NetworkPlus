import { CommunicationTone } from "@prisma/client"

export type RecommendationForNotify = {
  dismissed: boolean
  reason: string
  contact: { name: string }
} | null

function truncate(s: string, max: number): string {
  if (s.length <= max) return s
  return s.slice(0, max - 1) + "…"
}

export function getCatchUpNotificationCopy(input: {
  useCase: string | null
  primaryGoal: string | null
  tone: CommunicationTone | null
  recommendation: RecommendationForNotify
  contactNames: string[]
}): { title: string; body: string } {
  const uc = (input.useCase || "").trim().toLowerCase()
  const tone = input.tone

  let title = "Daily catch-up"
  if (uc === "personal") title = "Time to reconnect"
  else if (uc === "professional") title = "Your network nudge"
  else if (uc === "both") title = "Catch up with your network"

  const reasonText = input.recommendation?.reason
    ? truncate(input.recommendation.reason, 180)
    : ""

  if (input.recommendation && !input.recommendation.dismissed && reasonText) {
    const name = input.recommendation.contact.name
    let body: string
    switch (tone) {
      case CommunicationTone.PROFESSIONAL:
        body = `Suggested: ${name} — ${reasonText}`
        break
      case CommunicationTone.CONCISE:
        body = `${name}: ${reasonText}`
        break
      case CommunicationTone.WARM:
        body = `Say hi to ${name}. ${reasonText}`
        break
      case CommunicationTone.FRIENDLY:
      default:
        body = `Don't forget ${name}! ${reasonText}`
        break
    }
    return { title, body: truncate(body, 380) }
  }

  const names = input.contactNames.slice(0, 3)
  const remaining = Math.max(0, input.contactNames.length - 3)
  const list = names.join(", ")
  let body: string
  if (remaining > 0) {
    body =
      tone === CommunicationTone.CONCISE
        ? `Due: ${list} +${remaining} more`
        : `Time to catch up with ${list} and ${remaining} others.`
  } else if (names.length > 0) {
    body =
      tone === CommunicationTone.WARM
        ? `Reconnect with ${list} when you can.`
        : `Time to catch up with ${list}.`
  } else {
    body = "You have contacts due for a catch-up."
  }

  return { title, body: truncate(body, 380) }
}
