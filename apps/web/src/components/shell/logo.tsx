import { cn } from "@/lib/utils/cn";

export function VaynexMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={cn("h-7 w-7", className)} aria-hidden>
      <path d="M16 2 29 9.5v13L16 30 3 22.5v-13Z" fill="none" stroke="#22D3EE" strokeWidth="1.2" opacity="0.5" />
      <path d="M9 10.5 16 23l7-12.5" fill="none" stroke="#22D3EE" strokeWidth="2.2" strokeLinejoin="round" />
      <circle cx="16" cy="23" r="1.8" fill="#EAF2F7" />
      <circle cx="9" cy="10.5" r="1.4" fill="#22D3EE" />
      <circle cx="23" cy="10.5" r="1.4" fill="#22D3EE" />
    </svg>
  );
}

export function Wordmark({ collapsed = false }: { collapsed?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <VaynexMark />
      {!collapsed && (
        <div className="leading-none">
          <div className="font-mono text-sm font-semibold tracking-[0.32em] text-ink">VAYNEX</div>
          <div className="mt-1 font-mono text-[9px] tracking-[0.2em] text-cyan/70">AI RESILIENCE OS</div>
        </div>
      )}
    </div>
  );
}
