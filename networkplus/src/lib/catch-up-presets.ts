/**
 * UTC weekday indices matching cron + notification form (0 = Sunday … 6 = Saturday).
 */
export function getDefaultCatchUpDays(
  useCase: string | null | undefined,
  primaryGoal: string | null | undefined
): number[] {
  const uc = (useCase || "").trim().toLowerCase()
  const goal = (primaryGoal || "").trim()

  const isMaintaining = goal === "Maintaining connections"
  const isMarketing = goal === "Marketing to customers"
  const isRecruiting = goal === "Recruiting talent"
  const isHired = goal === "Getting hired"
  const isMeeting = goal === "Meeting people/networking"

  if (uc === "personal") {
    if (isMaintaining) return [1, 3, 5] // Mon, Wed, Fri
    return [2, 4] // Tue, Thu — Other / custom
  }

  if (uc === "professional") {
    if (isMarketing) return [1, 2, 3, 4, 5]
    if (isRecruiting || isHired) return [1, 3, 5]
    if (isMeeting) return [2, 4]
    // Custom / Other goal
    return [1, 3, 5]
  }

  if (uc === "both") {
    return [1, 3, 4] // Mon, Wed, Thu
  }

  return [1, 3, 5]
}
