"use client";

import { LogOut, Play, UserRound } from "lucide-react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { useProvider, useReady } from "@/hooks/use-vaynex";
import { useRole, useSession } from "@/hooks/use-session";
import { useNow } from "@/hooks/use-now";
import { clearSession } from "@/lib/auth/session";
import { useUI } from "@/store/ui";
import { Button } from "@/components/ui/button";
import { Dot } from "@/components/ui/badge";
import type { Tone } from "@/lib/utils/status";

export function Topbar() {
  const router = useRouter();
  const qc = useQueryClient();
  const session = useSession();
  const { canOperate } = useRole();
  const ready = useReady();
  const provider = useProvider();
  const lastSync = useUI((s) => s.lastSync);
  const phase = useUI((s) => s.simulationPhase);
  const now = useNow(1000);

  const apiUp = ready.isSuccess || (ready.data !== undefined && !ready.isError);
  const apiDown = ready.isError && !ready.data;
  const sysTone: Tone = apiDown ? "crit" : ready.data?.status === "ready" ? "ok" : ready.data ? "warn" : "neutral";
  const sysLabel = apiDown ? "SYSTEM OFFLINE" : ready.data?.status === "ready" ? "SYSTEM ONLINE" : ready.data ? "SYSTEM DEGRADED" : "CONNECTING";
  const syncAgo = lastSync ? Math.max(0, Math.round((now - lastSync) / 1000)) : null;

  function logout() {
    clearSession();
    qc.clear();
    router.replace("/login");
  }

  function runDemo() {
    router.push("/command/simulation?demo=1");
  }

  return (
    <header className="flex h-14 shrink-0 items-center gap-5 border-b border-line bg-panel/80 px-4 backdrop-blur">
      <div className="flex items-center gap-2">
        <Dot tone={sysTone} pulse={sysTone !== "neutral"} />
        <span className="font-mono text-xs tracking-[0.2em] text-ink">{sysLabel}</span>
      </div>
      <Divider />
      <Stat label="API" value={apiDown ? "UNREACHABLE" : apiUp ? "CONNECTED" : "…"} tone={apiDown ? "crit" : apiUp ? "ok" : "neutral"} />
      <Stat
        label="AI PROVIDER"
        value={
          provider.data
            ? `${provider.data.provider.toUpperCase()}${provider.data.model ? ` · ${provider.data.model}` : ""}`
            : provider.isError
              ? "UNAVAILABLE"
              : "…"
        }
        tone={provider.data ? "accent" : "neutral"}
      />
      <Stat label="LAST SYNC" value={syncAgo === null ? "—" : syncAgo < 2 ? "LIVE" : `${syncAgo}s AGO`} tone="neutral" />
      <div className="ml-auto flex items-center gap-3">
        {canOperate && (
          <Button variant="primary" size="sm" onClick={runDemo} disabled={phase === "requesting" || phase === "playing"}>
            <Play className="h-3 w-3 fill-current" /> Run Vaynex Demo
          </Button>
        )}
        <Divider />
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center border border-line bg-elevated">
            <UserRound className="h-3.5 w-3.5 text-cyan" />
          </div>
          <div className="leading-tight">
            <div className="label text-[9px]">OPERATOR</div>
            <div className="max-w-[180px] truncate font-mono text-xs text-ink">
              {session?.user.full_name || session?.user.email || "—"}
              <span className="ml-1.5 text-cyan/80">{session?.user.role}</span>
            </div>
          </div>
        </div>
        <Button variant="ghost" size="icon" onClick={logout} title="Sign out" aria-label="Sign out">
          <LogOut className="h-4 w-4" />
        </Button>
      </div>
    </header>
  );
}

function Divider() {
  return <span className="h-6 w-px bg-line" />;
}

function Stat({ label, value, tone }: { label: string; value: string; tone: Tone }) {
  const color =
    tone === "ok" ? "text-green" : tone === "crit" ? "text-red" : tone === "accent" ? "text-cyan" : tone === "warn" ? "text-amber" : "text-ink/80";
  return (
    <div className="hidden leading-tight xl:block">
      <div className="label text-[9px]">{label}</div>
      <div className={`max-w-[220px] truncate font-mono text-xs ${color}`}>{value}</div>
    </div>
  );
}
