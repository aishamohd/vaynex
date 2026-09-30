"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronsLeft, ChevronsRight } from "lucide-react";
import { useDashboard, useProvider, useReady } from "@/hooks/use-vaynex";
import { cn } from "@/lib/utils/cn";
import { useUI } from "@/store/ui";
import { Dot } from "@/components/ui/badge";
import type { Tone } from "@/lib/utils/status";
import { NAV } from "./nav";
import { Wordmark } from "./logo";

export function Sidebar() {
  const pathname = usePathname();
  const collapsed = useUI((s) => s.sidebarCollapsed);
  const toggle = useUI((s) => s.toggleSidebar);
  const dashboard = useDashboard();
  const counts: Record<string, number | undefined> = {
    "/command/incidents": dashboard.data?.active_incidents,
    "/command/recommendations": dashboard.data?.pending_recommendations,
  };

  return (
    <aside
      className={cn(
        "flex h-full shrink-0 flex-col border-r border-line bg-panel/95 transition-[width] duration-200",
        collapsed ? "w-[60px]" : "w-[232px]",
      )}
    >
      <div className="flex h-14 items-center border-b border-line px-3.5">
        <Link href="/command">
          <Wordmark collapsed={collapsed} />
        </Link>
      </div>
      <nav className="flex-1 space-y-0.5 overflow-y-auto px-2 py-3">
        {!collapsed && <div className="label mb-2 px-2 text-[9px] text-dim">OPERATIONS</div>}
        {NAV.map((item) => {
          const active = item.href === "/command" ? pathname === "/command" : pathname.startsWith(item.href);
          const Icon = item.icon;
          const count = counts[item.href];
          return (
            <Link
              key={item.href}
              href={item.href}
              title={item.label}
              className={cn(
                "group relative flex h-9 items-center gap-3 px-2.5 font-mono text-xs uppercase tracking-[0.12em] transition-colors",
                active ? "bg-cyan/10 text-cyan" : "text-muted hover:bg-elevated hover:text-ink",
              )}
            >
              {active && <span className="absolute left-0 top-1 h-7 w-[2px] bg-cyan shadow-glow" />}
              <Icon className="h-4 w-4 shrink-0" />
              {!collapsed && <span className="flex-1 truncate">{item.label}</span>}
              {!collapsed && count !== undefined && count > 0 && (
                <span
                  className={cn(
                    "num min-w-[20px] border px-1 text-center text-2xs",
                    item.href === "/command/incidents" ? "border-red/50 text-red" : "border-amber/50 text-amber",
                  )}
                >
                  {count}
                </span>
              )}
            </Link>
          );
        })}
      </nav>
      <SystemBlock collapsed={collapsed} />
      <button
        onClick={toggle}
        className="flex h-9 items-center justify-center border-t border-line text-dim hover:text-ink"
        aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
      >
        {collapsed ? <ChevronsRight className="h-4 w-4" /> : <ChevronsLeft className="h-4 w-4" />}
      </button>
    </aside>
  );
}

function SystemBlock({ collapsed }: { collapsed: boolean }) {
  const ready = useReady();
  const provider = useProvider();
  const checks = ready.data?.checks;

  const apiTone: Tone = ready.isLoading ? "neutral" : ready.isError && !ready.data ? "crit" : "ok";
  const dbTone: Tone = checks?.postgres?.status === "ok" ? "ok" : checks ? "crit" : apiTone === "crit" ? "crit" : "neutral";
  const fabricTone: Tone = checks?.redis?.status === "ok" ? "ok" : checks ? "warn" : "neutral";
  const aiTone: Tone = provider.data ? (provider.data.provider.includes("fallback") ? "warn" : "ok") : provider.isError ? "crit" : "neutral";
  const sysTone: Tone = ready.data?.status === "ready" ? "ok" : ready.data?.status === "degraded" ? "warn" : apiTone === "crit" ? "crit" : "neutral";

  const rows: { label: string; value: string; tone: Tone }[] = [
    {
      label: "AI ENGINE",
      value: provider.data ? provider.data.provider.toUpperCase() : provider.isError ? "OFFLINE" : "…",
      tone: aiTone,
    },
    {
      label: "DATA FABRIC",
      value: checks?.redis ? (checks.redis.status === "ok" ? "CACHE ONLINE" : "NO CACHE") : "…",
      tone: fabricTone,
    },
    {
      label: "DATABASE",
      value: checks?.postgres
        ? checks.postgres.status === "ok"
          ? checks.postgis?.version
            ? `PG · GIS ${checks.postgis.version}`
            : "POSTGRES"
          : "ERROR"
        : apiTone === "crit"
          ? "UNREACHABLE"
          : "…",
      tone: dbTone,
    },
    {
      label: "SYSTEM STATUS",
      value: ready.data ? ready.data.status.toUpperCase().replace("_", " ") : apiTone === "crit" ? "OFFLINE" : "…",
      tone: sysTone,
    },
  ];

  return (
    <div className="border-t border-line px-3 py-3">
      {!collapsed && <div className="label mb-2 text-[9px] text-dim">SYSTEMS</div>}
      <ul className="space-y-1.5">
        {rows.map((r) => (
          <li key={r.label} className="flex items-center gap-2" title={`${r.label}: ${r.value}`}>
            <Dot tone={r.tone} pulse={r.tone === "crit"} />
            {!collapsed && (
              <>
                <span className="flex-1 font-mono text-[10px] tracking-wider text-muted">{r.label}</span>
                <span className="max-w-[92px] truncate font-mono text-[10px] text-ink/80">{r.value}</span>
              </>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
