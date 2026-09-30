"use client";

import { ArrowRight, Loader2, Zap } from "lucide-react";
import Link from "next/link";
import { useMemo, useState, type FormEvent } from "react";
import { useCreateEvent, useInfrastructureList, useServices } from "@/hooks/use-vaynex";
import { errorMessage } from "@/lib/api/errors";
import { humanize } from "@/lib/utils/format";
import { EVENT_TYPES, LEVELS, type EventCreate, type EventProcessingResult, type EventType, type Severity } from "@/types";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { FieldLabel, Input, Select, Textarea } from "@/components/ui/field";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { toast } from "@/components/ui/toast";
import { PipelineRail, stagesFromSteps } from "@/components/intelligence/pipeline-rail";
import { AIAnalysisView } from "@/components/intelligence/ai-analysis";
import { RiskBlock } from "./risk";
import { ImpactList } from "./impact-list";

/** POST /api/v1/events — the primary pipeline entry point. Fields mirror EventCreate. */
export function CreateEventDialog({ trigger }: { trigger: (open: () => void) => React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [result, setResult] = useState<EventProcessingResult | null>(null);

  return (
    <>
      {trigger(() => {
        setResult(null);
        setOpen(true);
      })}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          title={result ? "EVENT PROCESSED" : "CREATE EVENT"}
          description={
            result
              ? "Result of the real event pipeline (EventProcessingResult)."
              : "Inject an operational event. Vaynex runs the full pipeline: context, dependencies, incident, risk, AI, recommendations and audit."
          }
          className={result ? "w-[min(980px,calc(100vw-32px))]" : undefined}
        >
          {result ? <EventResult result={result} onClose={() => setOpen(false)} /> : <EventForm onDone={setResult} />}
        </DialogContent>
      </Dialog>
    </>
  );
}

function EventForm({ onDone }: { onDone: (r: EventProcessingResult) => void }) {
  const infra = useInfrastructureList({});
  const services = useServices();
  const create = useCreateEvent();

  const [eventType, setEventType] = useState<EventType>("EQUIPMENT_FAILURE");
  const [severity, setSeverity] = useState<Severity>("HIGH");
  const [source, setSource] = useState("operator-console");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [target, setTarget] = useState(""); // "infra:<id>" | "svc:<id>"
  const [radius, setRadius] = useState("");
  const [payloadText, setPayloadText] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  const targets = useMemo(
    () => ({
      infra: infra.data?.items ?? [],
      services: services.data?.items ?? [],
    }),
    [infra.data, services.data],
  );

  function submit(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    let payload: Record<string, unknown> = {};
    if (payloadText.trim()) {
      try {
        const parsed: unknown = JSON.parse(payloadText);
        if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) throw new Error();
        payload = parsed as Record<string, unknown>;
      } catch {
        setFormError("Payload must be a JSON object, e.g. {\"voltage\": 0}");
        return;
      }
    }
    if (radius.trim()) {
      const r = Number(radius);
      if (!Number.isFinite(r) || r < 0 || r > 50000) {
        setFormError("Impact radius must be between 0 and 50000 m");
        return;
      }
      payload.impact_radius_m = r;
    }
    const body: EventCreate = {
      event_type: eventType,
      severity,
      source: source.trim(),
      title: title.trim(),
      description: description.trim() || null,
      payload,
    };
    if (target.startsWith("infra:")) body.infrastructure_id = target.slice(6);
    if (target.startsWith("svc:")) body.service_id = target.slice(4);
    // The backend inherits the asset's coordinates for the radius search when lat/lon are omitted.
    create.mutate(body, {
      onSuccess: (res) => {
        toast.ok(res.incident_created ? "Incident detected" : "Event logged", res.event.title);
        onDone(res);
      },
      onError: (err) => setFormError(errorMessage(err)),
    });
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <FieldLabel htmlFor="ev-type">EVENT TYPE</FieldLabel>
          <Select id="ev-type" value={eventType} onChange={(e) => setEventType(e.target.value as EventType)}>
            {EVENT_TYPES.map((t) => (
              <option key={t} value={t}>
                {humanize(t)}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <FieldLabel htmlFor="ev-sev">SEVERITY</FieldLabel>
          <Select id="ev-sev" value={severity} onChange={(e) => setSeverity(e.target.value as Severity)}>
            {LEVELS.map((l) => (
              <option key={l} value={l}>
                {l}
              </option>
            ))}
          </Select>
        </div>
      </div>
      <div>
        <FieldLabel htmlFor="ev-title">TITLE</FieldLabel>
        <Input
          id="ev-title"
          required
          minLength={3}
          maxLength={300}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Transformer overheating at Central Substation"
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <FieldLabel htmlFor="ev-target">AFFECTED ASSET / SERVICE</FieldLabel>
          <Select id="ev-target" value={target} onChange={(e) => setTarget(e.target.value)}>
            <option value="">— none —</option>
            <optgroup label="Infrastructure">
              {targets.infra.map((i) => (
                <option key={i.id} value={`infra:${i.id}`}>
                  {i.name}
                </option>
              ))}
            </optgroup>
            <optgroup label="Services">
              {targets.services.map((s) => (
                <option key={s.id} value={`svc:${s.id}`}>
                  {s.name}
                </option>
              ))}
            </optgroup>
          </Select>
        </div>
        <div>
          <FieldLabel htmlFor="ev-src">SOURCE</FieldLabel>
          <Input id="ev-src" required maxLength={120} value={source} onChange={(e) => setSource(e.target.value)} />
        </div>
      </div>
      <div>
        <FieldLabel htmlFor="ev-desc">DESCRIPTION</FieldLabel>
        <Textarea id="ev-desc" maxLength={5000} value={description} onChange={(e) => setDescription(e.target.value)} />
      </div>
      <div className="grid grid-cols-[140px,1fr] gap-3">
        <div>
          <FieldLabel htmlFor="ev-radius">IMPACT RADIUS (M)</FieldLabel>
          <Input
            id="ev-radius"
            inputMode="numeric"
            value={radius}
            onChange={(e) => setRadius(e.target.value)}
            placeholder="optional"
          />
        </div>
        <div>
          <FieldLabel htmlFor="ev-payload">PAYLOAD (JSON, OPTIONAL)</FieldLabel>
          <Input
            id="ev-payload"
            className="font-mono text-xs"
            value={payloadText}
            onChange={(e) => setPayloadText(e.target.value)}
            placeholder='{"temperature_c": 118}'
          />
        </div>
      </div>
      {formError && <p className="border border-red/40 bg-red-soft/40 px-2 py-1.5 text-xs text-red">{formError}</p>}
      <div className="flex justify-end gap-2 pt-1">
        <Button type="submit" variant="primary" disabled={create.isPending}>
          {create.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Zap className="h-3.5 w-3.5" />}
          {create.isPending ? "Processing pipeline" : "Ingest event"}
        </Button>
      </div>
    </form>
  );
}

export function EventResult({ result, onClose }: { result: EventProcessingResult; onClose?: () => void }) {
  const steps = result.pipeline.map((s) => ({ step: s }));
  return (
    <div className="space-y-4">
      <div className="border border-line bg-bg/40 p-3">
        <span className="label">PIPELINE</span>
        <PipelineRail stages={stagesFromSteps(steps, steps.length)} orientation="horizontal" className="mt-2 pb-1" />
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-3">
          <div>
            <span className="label">EVENT</span>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <Badge tone="accent">{humanize(result.event.event_type)}</Badge>
              <Badge tone="neutral">{result.event.severity}</Badge>
              <span className="text-sm text-ink">{result.event.title}</span>
            </div>
          </div>
          <div>
            <span className="label">INCIDENT</span>
            {result.incident ? (
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <StatusBadge status={result.incident.status} />
                <span className="text-sm text-ink">{result.incident.title}</span>
                <Link
                  href={`/command/incidents/${result.incident.id}`}
                  onClick={onClose}
                  className="flex items-center gap-1 font-mono text-2xs text-cyan hover:underline"
                >
                  OPEN <ArrowRight className="h-3 w-3" />
                </Link>
              </div>
            ) : (
              <p className="mt-1 text-xs text-muted">Below incident threshold — event logged for monitoring.</p>
            )}
          </div>
          {result.risk && <RiskBlock risk={result.risk} compact />}
        </div>
        <div className="space-y-3">
          <div>
            <span className="label">AFFECTED INFRASTRUCTURE ({result.affected_infrastructure.length})</span>
            <ImpactList nodes={result.affected_infrastructure} />
          </div>
          <div>
            <span className="label">AFFECTED SERVICES ({result.affected_services.length})</span>
            <ImpactList nodes={result.affected_services} />
          </div>
        </div>
      </div>
      {result.ai_analysis && (
        <div className="border-t border-line pt-4">
          <AIAnalysisView analysis={result.ai_analysis} />
        </div>
      )}
      {result.recommendations.length > 0 && (
        <div className="flex items-center justify-between border border-amber/40 bg-amber-soft/30 px-3 py-2">
          <span className="font-mono text-xs text-amber">
            {result.recommendations.length} RECOMMENDATION(S) AWAITING HUMAN DECISION
          </span>
          {result.incident && (
            <Link href={`/command/incidents/${result.incident.id}`} onClick={onClose}>
              <Button size="sm" variant="primary">
                Review <ArrowRight className="h-3 w-3" />
              </Button>
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
