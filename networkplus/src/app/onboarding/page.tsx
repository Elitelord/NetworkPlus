"use client"

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Briefcase, User, Users, Check, ArrowRight, ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";

const USE_CASE_OPTIONS = [
  { id: "personal", label: "Personal", description: "Keep track of friends and family", icon: User },
  { id: "professional", label: "Professional", description: "Manage clients and colleagues", icon: Briefcase },
  { id: "both", label: "Both", description: "A mix of both personal and professional", icon: Users },
];

const INDUSTRY_OPTIONS = [
  "Technology", "Finance", "Healthcare", "Real Estate", "Education",
  "Retail", "Manufacturing", "Arts & Entertainment", "Non-Profit",
  "Consulting", "Government", "Legal", "Media & Communications", "Other"
];

const GOAL_OPTIONS = [
  "Marketing to customers",
  "Recruiting talent",
  "Getting hired",
  "Meeting people/networking",
  "Maintaining connections",
  "Other"
];

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);

  // Form State
  const [useCase, setUseCase] = useState<string>("");
  const [industry, setIndustry] = useState<string>("");
  const [customIndustry, setCustomIndustry] = useState("");
  const [goal, setGoal] = useState<string>("");
  const [customGoal, setCustomGoal] = useState("");

  const handleNext = async () => {
    if (step < 3) {
      setStep((prev) => prev + 1);
    } else {
      // Submit
      setLoading(true);
      const finalIndustry = industry === "Other" && customIndustry.trim() ? customIndustry : industry;
      const finalGoal = goal === "Other" && customGoal.trim() ? customGoal : goal;

      try {
        await fetch("/api/user/onboarding", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            hasCompletedOnboarding: true,
            useCase,
            industryField: finalIndustry,
            primaryGoal: finalGoal
          }),
        });
        router.push("/dashboard");
      } catch (err) {
        console.error("Failed to update onboarding profile:", err);
      } finally {
        setLoading(false);
      }
    }
  };

  const handleBack = () => {
    if (step > 1) {
      setStep((prev) => prev - 1);
    }
  };

  const isStepValid = () => {
    if (step === 1) return useCase !== "";
    if (step === 2) return industry !== "" && (industry !== "Other" || customIndustry.trim() !== "");
    if (step === 3) return goal !== "" && (goal !== "Other" || customGoal.trim() !== "");
    return false;
  };

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-black text-foreground flex items-center justify-center p-4">
      <div className="w-full max-w-2xl bg-card border shadow-xl rounded-3xl p-8 md:p-12 transition-all duration-500 min-h-[500px] flex flex-col relative overflow-hidden">
        {/* Progress Bar */}
        <div className="w-full bg-muted h-1 rounded-full absolute top-0 left-0">
          <div
            className="bg-primary h-1 rounded-full transition-all duration-500"
            style={{ width: `${(step / 3) * 100}%` }}
          />
        </div>

        <div className="flex-1 flex flex-col">
          {step === 1 && (
            <div className="animate-in fade-in slide-in-from-right-4 duration-500 h-full flex flex-col">
              <h1 className="text-3xl font-bold tracking-tight mb-2">How will you use NetworkPlus?</h1>
              <p className="text-muted-foreground mb-8">We'll tailor your experience based on your needs.</p>

              <div className="grid gap-4 md:grid-cols-3">
                {USE_CASE_OPTIONS.map((opt) => (
                  <button
                    key={opt.id}
                    onClick={() => setUseCase(opt.id)}
                    className={cn(
                      "flex flex-col items-center text-center p-6 rounded-2xl border-2 transition-all duration-200",
                      useCase === opt.id
                        ? "border-primary bg-primary/5 shadow-md"
                        : "border-border hover:border-primary/40 hover:bg-muted/50"
                    )}
                  >
                    <opt.icon className={cn("w-10 h-10 mb-4", useCase === opt.id ? "text-primary" : "text-muted-foreground")} />
                    <span className="font-semibold mb-1">{opt.label}</span>
                    <span className="text-xs text-muted-foreground">{opt.description}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="animate-in fade-in slide-in-from-right-4 duration-500 h-full flex flex-col">
              <h1 className="text-3xl font-bold tracking-tight mb-2">What is your industry?</h1>
              <p className="text-muted-foreground mb-8">This helps us customize AI-generated check-ins and insights.</p>

              <div className="flex flex-wrap gap-3 mb-6">
                {INDUSTRY_OPTIONS.map((opt) => (
                  <button
                    key={opt}
                    onClick={() => {
                      setIndustry(opt);
                      if (opt !== "Other") setCustomIndustry("");
                    }}
                    className={cn(
                      "px-4 py-2 rounded-full border text-sm font-medium transition-all duration-200",
                      industry === opt
                        ? "border-primary bg-primary text-primary-foreground shadow-md"
                        : "border-border bg-background hover:border-primary/40 hover:bg-muted/50"
                    )}
                  >
                    {opt}
                  </button>
                ))}
              </div>

              {industry === "Other" && (
                <div className="animate-in fade-in slide-in-from-bottom-2 duration-300 mt-2">
                  <Input
                    placeholder="Enter your industry..."
                    value={customIndustry}
                    onChange={(e) => setCustomIndustry(e.target.value)}
                    className="max-w-md h-12 text-base rounded-xl"
                    autoFocus
                  />
                </div>
              )}
            </div>
          )}

          {step === 3 && (
            <div className="animate-in fade-in slide-in-from-right-4 duration-500 h-full flex flex-col">
              <h1 className="text-3xl font-bold tracking-tight mb-2">What's your primary goal?</h1>
              <p className="text-muted-foreground mb-8">NetworkPlus will adapt to help you achieve this.</p>

              <div className="flex flex-col gap-3 max-w-md">
                {GOAL_OPTIONS.map((opt) => (
                  <button
                    key={opt}
                    onClick={() => {
                      setGoal(opt);
                      if (opt !== "Other") setCustomGoal("");
                    }}
                    className={cn(
                      "flex items-center justify-between p-4 rounded-xl border-2 transition-all duration-200 text-left",
                      goal === opt
                        ? "border-primary bg-primary/5 shadow-sm"
                        : "border-border hover:border-primary/40 hover:bg-muted/50"
                    )}
                  >
                    <span className="font-medium text-sm md:text-base">{opt}</span>
                    {goal === opt && <Check className="w-5 h-5 text-primary" />}
                  </button>
                ))}
              </div>

              {goal === "Other" && (
                <div className="animate-in fade-in slide-in-from-bottom-2 duration-300 mt-4">
                  <Input
                    placeholder="Specify your goal..."
                    value={customGoal}
                    onChange={(e) => setCustomGoal(e.target.value)}
                    className="max-w-md h-12 text-base rounded-xl"
                    autoFocus
                  />
                </div>
              )}
            </div>
          )}
        </div>

        <div className="pt-8 flex items-center justify-between mt-auto">
          <Button
            variant="ghost"
            onClick={handleBack}
            className={cn("rounded-xl px-2", step === 1 ? "invisible" : "")}
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>

          <Button
            onClick={handleNext}
            disabled={!isStepValid() || loading}
            className="rounded-xl px-8"
          >
            {loading ? "Saving..." : step === 3 ? "Get Started" : "Continue"}
            {!loading && step < 3 && <ArrowRight className="w-4 h-4 ml-2" />}
          </Button>
        </div>
      </div>
    </div>
  );
}
