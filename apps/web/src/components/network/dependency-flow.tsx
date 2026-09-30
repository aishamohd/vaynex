"use client";

import {
  Background,
  BackgroundVariant,
  Controls,
  Handle,
  MarkerType,
  MiniMap,
  Position,
  ReactFlow,
  type Edge,
  type Node,
  type NodeProps,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { Boxes, Radio } from "lucide-react";
import { memo, useMemo } from "react";
import { cn } from "@/lib/utils/cn";
import { humanize } from "@/lib/utils/format";
import { statusTone, TONE_HEX } from "@/lib/utils/status";
import type { DependencyGraph, GraphNode } from "@/types";

type FlowNodeData = {
  node: GraphNode;
  selected: boolean;
  role: "selected" | "upstream" | "downstream" | "affected" | "dim" | "normal";
};
type FlowNode = Node<FlowNodeData, "vaynex">;

const COL_W = 270;
const ROW_H = 96;

/** Longest-path layering: providers on the left, dependants to the right. */
function layer(graph: DependencyGraph): Map<string, number> {
  const level = new Map<string, number>(graph.nodes.map((n) => [n.id, 0]));
  for (let i = 0; i < graph.nodes.length; i++) {
    let changed = false;
    for (const e of graph.edges) {
      const next = (level.get(e.source) ?? 0) + 1;
      if (next > (level.get(e.target) ?? 0) && next < graph.nodes.length) {
        level.set(e.target, next);
        changed = true;
      }
    }
    if (!changed) break;
  }
  return level;
}

export function DependencyFlow({
  graph,
  selectedId,
  onSelect,
  upstream,
  downstream,
  affected,
}: {
  graph: DependencyGraph;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  upstream: Set<string>;
  downstream: Set<string>;
  affected: Set<string>;
}) {
  const levels = useMemo(() => layer(graph), [graph]);

  const nodes: FlowNode[] = useMemo(() => {
    const cols = new Map<number, GraphNode[]>();
    for (const n of graph.nodes) {
      const l = levels.get(n.id) ?? 0;
      cols.set(l, [...(cols.get(l) ?? []), n]);
    }
    const out: FlowNode[] = [];
    for (const [l, list] of cols) {
      list.sort((a, b) => a.kind.localeCompare(b.kind) || a.name.localeCompare(b.name));
      const offset = -((list.length - 1) * ROW_H) / 2;
      list.forEach((n, i) => {
        const role: FlowNodeData["role"] = !selectedId
          ? "normal"
          : n.id === selectedId
            ? "selected"
            : upstream.has(n.id)
              ? "upstream"
              : downstream.has(n.id)
                ? "downstream"
                : affected.has(n.id)
                  ? "affected"
                  : "dim";
        out.push({
          id: n.id,
          type: "vaynex",
          position: { x: l * COL_W, y: offset + i * ROW_H },
          data: { node: n, selected: n.id === selectedId, role },
        });
      });
    }
    return out;
  }, [graph.nodes, levels, selectedId, upstream, downstream, affected]);

  const byId = useMemo(() => new Map(graph.nodes.map((n) => [n.id, n])), [graph.nodes]);

  const edges: Edge[] = useMemo(
    () =>
      graph.edges.map((e) => {
        const src = byId.get(e.source);
        const tgt = byId.get(e.target);
        const impaired = !!src && src.status !== "OPERATIONAL" && src.status !== "MAINTENANCE";
        const involved = !selectedId || e.source === selectedId || e.target === selectedId || (affected.has(e.source) && affected.has(e.target));
        const color = impaired && tgt && tgt.status !== "OPERATIONAL" ? "#FF4D5E" : e.strength === "CRITICAL" ? "#22D3EE" : "#3B6E80";
        return {
          id: e.id,
          source: e.source,
          target: e.target,
          animated: impaired || (!!selectedId && involved && !e.implicit),
          label: e.implicit ? "HOSTS" : `${e.dependency_type} · ${e.strength}`,
          labelStyle: { fill: "#81919E", fontSize: 9, fontFamily: "monospace" },
          labelBgStyle: { fill: "#03060A", fillOpacity: 0.85 },
          labelBgPadding: [4, 2] as [number, number],
          style: {
            stroke: color,
            strokeWidth: e.strength === "CRITICAL" ? 2 : 1.25,
            strokeDasharray: e.implicit ? "4 4" : undefined,
            opacity: involved ? 1 : 0.15,
          },
          markerEnd: { type: MarkerType.ArrowClosed, color, width: 14, height: 14 },
        };
      }),
    [graph.edges, byId, selectedId, affected],
  );

  const nodeTypes = useMemo(() => ({ vaynex: VaynexNode }), []);

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      nodeTypes={nodeTypes}
      onNodeClick={(_, n) => onSelect(n.id)}
      onPaneClick={() => onSelect(null)}
      fitView
      fitViewOptions={{ padding: 0.15 }}
      minZoom={0.2}
      maxZoom={1.8}
      nodesDraggable
      nodesConnectable={false}
      proOptions={{ hideAttribution: true }}
      colorMode="dark"
    >
      <Background variant={BackgroundVariant.Dots} gap={24} size={1} color="#1B2A38" />
      <Controls showInteractive={false} />
      <MiniMap
        pannable
        zoomable
        nodeColor={(n) => TONE_HEX[statusTone((n.data as FlowNodeData).node.status)]}
        maskColor="rgba(3,6,10,0.7)"
      />
    </ReactFlow>
  );
}

