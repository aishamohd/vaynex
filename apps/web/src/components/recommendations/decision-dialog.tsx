"use client";

import { Loader2 } from "lucide-react";
import { useState } from "react";
import { useDecideRecommendation } from "@/hooks/use-vaynex";
import { errorMessage } from "@/lib/api/errors";
import type { Recommendation, RecommendationDecision } from "@/types";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { FieldLabel, Textarea } from "@/components/ui/field";
import { LevelBadge } from "@/components/ui/badge";
import { toast } from "@/components/ui/toast";

const COPY: Record<RecommendationDecision, { title: string; verb: string; variant: "success" | "danger" | "primary" }> = {
  ACCEPTED: { title: "CONFIRM: ACCEPT RECOMMENDATION", verb: "Accept", variant: "success" },
  REJECTED: { title: "CONFIRM: REJECT RECOMMENDATION", verb: "Reject", variant: "danger" },
  COMPLETED: { title: "CONFIRM: MARK COMPLETED", verb: "Mark completed", variant: "primary" },
};

export function DecisionDialog({
  rec,
  decision,
  open,
  onOpenChange,
}: {
  rec: Recommendation;
  decision: RecommendationDecision;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const [note, setNote] = useState("");
  const mutation = useDecideRecommendation();
  const copy = COPY[decision];

  function submit() {
    mutation.mutate(
      { id: rec.id, body: { status: decision, note: note.trim() || null } },
      {
        onSuccess: (r) => {
          toast.ok(`Recommendation ${r.status.toLowerCase()}`, "Decision recorded in the audit trail.");
          setNote("");
          onOpenChange(false);
        },
        onError: (err) => toast.error("Decision failed", errorMessage(err)),
      },
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        title={copy.title}
        description="You are the human decision-maker. Vaynex does not act on infrastructure; this records your decision and is audited."
      >
        <div className="space-y-4">
          <div className="border border-line bg-bg/50 p-3">
            <div className="flex items-center gap-2">
              <LevelBadge level={rec.priority} />
              <span className="font-mono text-2xs text-muted">{rec.source.replace("_", " ")}</span>
            </div>
            <p className="mt-1.5 text-sm text-ink">{rec.title}</p>
            <p className="mt-1 text-xs text-muted">{rec.description}</p>
          </div>
          <div>
            <FieldLabel htmlFor="note">DECISION NOTE (OPTIONAL)</FieldLabel>
            <Textarea
              id="note"
              maxLength={2000}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. Hospital engineering confirmed generator start"
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={mutation.isPending}>
              Cancel
            </Button>
            <Button variant={copy.variant} onClick={submit} disabled={mutation.isPending}>
              {mutation.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              {copy.verb}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
