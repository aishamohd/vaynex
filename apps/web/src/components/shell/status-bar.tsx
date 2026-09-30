"use client";

import { ShieldCheck } from "lucide-react";
import { useDashboard } from "@/hooks/use-vaynex";
import { useNow } from "@/hooks/use-now";
import { API_BASE_URL } from "@/lib/api/config";
import { formatTime } from "@/lib/utils/format";
import { useUI } from "@/store/ui";

export function StatusBar() {
  const dashboard = useDashboard();
  const now = useNow(1000);
  const phase = useUI((s) => s.simulationPhase);
  const d = dashboard.data;
  return (
    <footer className="flex h-7 shrink-0 items-center gap-4 border-t border-line bg-panel/90 px-4 font-mono text-[10px] tracking-wider text-dim">
      <span className="flex items-center gap-1.5 text-cyan/70">
        <ShieldCheck className="h-3 w-3" /> ADVISORY ONLY · HUMAN DECISION REQUIRED · ALL ACTIONS AUDITED
      </span>
      <span className="ml-auto hidden lg:inline">API {API_BASE_URL}/api/v1</span>
      {d && (
        <span className="hidden md:inline">
          SNAPSHOT {formatTime(d.generated_at)} {d.cached ? "· CACHED" : "· LIVE"}
        </span>
      )}
      {phase !== "idle" && <span className="text-amber">SIM {phase.toUpperCase()}</span>}
      <span className="num text-muted">{new Date(now).toISOString().slice(11, 19)} UTC</span>
    </footer>
  );
}