const ROLE_RING: Record<FlowNodeData["role"], string> = {
  selected: "border-cyan shadow-glow",
  upstream: "border-blue",
  downstream: "border-amber",
  affected: "border-red/70",
  dim: "border-line opacity-35",
  normal: "border-line",
};

const ROLE_TAG: Partial<Record<FlowNodeData["role"], string>> = {
  upstream: "UPSTREAM",
  downstream: "DOWNSTREAM",
  affected: "IMPACT PATH",
};

const VaynexNode = memo(function VaynexNode({ data }: NodeProps<FlowNode>) {
  const { node, role } = data;
  const tone = statusTone(node.status);
  const color = TONE_HEX[tone];
  const Icon = node.kind === "INFRASTRUCTURE" ? Boxes : Radio;
  return (
    <div className={cn("w-[210px] border bg-panel px-2.5 py-2 transition-opacity", ROLE_RING[role])}>
      <Handle type="target" position={Position.Left} style={{ background: "#27394A", border: "none", width: 6, height: 6 }} />
      <div className="flex items-center gap-1.5">
        <Icon className="h-3 w-3 shrink-0" style={{ color: node.kind === "INFRASTRUCTURE" ? "#22D3EE" : "#3B82F6" }} />
        <span className="font-mono text-[9px] uppercase tracking-wider text-dim">
          {node.kind === "INFRASTRUCTURE" ? "INFRA" : "SERVICE"} · {node.criticality}
        </span>
        {ROLE_TAG[role] && <span className="ml-auto font-mono text-[8px] text-muted">{ROLE_TAG[role]}</span>}
      </div>
      <div className="mt-1 truncate text-[13px] font-medium text-ink">{node.name}</div>
      <div className="mt-1 flex items-center gap-1.5">
        <span className="h-1.5 w-1.5 rounded-full" style={{ background: color, boxShadow: tone === "crit" ? `0 0 8px ${color}` : undefined }} />
        <span className="font-mono text-[10px] uppercase" style={{ color }}>
          {humanize(node.status)}
        </span>
        <span className="ml-auto truncate font-mono text-[9px] text-dim">{humanize(node.type)}</span>
      </div>
      <Handle type="source" position={Position.Right} style={{ background: "#27394A", border: "none", width: 6, height: 6 }} />
    </div>
  );
});
