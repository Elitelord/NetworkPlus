import type { Category } from "@prisma/client"
export type ContactForScore = {
  category: Category
  strengthScore: number
  lastInteractionAt: Date | null
  createdAt: Date
  description: string | null
  groups: string[]
  profile: unknown
}

export type UserForScore = {
  useCase: string | null
  industryField: string | null
  primaryGoal: string | null
}

function daysSince(date: Date | null): number {
  if (!date) return 400
  const ms = Date.now() - date.getTime()
  return Math.max(0, Math.floor(ms / (1000 * 60 * 60 * 24)))
}

function categoryBoost(
  category: Category,
  useCase: string | null,
  primaryGoal: string | null
): number {
  const uc = (useCase || "").trim().toLowerCase()
  const g = (primaryGoal || "").trim()

  let boost = 0
  if (uc === "professional") {
    if (
      g === "Marketing to customers" ||
      g === "Recruiting talent" ||
      g === "Getting hired"
    ) {
      if (category === "WORK") boost += 18
    } else if (g === "Meeting people/networking") {
      if (category === "WORK" || category === "MUTUAL") boost += 10
    } else {
      if (category === "WORK") boost += 8
    }
  } else if (uc === "personal") {
    if (g === "Maintaining connections" || !g) {
      if (category === "FRIEND" || category === "FAMILY") boost += 16
    } else {
      if (category === "FRIEND" || category === "FAMILY") boost += 10
    }
  } else if (uc === "both") {
    if (category === "WORK") boost += 10
    if (category === "FRIEND") boost += 10
  }

  return boost
}

function industryKeywordBoost(
  industryField: string | null,
  contact: ContactForScore
): number {
  if (!industryField) return 0
  const needle = industryField.trim().toLowerCase()
  if (needle.length < 2) return 0

  const hay = [
    contact.description || "",
    ...(contact.groups || []),
    typeof contact.profile === "object" && contact.profile !== null
      ? JSON.stringify(contact.profile)
      : "",
  ]
    .join(" ")
    .toLowerCase()

  return hay.includes(needle) ? 6 : 0
}

/**
 * Higher score = better candidate for today's recommendation.
 */
export function scoreContactForRecommendation(
  contact: ContactForScore,
  user: UserForScore
): number {
  const last = contact.lastInteractionAt
  const d = daysSince(last)

  const strengthComponent = (100 - Math.min(100, Math.max(0, contact.strengthScore))) * 0.45
  const recencyComponent = Math.min(d, 400) * 0.35
  const cat = categoryBoost(contact.category, user.useCase, user.primaryGoal)
  const ind = industryKeywordBoost(user.industryField, contact)

  return strengthComponent + recencyComponent + cat + ind
}
