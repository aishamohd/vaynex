"use client";

import { CheckCircle2, Loader2 } from "lucide-react";
import { useState } from "react";
import { useResolveIncident } from "@/hooks/use-vaynex";
import { errorMessage } from "@/lib/api/errors";
import type { IncidentDetail } from "@/types";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { FieldLabel, Textarea } from "@/components/ui/field";
import { toast } from "@/components/ui/toast";

export function ResolveDialog({
  incident,
  open,
  onOpenChange,
}: {
  incident: IncidentDetail;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const [note, setNote] = useState("");
  const [restore, setRestore] = useState(true);
  const resolve = useResolveIncident();

  function submit() {
    resolve.mutate(
      { id: incident.id, body: { resolution_note: note.trim() || null, restore_asset_status: restore } },
      {
        onSuccess: () => {
          toast.ok("Incident resolved", restore ? "Affected assets and services restored." : undefined);
          onOpenChange(false);
        },
        onError: (e) => toast.error("Resolve failed", errorMessage(e)),
      },
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        title="CONFIRM: RESOLVE INCIDENT"
        description="Marks the incident resolved in Vaynex. This is recorded in the audit trail; Vaynex does not operate physical infrastructure."
      >
        <div className="space-y-4">
          <p className="border border-line bg-bg/50 p-3 text-sm text-ink">{incident.title}</p>
          <div>
            <FieldLabel htmlFor="res-note">RESOLUTION NOTE</FieldLabel>
            <Textarea
              id="res-note"
              maxLength={5000}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. Grid restored; hospital back on mains supply"
            />
          </div>
          <label className="flex items-start gap-2 text-sm text-ink/85">
            <input type="checkbox" className="mt-1 accent-cyan" checked={restore} onChange={(e) => setRestore(e.target.checked)} />
            <span>
              Restore affected infrastructure and services to their pre-incident status
              <span className="block text-xs text-muted">
                Unless another active incident still affects them (backend rule).
              </span>
            </span>
          </label>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={resolve.isPending}>
              Cancel
            </Button>
            <Button variant="success" onClick={submit} disabled={resolve.isPending}>
              {resolve.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
              Resolve
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
