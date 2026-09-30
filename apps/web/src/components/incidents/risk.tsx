"use client";

import { motion } from "framer-motion";
import { humanize } from "@/lib/utils/format";
import { riskTone, TONE_HEX } from "@/lib/utils/status";
import type { RiskFactor, RiskLike } from "@/types";
import { LevelBadge } from "@/components/ui/badge";

/** Circular 0-100 risk gauge driven by the backend score. */
export function RiskGauge({
  score,
  level,
  size = 168,
  label = "RISK SCORE",
}: {
  score: number;
  level?: string | null;
  size?: number;
  label?: string;
}) {
  const stroke = Math.max(6, Math.round(size * 0.055));
  const r = (size - stroke) / 2 - 6;
  const c = 2 * Math.PI * r;
  const arc = 0.75; // 270° gauge
  const clamped = Math.max(0, Math.min(100, score));
  const color = TONE_HEX[riskTone(clamped)];
  const ticks = Array.from({ length: 28 }, (_, i) => i);

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="rotate-[135deg]" aria-hidden>
        {ticks.map((i) => {
          const a = (i / (ticks.length - 1)) * arc * 2 * Math.PI;
          const r1 = r + stroke / 2 + 3;
          const r2 = r1 + (i % 3 === 0 ? 5 : 3);
          return (
            <line
              key={i}
              x1={size / 2 + r1 * Math.cos(a)}
              y1={size / 2 + r1 * Math.sin(a)}
              x2={size / 2 + r2 * Math.cos(a)}
              y2={size / 2 + r2 * Math.sin(a)}
              stroke={i / (ticks.length - 1) <= clamped / 100 ? color : "#1B2A38"}
              strokeWidth={1}
            />
          );
        })}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="#13202B"
          strokeWidth={stroke}
          strokeDasharray={`${c * arc} ${c}`}
          strokeLinecap="butt"
        />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="butt"
          initial={{ strokeDasharray: `0 ${c}` }}
          animate={{ strokeDasharray: `${(c * arc * clamped) / 100} ${c}` }}
          transition={{ duration: 1.1, ease: [0.2, 0.7, 0.2, 1] }}
          style={{ filter: `drop-shadow(0 0 6px ${color}88)` }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="label text-[9px]">{label}</span>
        <motion.span
          key={clamped}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          className="num font-semibold leading-none"
          style={{ color, fontSize: size * 0.26 }}
        >
          {clamped}
        </motion.span>
        <span className="font-mono text-2xs text-dim">/ 100</span>
        {level && <LevelBadge level={level} className="mt-1.5" />}
      </div>
    </div>
  );
}

/** Horizontal bars for each backend risk factor (points vs. max_points). */
export function RiskFactors({ factors }: { factors: RiskFactor[] }) {
  if (!factors.length) return <p className="text-xs text-muted">No factors reported.</p>;
  return (
    <ul className="space-y-2.5">
      {factors.map((f, i) => {
        const ratio = f.max_points > 0 ? f.points / f.max_points : 0;
        const tone = ratio >= 0.8 ? "crit" : ratio >= 0.5 ? "warn" : ratio > 0 ? "accent" : "neutral";
        return (
          <li key={f.name} title={f.description}>
            <div className="mb-1 flex items-baseline justify-between gap-2">
              <span className="truncate font-mono text-2xs uppercase tracking-wider text-ink/80">{humanize(f.name)}</span>
              <span className="num shrink-0 text-2xs text-muted">
                <span className="text-ink">{f.points.toFixed(1)}</span> / {f.max_points}
              </span>
            </div>
            <div className="h-1.5 w-full bg-elevated">
              <motion.div
                className="h-full"
                style={{ background: TONE_HEX[tone] }}
                initial={{ width: 0 }}
                animate={{ width: `${Math.min(100, ratio * 100)}%` }}
                transition={{ duration: 0.8, delay: 0.08 * i }}
              />
            </div>
            <p className="mt-1 line-clamp-2 text-2xs text-dim">{f.description}</p>
          </li>
        );
      })}
    </ul>
  );
}

/** Full risk block: gauge + impact/likelihood + factors + explanation. */
export function RiskBlock({ risk, compact = false }: { risk: RiskLike; compact?: boolean }) {
  return (
    <div className={compact ? "space-y-3" : "grid gap-4 lg:grid-cols-[auto,1fr]"}>
      <div className="flex flex-col items-center gap-3">
        <RiskGauge score={risk.score} level={risk.level} size={compact ? 140 : 176} />
        <div className="grid w-full grid-cols-2 gap-2">
          <SubScore label="IMPACT" value={risk.impact_score} />
          <SubScore label="LIKELIHOOD" value={risk.likelihood_score} />
        </div>
      </div>
      <div className="min-w-0 space-y-3">
        <div>
          <span className="label">RISK FACTORS</span>
          <div className="mt-2">
            <RiskFactors factors={risk.factors} />
          </div>
        </div>
        {risk.explanation && (
          <p className="border-l-2 border-cyan/40 pl-2 text-xs leading-relaxed text-muted">{risk.explanation}</p>
        )}
      </div>
    </div>
  );
}

function SubScore({ label, value }: { label: string; value: number }) {
  const color = TONE_HEX[riskTone(value)];
  return (
    <div className="border border-line bg-bg/40 px-2 py-1.5 text-center">
      <div className="label text-[9px]">{label}</div>
      <div className="num text-lg font-semibold" style={{ color }}>
        {value}
      </div>
    </div>
  );
}
