"use client";

import dynamic from "next/dynamic";
import { Component, useMemo, useSyncExternalStore, type ReactNode } from "react";
import type { DependencyGraph } from "@/types";
import { LoadingState } from "@/components/ui/states";
import { NetworkFallback } from "./network-fallback";
import type { HighlightInput } from "./layout";

const ResilienceNetwork = dynamic(() => import("./resilience-network"), {
  ssr: false,
  loading: () => <LoadingState label="INITIALIZING RESILIENCE NETWORK" />,
});

let webglCache: boolean | null = null;
function detectWebGL(): boolean {
  if (webglCache !== null) return webglCache;
  try {
    const c = document.createElement("canvas");
    webglCache = !!(c.getContext("webgl2") || c.getContext("webgl"));
  } catch {
    webglCache = false;
  }
  return webglCache;
}

class SceneBoundary extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

export interface NetworkViewProps {
  graph: DependencyGraph;
  affected?: string[];
  origin?: string | null;
  depthById?: Record<string, number>;
  revealDepth?: number;
  selectedId?: string | null;
  onSelect?: (id: string | null) => void;
  autoRotate?: boolean;
  showAllLabels?: boolean;
}

/** 3D network with WebGL detection and a 2D fallback. */
export function NetworkView({
  graph,
  affected,
  origin = null,
  depthById,
  revealDepth = 99,
  selectedId,
  onSelect,
  autoRotate,
  showAllLabels,
}: NetworkViewProps) {
  const webgl = useSyncExternalStore(
    () => () => {},
    () => detectWebGL(),
    () => true,
  );
  const highlight = useMemo<HighlightInput | null>(
    () =>
      affected && affected.length
        ? { affected: new Set(affected), origin, depthById: depthById ?? {}, revealDepth }
        : null,
    [affected, origin, depthById, revealDepth],
  );

  const fallback = (reason: string) => (
    <NetworkFallback graph={graph} highlight={highlight} selectedId={selectedId} onSelect={onSelect} reason={reason} />
  );

  if (!webgl) return fallback("WEBGL UNAVAILABLE");
  return (
    <SceneBoundary fallback={fallback("3D RENDERER ERROR")}>
      <ResilienceNetwork
        graph={graph}
        highlight={highlight}
        selectedId={selectedId}
        onSelect={onSelect}
        autoRotate={autoRotate}
        showAllLabels={showAllLabels}
      />
    </SceneBoundary>
  );
}
