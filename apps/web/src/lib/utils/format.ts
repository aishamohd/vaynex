export function humanize(value: string | null | undefined): string {
  if (!value) return "—";
  return value.replace(/_/g, " ");
}

export function shortId(id: string | null | undefined): string {
  if (!id) return "—";
  return id.slice(0, 8).toUpperCase();
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString(undefined, {
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

export function formatTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });
}

export function timeAgo(iso: string | number | null | undefined): string {
  if (iso === null || iso === undefined) return "—";
  const t = typeof iso === "number" ? iso : new Date(iso).getTime();
  if (Number.isNaN(t)) return "—";
  const s = Math.max(0, Math.round((Date.now() - t) / 1000));
  if (s < 5) return "just now";
  if (s < 60) return `${s}s ago`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
}

export function pct(value: number, digits = 0): string {
  return `${(value * 100).toFixed(digits)}%`;
}

export function formatCoord(lat: number | null | undefined, lon: number | null | undefined): string {
  if (lat === null || lat === undefined || lon === null || lon === undefined) return "—";
  return `${lat.toFixed(4)}°N, ${lon.toFixed(4)}°E`;
}
