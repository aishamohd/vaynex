"use client";

import { useMemo } from "react";
import type { DependencyGraph } from "@/types";
import { computeLayout, nodeState, STATE_COLOR, type HighlightInput } from "./layout";

/** 2D SVG projection of the same layout; used when WebGL is unavailable. */
export function NetworkFallback({
  graph,
  highlight,
  selectedId,
  onSelect,
  reason,
}: {
  graph: DependencyGraph;
  highlight?: HighlightInput | null;
  selectedId?: string | null;
  onSelect?: (id: string | null) => void;
  reason?: string;
}) {
  const layout = useMemo(() => computeLayout(graph), [graph]);
  const pad = 2.5;
  const e = layout.extent + pad;
  // Isometric-ish projection: x stays, z compresses, y lifts.
  const proj = (p: [number, number, number]) => [p[0], p[2] * 0.6 - p[1] * 1.1] as const;

  return (
    <div className="relative h-full w-full">
      <svg viewBox={`${-e} ${-e * 0.8} ${e * 2} ${e * 1.6}`} className="h-full w-full">
        <ellipse cx={0} cy={0} rx={layout.extent + 1.5} ry={(layout.extent + 1.5) * 0.6} fill="none" stroke="#1B2A38" strokeWidth={0.04} />
        {layout.edges.map((edge) => {
          const a = layout.byId.get(edge.source)!;
          const b = layout.byId.get(edge.target)!;
          const [x1, y1] = proj(a.pos);
          const [x2, y2] = proj(b.pos);
          const sa = nodeState(a.node, highlight ?? null);
          const sb = nodeState(b.node, highlight ?? null);
          const hot = sa !== "normal" && sb !== "normal";
          return (
            <line
              key={edge.id}
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              stroke={hot ? "#FF4D5E" : edge.implicit ? "#1E4A5A" : "#22D3EE"}
              strokeOpacity={hot ? 0.9 : 0.35}
              strokeWidth={hot ? 0.06 : 0.03}
              strokeDasharray={edge.implicit ? "0.12 0.1" : undefined}
            />
          );
        })}
        {layout.nodes.map((p) => {
          const [x, y] = proj(p.pos);
          const st = nodeState(p.node, highlight ?? null);
          const color = STATE_COLOR[st];
          const r = p.node.kind === "INFRASTRUCTURE" ? 0.28 : 0.2;
          return (
            <g key={p.node.id} onClick={() => onSelect?.(p.node.id)} className="cursor-pointer">
              {st !== "normal" && st !== "degraded" && (
                <circle cx={x} cy={y} r={r} fill="none" stroke={color} strokeWidth={0.04}>
                  <animate attributeName="r" from={r} to={r * 3} dur="1.6s" repeatCount="indefinite" />
                  <animate attributeName="opacity" from="0.8" to="0" dur="1.6s" repeatCount="indefinite" />
                </circle>
              )}
              {p.node.kind === "INFRASTRUCTURE" ? (
                <rect x={x - r} y={y - r} width={r * 2} height={r * 2} transform={`rotate(45 ${x} ${y})`} fill={color} fillOpacity={0.85} stroke={selectedId === p.node.id ? "#EAF2F7" : "none"} strokeWidth={0.05} />
              ) : (
                <circle cx={x} cy={y} r={r} fill="none" stroke={color} strokeWidth={0.06} />
              )}
              <text x={x} y={y - r - 0.22} textAnchor="middle" fontSize={0.34} fill="#EAF2F7" fillOpacity={0.8} fontFamily="monospace">
                {p.node.name}
              </text>
            </g>
          );
        })}
      </svg>
      <div className="absolute bottom-2 left-2 border border-line bg-panel/90 px-2 py-1 font-mono text-2xs text-muted">
        2D FALLBACK{reason ? ` · ${reason}` : ""}
      </div>
    </div>
  );
}
