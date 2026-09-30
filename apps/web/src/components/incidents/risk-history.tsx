"use client";

import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatTime } from "@/lib/utils/format";
import type { Risk } from "@/types";

export function RiskHistoryChart({ history }: { history: Risk[] }) {
  const data = [...history]
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
    .map((r) => ({ t: formatTime(r.created_at), score: r.score, level: r.level }));
  return (
    <div className="mt-2 h-28 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 6, right: 8, bottom: 0, left: -18 }}>
          <XAxis dataKey="t" tick={{ fill: "#56656F", fontSize: 10, fontFamily: "monospace" }} axisLine={{ stroke: "#1B2A38" }} tickLine={false} />
          <YAxis domain={[0, 100]} ticks={[0, 30, 60, 80, 100]} tick={{ fill: "#56656F", fontSize: 10, fontFamily: "monospace" }} axisLine={false} tickLine={false} />
          <Tooltip
            cursor={{ stroke: "#27394A" }}
            contentStyle={{ background: "#081018", border: "1px solid #1B2A38", fontFamily: "monospace", fontSize: 11 }}
            labelStyle={{ color: "#81919E" }}
            itemStyle={{ color: "#EAF2F7" }}
            formatter={(v, _n, item) => [`${String(v)} (${(item?.payload as { level?: string } | undefined)?.level ?? ""})`, "Risk"]}
          />
          <Line type="monotone" dataKey="score" stroke="#22D3EE" strokeWidth={2} dot={{ r: 4, fill: "#22D3EE", stroke: "#081018", strokeWidth: 2 }} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
