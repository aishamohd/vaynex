"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ChevronRight, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useIncidents } from "@/hooks/use-vaynex";
import { shortId, timeAgo } from "@/lib/utils/format";
import { riskTone, TONE_HEX } from "@/lib/utils/status";
import type { DashboardEvent } from "@/types";
import { LevelBadge, StatusBadge } from "@/components/ui/badge";
import { Panel } from "@/components/ui/panel";
import { EmptyState, QueryView } from "@/components/ui/states";

export function LiveIncidents() {
  const q = useIncidents({ active_only: true, limit: 20 });
  return (
    <Panel
      title="LIVE INCIDENTS"
      code="LI"
      actions={
        <Link href="/command/incidents" className="font-mono text-2xs text-cyan/80 hover:text-cyan">
          ALL →
        </Link>
      }
      bodyClassName="p-0 overflow-y-auto"
      className="min-h-0"
    >
      <QueryView
        query={q}
        loadingLabel="SCANNING INCIDENTS"
        isEmpty={(d) => d.items.length === 0}
        empty={
          <EmptyState
            title="NO ACTIVE INCIDENTS"
            hint="All monitored infrastructure is nominal."
            icon={<ShieldCheck className="h-5 w-5 text-green" />}
          />
        }
      >
        {(d) => (
          <ul className="divide-y divide-line">
            <AnimatePresence initial={false}>
              {d.items.map((inc) => {
                const score = inc.risk?.score ?? null;
                return (
                  <motion.li
                    key={inc.id}
                    layout
                    initial={{ opacity: 0, x: 12 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0 }}
                  >
                    <Link href={`/command/incidents/${inc.id}`} className="group flex gap-3 px-3 py-2.5 hover:bg-elevated">
                      <div
                        className="flex w-11 shrink-0 flex-col items-center justify-center border"
                        style={{ borderColor: `${TONE_HEX[riskTone(score)]}66` }}
                      >
                        <span className="num text-base font-semibold" style={{ color: TONE_HEX[riskTone(score)] }}>
                          {score ?? "—"}
                        </span>
                        <span className="font-mono text-[8px] text-dim">RISK</span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono text-2xs text-dim">INC-{shortId(inc.id)}</span>
                          <span className="font-mono text-2xs text-dim">· {timeAgo(inc.detected_at)}</span>
                        </div>
                        <p className="truncate text-sm text-ink group-hover:text-cyan">{inc.title}</p>
                        <div className="mt-1 flex flex-wrap items-center gap-1.5">
                          <LevelBadge level={inc.severity} />
                          <StatusBadge status={inc.status} />
                          <span className="font-mono text-2xs text-muted">
                            {inc.affected_infrastructure_count} INF · {inc.affected_services_count} SVC
                          </span>
                        </div>
                      </div>
                      <ChevronRight className="mt-3 h-4 w-4 shrink-0 text-dim group-hover:text-cyan" />
                    </Link>
                  </motion.li>
                );
              })}
            </AnimatePresence>
          </ul>
        )}
      </QueryView>
    </Panel>
  );
}

export function RecentEvents({ events }: { events: DashboardEvent[] }) {
  return (
    <Panel title="EVENT STREAM" code="EV" bodyClassName="p-0 overflow-y-auto">
      {events.length === 0 ? (
        <EmptyState title="NO EVENTS" hint="No events ingested yet." />
      ) : (
        <ul className="divide-y divide-line">
          {events.map((e) => (
            <li key={e.id} className="flex items-center gap-2 px-3 py-2">
              <LevelBadge level={e.severity} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs text-ink">{e.title}</p>
                <p className="font-mono text-2xs text-dim">
                  {e.event_type} · {e.source}
                </p>
              </div>
              <span className="shrink-0 font-mono text-2xs text-dim">{timeAgo(e.occurred_at)}</span>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}
