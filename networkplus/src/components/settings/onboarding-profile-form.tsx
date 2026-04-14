"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"
import { Check } from "lucide-react"

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
}

export function OnboardingProfileForm({ initialUseCase, initialIndustry, initialGoal }: OnboardingProfileProps) {
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
          primaryGoal: finalGoal
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
