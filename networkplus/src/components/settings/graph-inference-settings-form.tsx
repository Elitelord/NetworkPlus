"use client";

import { useState, useTransition } from "react";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import {
  updateInferenceIncludePriorAffiliations,
  runContactProfileBackfillFromGroups,
} from "@/app/settings/actions";

type Props = {
  initialIncludePriorAffiliations: boolean;
};

export function GraphInferenceSettingsForm({
  initialIncludePriorAffiliations,
}: Props) {
  const [includePrior, setIncludePrior] = useState(
    initialIncludePriorAffiliations
  );
  const [pending, startTransition] = useTransition();
  const [backfillPending, setBackfillPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  return (
    <div className="space-y-6 rounded-lg border p-4">
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-4">
          <div className="space-y-0.5">
            <Label htmlFor="prior-inference" className="text-base font-medium">
              Prior work & school in graph
            </Label>
            <p className="text-sm text-muted-foreground">
              When on, inferred links can connect contacts who share a prior
              employer or school listed in their profile (in addition to current
              company/school). May add more edges.
            </p>
          </div>
          <Switch
            id="prior-inference"
            checked={includePrior}
            disabled={pending}
            onCheckedChange={(checked) => {
              setIncludePrior(checked);
              setMessage(null);
              startTransition(async () => {
                const r = await updateInferenceIncludePriorAffiliations(checked);
                if ("error" in r && r.error) {
                  setMessage(r.error);
                  setIncludePrior(!checked);
                } else {
                  setMessage("Graph links updated.");
                }
              });
            }}
          />
        </div>
      </div>

      <div className="space-y-2 border-t pt-4">
        <Label className="text-base font-medium">Profile backfill</Label>
        <p className="text-sm text-muted-foreground">
          Fill empty profile fields from contact groups (using group types) and
          from flat import metadata keys like company or school. Existing profile
          data is not overwritten.
        </p>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          disabled={backfillPending}
          onClick={async () => {
            setMessage(null);
            setBackfillPending(true);
            try {
              const r = await runContactProfileBackfillFromGroups();
              if ("error" in r && r.error) {
                setMessage(r.error);
              } else if ("updated" in r) {
                setMessage(
                  `Updated ${r.updated} contact(s); skipped ${r.skipped}.`
                );
              }
            } finally {
              setBackfillPending(false);
            }
          }}
        >
          {backfillPending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Running…
            </>
          ) : (
            "Backfill profiles from groups"
          )}
        </Button>
      </div>

      {message && (
        <p className="text-sm text-muted-foreground" role="status">
          {message}
        </p>
      )}
    </div>
  );
}
