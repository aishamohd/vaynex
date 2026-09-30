"use client";

import { ArrowRight, X } from "lucide-react";
import Link from "next/link";
import { humanize } from "@/lib/utils/format";
import type { GraphNode } from "@/types";
import { LevelBadge, StatusBadge } from "@/components/ui/badge";

export function NodeInspectorCard({ node, onClose }: { node: GraphNode; onClose: () => void }) {
  return (
    <div className="w-[260px] border border-cyan/40 bg-panel/95 p-3 shadow-glow backdrop-blur">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="label text-[9px]">{node.kind === "INFRASTRUCTURE" ? "INFRASTRUCTURE" : "PUBLIC SERVICE"}</div>
          <div className="mt-0.5 truncate text-sm text-ink">{node.name}</div>
        </div>
        <button onClick={onClose} className="text-dim hover:text-ink" aria-label="Close">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        <StatusBadge status={node.status} />
        <LevelBadge level={node.criticality} />
      </div>
      <div className="mt-2 font-mono text-2xs text-muted">{humanize(node.type)}</div>
      {typeof node.latitude === "number" && typeof node.longitude === "number" && (
        <div className="font-mono text-2xs text-dim">
          {node.latitude.toFixed(4)}°N {node.longitude.toFixed(4)}°E
        </div>
      )}
      <div className="mt-2.5 flex gap-3">
        {node.kind === "INFRASTRUCTURE" && (
          <Link
            href={`/command/infrastructure?id=${node.id}`}
            className="flex items-center gap-1 font-mono text-2xs text-cyan hover:underline"
          >
            DETAILS <ArrowRight className="h-3 w-3" />
          </Link>
        )}
        <Link
          href={`/command/network?node=${node.id}`}
          className="flex items-center gap-1 font-mono text-2xs text-cyan hover:underline"
        >
          DEPENDENCIES <ArrowRight className="h-3 w-3" />
        </Link>
      </div>
    </div>
  );
}

export function NetworkLegend() {
  const items = [
    { c: "#22D3EE", l: "Operational" },
    { c: "#F5A524", l: "Degraded" },
    { c: "#FF4D5E", l: "Failed / Disrupted" },
    { c: "#FF7A45", l: "Impact path" },
  ];
  return (
    <div className="flex flex-col gap-1 border border-line bg-panel/85 px-2.5 py-2 backdrop-blur">
      <span className="label text-[9px]">LEGEND</span>
      <div className="flex items-center gap-3 font-mono text-[10px] text-muted">
        <span>▲ INFRASTRUCTURE</span>
        <span>● SERVICE</span>
      </div>
      {items.map((i) => (
        <span key={i.l} className="flex items-center gap-2 font-mono text-[10px] uppercase text-muted">
          <span className="h-2 w-2" style={{ background: i.c }} />
          {i.l}
        </span>
      ))}
    </div>
  );
}
