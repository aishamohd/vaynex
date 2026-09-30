"use client";

import { ArrowDownRight, ArrowUpRight, Radio, X } from "lucide-react";
import Link from "next/link";
import { useInfrastructure, useInfrastructureDeps } from "@/hooks/use-vaynex";
import { formatCoord, formatDateTime, humanize } from "@/lib/utils/format";
import type { Dependency, NodeRef } from "@/types";
import { Badge, LevelBadge, StatusBadge } from "@/components/ui/badge";
import { Panel } from "@/components/ui/panel";
import { ErrorState, LoadingState } from "@/components/ui/states";
import { ImpactList } from "@/components/incidents/impact-list";

export function InfrastructureDetail({ id, onClose }: { id: string; onClose: () => void }) {
  const item = useInfrastructure(id);
  const deps = useInfrastructureDeps(id);

  return (
    <Panel
      title="ASSET DOSSIER"
      code="AD"
      tone="accent"
      actions={
        <button onClick={onClose} className="text-dim hover:text-ink" aria-label="Close">
          <X className="h-4 w-4" />
        </button>
      }
      bodyClassName="p-0 overflow-y-auto"
    >
      {item.isLoading ? (
        <LoadingState label="LOADING ASSET" />
      ) : item.isError || !item.data ? (
        <ErrorState error={item.error} onRetry={() => void item.refetch()} />
      ) : (
        <div className="divide-y divide-line">
          <div className="p-3">
            <div className="flex flex-wrap items-center gap-1.5">
              <StatusBadge status={item.data.status} />
              <LevelBadge level={item.data.criticality} />
              <Badge tone="neutral">{humanize(item.data.infrastructure_type)}</Badge>
            </div>
            <h2 className="mt-2 text-lg font-semibold text-ink">{item.data.name}</h2>
            {item.data.description && <p className="mt-1 text-sm text-muted">{item.data.description}</p>}
            <dl className="mt-3 grid grid-cols-[92px,1fr] gap-y-1 font-mono text-2xs">
              <dt className="text-dim">LOCATION</dt>
              <dd className="text-ink/85">{formatCoord(item.data.latitude, item.data.longitude)}</dd>
              <dt className="text-dim">UPDATED</dt>
              <dd className="text-ink/85">{formatDateTime(item.data.updated_at)}</dd>
            </dl>
            {Object.keys(item.data.metadata ?? {}).length > 0 && (
              <div className="mt-3">
                <span className="label">METADATA</span>
                <dl className="mt-1 grid grid-cols-2 gap-1">
                  {Object.entries(item.data.metadata).map(([k, v]) => (
                    <div key={k} className="border border-line bg-bg/40 px-2 py-1">
                      <dt className="font-mono text-[9px] uppercase text-dim">{humanize(k)}</dt>
                      <dd className="truncate font-mono text-xs text-ink/85">{typeof v === "object" ? JSON.stringify(v) : String(v)}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            )}
          </div>
          {deps.isLoading ? (
            <LoadingState label="ANALYSING DEPENDENCIES" />
          ) : deps.isError || !deps.data ? (
            <ErrorState error={deps.error} onRetry={() => void deps.refetch()} />
          ) : (
            <>
              <DepSection title="UPSTREAM · DEPENDS ON" icon={<ArrowUpRight className="h-3 w-3" />} deps={deps.data.upstream} side="source" />
              <DepSection title="DOWNSTREAM · DEPENDED ON BY" icon={<ArrowDownRight className="h-3 w-3" />} deps={deps.data.downstream} side="target" />
              <div className="p-3">
                <span className="label flex items-center gap-1.5">
                  <Radio className="h-3 w-3" /> HOSTED SERVICES ({deps.data.hosted_services.length})
                </span>
                <NodeRefs nodes={deps.data.hosted_services} />
              </div>
              <div className="p-3">
                <span className="label text-red/80">IF THIS ASSET FAILS · AFFECTED INFRASTRUCTURE ({deps.data.affected_infrastructure.length})</span>
                <ImpactList nodes={deps.data.affected_infrastructure} />
              </div>
              <div className="p-3">
                <span className="label text-red/80">IF THIS ASSET FAILS · AFFECTED SERVICES ({deps.data.affected_services.length})</span>
                <ImpactList nodes={deps.data.affected_services} />
              </div>
              <div className="p-3">
                <Link href={`/command/network?node=${id}`} className="font-mono text-2xs text-cyan hover:underline">
                  OPEN IN DEPENDENCY NETWORK →
                </Link>
              </div>
            </>
          )}
        </div>
      )}
    </Panel>
  );
}

function DepSection({
  title,
  icon,
  deps,
  side,
}: {
  title: string;
  icon: React.ReactNode;
  deps: Dependency[];
  side: "source" | "target";
}) {
  return (
    <div className="p-3">
      <span className="label flex items-center gap-1.5">
        {icon} {title} ({deps.length})
      </span>
      {deps.length === 0 ? (
        <p className="mt-1 text-xs text-muted">None.</p>
      ) : (
        <ul className="mt-1.5 space-y-1">
          {deps.map((d) => {
            const ref = side === "source" ? d.source : d.target;
            return (
              <li key={d.id} className="flex items-center gap-2 border border-line bg-bg/40 px-2 py-1.5">
                <span className="min-w-0 flex-1 truncate text-xs text-ink">{ref?.name ?? "—"}</span>
                <Badge tone="accent">{d.dependency_type}</Badge>
                <LevelBadge level={d.strength} />
                {ref && <StatusBadge status={ref.status} />}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function NodeRefs({ nodes }: { nodes: NodeRef[] }) {
  if (!nodes.length) return <p className="mt-1 text-xs text-muted">None.</p>;
  return (
    <ul className="mt-1.5 space-y-1">
      {nodes.map((n) => (
        <li key={n.id} className="flex items-center gap-2 border border-line bg-bg/40 px-2 py-1.5">
          <span className="min-w-0 flex-1 truncate text-xs text-ink">{n.name}</span>
          <LevelBadge level={n.criticality} />
          <StatusBadge status={n.status} />
        </li>
      ))}
    </ul>
  );
}
