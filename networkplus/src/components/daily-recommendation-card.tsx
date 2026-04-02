"use client";

import * as React from "react";
import { Sparkles, MessageSquare, X, User, Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";

interface Recommendation {
  id: string;
  contactId: string;
  reason: string;
  icebreaker: string;
  contact: {
    name: string;
    lastInteractionAt?: string;
  };
}

interface DailyRecommendationCardProps {
  onReachOut: (contactId: string, initialMessage?: string) => void;
  className?: string;
}

export function DailyRecommendationCard({ onReachOut, className }: DailyRecommendationCardProps) {
  const [recommendation, setRecommendation] = React.useState<Recommendation | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [dismissed, setDismissed] = React.useState(false);

  React.useEffect(() => {
    async function fetchRecommendation() {
      try {
        const res = await fetch("/api/recommendations/daily");
        if (res.ok) {
          const data = await res.json();
          if (data.id) {
            setRecommendation(data);
          }
        }
      } catch (err) {
        console.error("Failed to fetch recommendation:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchRecommendation();
  }, []);

  const handleDismiss = async () => {
    if (!recommendation) return;
    setDismissed(true);
    try {
      await fetch(`/api/recommendations/${recommendation.id}/dismiss`, { method: "POST" });
    } catch (err) {
      console.error("Failed to dismiss:", err);
    }
  };

  if (loading) {
    return (
      <Card className={cn("overflow-hidden border-primary/20 bg-primary/5 animate-pulse", className)}>
        <CardContent className="p-4 flex items-center justify-center min-h-[100px]">
          <Loader2 className="h-5 w-5 animate-spin text-primary/50" />
        </CardContent>
      </Card>
    );
  }

  if (!recommendation || dismissed) return null;

  return (
    <Card className={cn(
      "group relative overflow-hidden border-primary/30 bg-primary/5 shadow-sm transition-all hover:bg-primary/10",
      className
    )}>
      {/* Subtle Gradient Accent */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent pointer-events-none" />
      
      <CardContent className="p-2 relative">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-2.5 min-w-0">
            <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/20 text-primary">
              <Sparkles className="h-3.5 w-3.5" />
            </div>
            
            <div className="min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <span className="text-[9px] font-bold uppercase tracking-wider text-primary">Daily Spark</span>
              </div>
              <h3 className="text-sm font-semibold text-foreground leading-tight break-words">
                {recommendation.contact.name}
              </h3>
              <p className="text-[11px] text-muted-foreground italic leading-snug mt-1 break-words">
                {recommendation.reason}
              </p>
            </div>
          </div>

          <button 
            onClick={handleDismiss}
            className="shrink-0 rounded-full p-1 text-muted-foreground/30 hover:bg-muted hover:text-foreground transition-all"
            title="Dismiss"
          >
            <X className="h-3 w-3" />
          </button>
        </div>

        <div className="mt-3 flex items-center gap-2">
          <Button 
            size="sm" 
            className="h-7 px-3 text-[10px] gap-1.5 bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm transition-all active:scale-95"
            onClick={() => onReachOut(recommendation.contactId, recommendation.icebreaker)}
          >
            <MessageSquare className="h-3 w-3" />
            <span>Reach Out</span>
          </Button>
          
          <div className="flex-1 text-[10px] text-primary/70 font-medium truncate italic" title={recommendation.icebreaker || ""}>
             "{recommendation.icebreaker?.split('?')[0]}?"
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
