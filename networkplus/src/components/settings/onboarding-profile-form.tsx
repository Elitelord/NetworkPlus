"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"
import { Check } from "lucide-react"
import { getDefaultTone, TONE_OPTIONS } from "@/lib/tone-presets"
import type { CommunicationTone } from "@prisma/client"

const USE_CASE_OPTIONS = [
  { value: "personal", label: "Personal" },
  { value: "professional", label: "Professional" },
  { value: "both", label: "Both" },
]

const INDUSTRY_OPTIONS = [
  "Technology", "Finance", "Healthcare", "Real Estate", "Education",
  "Retail", "Manufacturing", "Arts & Entertainment", "Non-Profit",
  "Consulting", "Government", "Legal", "Media & Communications", "Other"
]

const GOAL_OPTIONS = [
  "Marketing to customers",
  "Recruiting talent",
  "Getting hired",
  "Meeting people/networking",
  "Maintaining connections",
  "Other"
]

interface OnboardingProfileProps {
  initialUseCase: string
  initialIndustry: string
  initialGoal: string
  initialCommunicationTone: CommunicationTone | null
}

export function OnboardingProfileForm({
  initialUseCase,
  initialIndustry,
  initialGoal,
  initialCommunicationTone,
}: OnboardingProfileProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [saved, setSaved] = useState(false)
  
  const isCustomIndustry = initialIndustry && !INDUSTRY_OPTIONS.includes(initialIndustry)
  const isCustomGoal = initialGoal && !GOAL_OPTIONS.includes(initialGoal)

  const [useCase, setUseCase] = useState(initialUseCase || "")
  const [industrySelect, setIndustrySelect] = useState(isCustomIndustry ? "Other" : (initialIndustry || ""))
  const [customIndustry, setCustomIndustry] = useState(isCustomIndustry ? initialIndustry : "")
  
  const [goalSelect, setGoalSelect] = useState(isCustomGoal ? "Other" : (initialGoal || ""))
  const [customGoal, setCustomGoal] = useState(isCustomGoal ? initialGoal : "")

  const resolvedIndustry =
    industrySelect === "Other" && customIndustry.trim() ? customIndustry : industrySelect
  const resolvedGoal = goalSelect === "Other" && customGoal.trim() ? customGoal : goalSelect

  const initialResolvedIndustryForTone =
    initialIndustry && !INDUSTRY_OPTIONS.includes(initialIndustry) ? initialIndustry : initialIndustry || ""

  const [tone, setTone] = useState<CommunicationTone>(() =>
    initialCommunicationTone ??
    getDefaultTone(initialUseCase || null, initialResolvedIndustryForTone || null, initialGoal || null)
  )

  const applySuggestedTone = () => {
    const t = getDefaultTone(useCase || null, resolvedIndustry || null, resolvedGoal || null)
    setTone(t)
    toast.message("Suggested tone applied", { description: "Save to keep this change." })
  }

  const handleSave = async () => {
    setLoading(true)
    const finalIndustry = industrySelect === "Other" && customIndustry.trim() ? customIndustry : industrySelect
    const finalGoal = goalSelect === "Other" && customGoal.trim() ? customGoal : goalSelect

    try {
      const res = await fetch("/api/user/onboarding", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          useCase,
          industryField: finalIndustry,
          primaryGoal: finalGoal,
          communicationTone: tone,
        }),
      })

      if (!res.ok) throw new Error("Failed to save changes")
      setSaved(true)
      toast.success("Onboarding profile updated", { description: "Your personalized settings have been saved." })
      router.refresh()
      
      setTimeout(() => setSaved(false), 3000)
    } catch (err) {
      console.error(err)
      toast.error("Error", { description: "Failed to update profile." })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="useCase">Primary Use Case</Label>
        <NativeSelect
            id="useCase"
            value={useCase}
            onChange={(e) => setUseCase(e.target.value)}
        >
            <NativeSelectOption value="">Select use case...</NativeSelectOption>
            {USE_CASE_OPTIONS.map(opt => (
                <NativeSelectOption key={opt.value} value={opt.value}>{opt.label}</NativeSelectOption>
            ))}
        </NativeSelect>
      </div>

      <div className="space-y-2">
        <Label htmlFor="industry">Industry Field</Label>
        <NativeSelect
            id="industry"
            value={industrySelect}
            onChange={(e) => setIndustrySelect(e.target.value)}
        >
            <NativeSelectOption value="">Select industry...</NativeSelectOption>
            {INDUSTRY_OPTIONS.map(opt => (
                <NativeSelectOption key={opt} value={opt}>{opt}</NativeSelectOption>
            ))}
        </NativeSelect>
        {industrySelect === "Other" && (
            <div className="mt-2 text-sm text-muted-foreground animate-in fade-in slide-in-from-top-1">
                <Input
                    placeholder="Enter your custom industry"
                    value={customIndustry}
                    onChange={(e) => setCustomIndustry(e.target.value)}
                />
            </div>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="goal">Primary Goal</Label>
        <NativeSelect
            id="goal"
            value={goalSelect}
            onChange={(e) => setGoalSelect(e.target.value)}
        >
            <NativeSelectOption value="">Select goal...</NativeSelectOption>
            {GOAL_OPTIONS.map(opt => (
                <NativeSelectOption key={opt} value={opt}>{opt}</NativeSelectOption>
            ))}
        </NativeSelect>
        {goalSelect === "Other" && (
            <div className="mt-2 text-sm text-muted-foreground animate-in fade-in slide-in-from-top-1">
                <Input
                    placeholder="Enter your custom goal"
                    value={customGoal}
                    onChange={(e) => setCustomGoal(e.target.value)}
                />
            </div>
        )}
      </div>

      <div className="space-y-2">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <Label htmlFor="tone">Messaging tone</Label>
          <Button type="button" variant="ghost" size="sm" className="h-8 text-xs shrink-0" onClick={applySuggestedTone}>
            Use suggested
          </Button>
        </div>
        <NativeSelect
          id="tone"
          value={tone}
          onChange={(e) => setTone(e.target.value as CommunicationTone)}
        >
          {TONE_OPTIONS.map((opt) => (
            <NativeSelectOption key={opt.value} value={opt.value}>
              {opt.label} — {opt.description}
            </NativeSelectOption>
          ))}
        </NativeSelect>
        <p className="text-xs text-muted-foreground">
          Used for AI-generated reach-outs, daily suggestions, and notification wording. We pick a default from your
          use case and industry; you can override anytime.
        </p>
      </div>

      <Button 
        onClick={handleSave} 
        disabled={loading || saved} 
        variant="outline" 
        className="w-full sm:w-auto"
      >
        {loading ? "Saving..." : saved ? (
          <span className="flex items-center text-green-600 dark:text-green-500">
            <Check className="w-4 h-4 mr-2" /> Saved
          </span>
        ) : "Save Preferences"}
      </Button>
    </div>
  )
}
