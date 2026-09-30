"use client";

import Link from "next/link";
import { useServices } from "@/hooks/use-vaynex";
import { humanize } from "@/lib/utils/format";
import { statusTone, TONE_HEX } from "@/lib/utils/status";
import type { DashboardOverview } from "@/types";
import { Dot, StatusBadge } from "@/components/ui/badge";
import { Panel } from "@/components/ui/panel";
import { EmptyState, QueryView } from "@/components/ui/states";
import { RiskGauge } from "@/components/incidents/risk";

export function SystemStatusPanel({ d }: { d: DashboardOverview }) {
  const segments = [
    { key: "OPERATIONAL", label: "Operational", value: d.operational_infrastructure },
    { key: "DEGRADED", label: "Degraded", value: d.degraded_infrastructure },
    { key: "FAILED", label: "Failed", value: d.failed_infrastructure },
    { key: "MAINTENANCE", label: "Maintenance", value: d.maintenance_infrastructure },
  ];
  const total = Math.max(1, d.total_infrastructure);
  const svcOk = d.total_services - d.disrupted_services;
  const health = d.total_infrastructure ? Math.round((d.operational_infrastructure / d.total_infrastructure) * 100) : 0;
  return (
    <Panel title="SYSTEM STATUS" code="SS">
      <div className="flex items-baseline justify-between">
        <span className="label">INFRASTRUCTURE HEALTH</span>
        <span className="num text-xl font-semibold" style={{ color: TONE_HEX[health === 100 ? "ok" : health >= 60 ? "warn" : "crit"] }}>
          {health}%
        </span>
      </div>
      <div className="mt-2 flex h-2.5 w-full gap-[2px] bg-bg" role="img" aria-label="Infrastructure status distribution">
        {segments
          .filter((s) => s.value > 0)
          .map((s) => (
            <div
              key={s.key}
              title={`${s.label}: ${s.value}`}
              className="h-full"
              style={{ width: `${(s.value / total) * 100}%`, background: TONE_HEX[statusTone(s.key)] }}
            />
          ))}
      </div>
      <ul className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1.5">
        {segments.map((s) => (
          <li key={s.key} className="flex items-center gap-2 font-mono text-2xs text-muted">
            <Dot tone={statusTone(s.key)} />
            <span className="flex-1 uppercase">{s.label}</span>
            <span className="num text-ink">{s.value}</span>
          </li>
        ))}
      </ul>
      <div className="mt-3 border-t border-line pt-2 font-mono text-2xs text-muted">
        SERVICES <span className="text-green">{svcOk} NOMINAL</span> ·{" "}
        <span className={d.disrupted_services ? "text-red" : ""}>{d.disrupted_services} IMPAIRED</span>
      </div>
    </Panel>
  );
}

export function RiskPanel({ d }: { d: DashboardOverview }) {
  const top = [...d.recent_incidents]
    .filter((i) => i.status !== "RESOLVED")
    .sort((a, b) => (b.risk?.score ?? 0) - (a.risk?.score ?? 0))[0];
  return (
    <Panel title="RISK" code="RK">
      <div className="flex items-center gap-4">
        <RiskGauge score={Math.round(d.average_risk)} size={118} label="AVG RISK" />
        <div className="min-w-0 flex-1 space-y-2">
          <div>
            <span className="label">HIGHEST ACTIVE</span>
            {top ? (
              <Link href={`/command/incidents/${top.id}`} className="mt-0.5 block truncate text-sm text-ink hover:text-cyan">
                {top.title}
              </Link>
            ) : (
              <p className="mt-0.5 text-xs text-muted">No active incident.</p>
            )}
          </div>
          <div className="grid grid-cols-2 gap-2 font-mono text-2xs">
            <div className="border border-line px-2 py-1">
              <div className="text-dim">ACTIVE</div>
              <div className="num text-base text-ink">{d.active_incidents}</div>
            </div>
            <div className="border border-line px-2 py-1">
              <div className="text-dim">CRITICAL</div>
              <div className={`num text-base ${d.critical_incidents ? "text-red" : "text-ink"}`}>{d.critical_incidents}</div>
            </div>
          </div>
        </div>
      </div>
    </Panel>
  );
}

export function ServicesPanel() {
  const q = useServices();
  return (
    <Panel title="PUBLIC SERVICES" code="SV" bodyClassName="p-0 overflow-y-auto max-h-[210px]">
      <QueryView
        query={q}
        loadingLabel="LOADING SERVICES"
        isEmpty={(d) => d.items.length === 0}
        empty={<EmptyState title="NO SERVICES" />}
      >
        {(d) => (
          <ul className="divide-y divide-line">
            {[...d.items]
              .sort((a, b) => Number(a.status === "OPERATIONAL") - Number(b.status === "OPERATIONAL"))
              .map((s) => (
                <li key={s.id} className="flex items-center gap-2 px-3 py-1.5">
                  <span className="min-w-0 flex-1 truncate text-xs text-ink/90">{s.name}</span>
                  <span className="hidden font-mono text-[9px] text-dim xl:inline">{humanize(s.criticality)}</span>
                  <StatusBadge status={s.status} />
                </li>
              ))}
          </ul>
        )}
      </QueryView>
    </Panel>
  );
}

export function InfrastructurePanel({ d }: { d: DashboardOverview }) {
  return (
    <Panel
      title="CRITICAL INFRASTRUCTURE"
      code="CI"
      bodyClassName="p-0 overflow-y-auto max-h-[210px]"
      actions={
        <Link href="/command/infrastructure" className="font-mono text-2xs text-cyan/80 hover:text-cyan">
          ALL →
        </Link>
      }
    >
      {d.critical_infrastructure.length === 0 ? (
        <EmptyState title="NO CRITICAL ASSETS" />
      ) : (
        <ul className="divide-y divide-line">
          {d.critical_infrastructure.map((i) => (
            <li key={i.id}>
              <Link href={`/command/infrastructure?id=${i.id}`} className="flex items-center gap-2 px-3 py-1.5 hover:bg-elevated">
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-xs text-ink/90">{i.name}</span>
                  <span className="font-mono text-[9px] text-dim">{humanize(i.infrastructure_type)}</span>
                </span>
                <StatusBadge status={i.status} />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}
