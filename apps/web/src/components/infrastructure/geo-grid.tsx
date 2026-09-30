"use client";

import { useMemo } from "react";
import { statusTone, TONE_HEX } from "@/lib/utils/status";
import type { Infrastructure } from "@/types";

/**
 * Plots infrastructure at its real latitude/longitude on a technical grid.
 * No basemap tiles are needed (Mapbox is optional and not required).
 */
export function GeoGrid({
  items,
  selectedId,
  onSelect,
}: {
  items: Infrastructure[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const geo = items.filter((i) => i.latitude !== null && i.longitude !== null);
  const bounds = useMemo(() => {
    if (!geo.length) return null;
    const lats = geo.map((g) => g.latitude as number);
    const lons = geo.map((g) => g.longitude as number);
    const pad = 0.006;
    return {
      minLat: Math.min(...lats) - pad,
      maxLat: Math.max(...lats) + pad,
      minLon: Math.min(...lons) - pad,
      maxLon: Math.max(...lons) + pad,
    };
  }, [geo]);

  if (!bounds) return <p className="p-4 text-xs text-muted">No coordinates available.</p>;
  const W = 600;
  const H = 380;
  const latC = (bounds.minLat + bounds.maxLat) / 2;
  const k = Math.cos((latC * Math.PI) / 180);
  const spanX = (bounds.maxLon - bounds.minLon) * k;
  const spanY = bounds.maxLat - bounds.minLat;
  const s = Math.min(W / spanX, H / spanY);
  const ox = (W - spanX * s) / 2;
  const oy = (H - spanY * s) / 2;
  const px = (lon: number) => ox + (lon - bounds.minLon) * k * s;
  const py = (lat: number) => oy + (bounds.maxLat - lat) * s;

  const gridLines = 8;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-full w-full">
      {Array.from({ length: gridLines + 1 }, (_, i) => (
        <g key={i}>
          <line x1={(W / gridLines) * i} y1={0} x2={(W / gridLines) * i} y2={H} stroke="#1B2A38" strokeWidth={0.5} />
          <line x1={0} y1={(H / gridLines) * i} x2={W} y2={(H / gridLines) * i} stroke="#1B2A38" strokeWidth={0.5} />
        </g>
      ))}
      <text x={6} y={12} fill="#56656F" fontSize={9} fontFamily="monospace">
        {bounds.maxLat.toFixed(3)}°N
      </text>
      <text x={6} y={H - 6} fill="#56656F" fontSize={9} fontFamily="monospace">
        {bounds.minLat.toFixed(3)}°N · {bounds.minLon.toFixed(3)}°E
      </text>
      <text x={W - 6} y={H - 6} fill="#56656F" fontSize={9} fontFamily="monospace" textAnchor="end">
        {bounds.maxLon.toFixed(3)}°E
      </text>
      {geo.map((g) => {
        const x = px(g.longitude as number);
        const y = py(g.latitude as number);
        const color = TONE_HEX[statusTone(g.status)];
        const sel = g.id === selectedId;
        const alarm = g.status === "FAILED" || g.status === "DEGRADED";
        return (
          <g key={g.id} onClick={() => onSelect(g.id)} className="cursor-pointer">
            {alarm && (
              <circle cx={x} cy={y} r={8} fill="none" stroke={color}>
                <animate attributeName="r" from={6} to={22} dur="1.8s" repeatCount="indefinite" />
                <animate attributeName="opacity" from="0.9" to="0" dur="1.8s" repeatCount="indefinite" />
              </circle>
            )}
            <circle cx={x} cy={y} r={sel ? 7 : 5} fill={color} fillOpacity={0.9} stroke={sel ? "#EAF2F7" : "#03060A"} strokeWidth={1.5} />
            <text x={x + 10} y={y + 3} fill={sel ? "#EAF2F7" : "#81919E"} fontSize={10} fontFamily="monospace">
              {g.name}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
