/** Maps backend state enums to the design system's state colours. */
export type Tone = "ok" | "warn" | "crit" | "info" | "neutral" | "accent";

export const TONE_HEX: Record<Tone, string> = {
  ok: "#2BD99F",
  warn: "#F5A524",
  crit: "#FF4D5E",
  info: "#3B82F6",
  neutral: "#81919E",
  accent: "#22D3EE",
};

export function statusTone(status: string | null | undefined): Tone {
  switch (status) {
    case "OPERATIONAL":
    case "RESOLVED":
    case "COMPLETED":
    case "ACCEPTED":
    case "ok":
    case "ready":
      return "ok";
    case "DEGRADED":
    case "INVESTIGATING":
    case "MITIGATING":
    case "PENDING":
    case "degraded":
      return "warn";
    case "FAILED":
    case "DISRUPTED":
    case "SUSPENDED":
    case "OPEN":
    case "REJECTED":
    case "error":
    case "not_ready":
      return "crit";
    case "MAINTENANCE":
      return "info";
    default:
      return "neutral";
  }
}

export function levelTone(level: string | null | undefined): Tone {
  switch (level) {
    case "CRITICAL":
      return "crit";
    case "HIGH":
      return "warn";
    case "MEDIUM":
      return "info";
    case "LOW":
      return "ok";
    default:
      return "neutral";
  }
}

export function riskTone(score: number | null | undefined): Tone {
  if (score === null || score === undefined) return "neutral";
  if (score >= 80) return "crit";
  if (score >= 60) return "warn";
  if (score >= 30) return "info";
  return "ok";
}

export function isImpaired(status: string | null | undefined): boolean {
  return !!status && status !== "OPERATIONAL" && status !== "MAINTENANCE";
}
