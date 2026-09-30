import { Activity, AlertOctagon, Boxes, ClipboardList, Gauge, Radio, ServerCrash, ShieldAlert, Siren, Wrench } from "lucide-react";
import type { DashboardOverview } from "@/types";
import { Metric } from "@/components/ui/metric";
import { riskTone } from "@/lib/utils/status";

export function MetricsStrip({ d }: { d: DashboardOverview }) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-5 2xl:grid-cols-10">
      <Metric label="Total Infrastructure" value={d.total_infrastructure} icon={<Boxes className="h-3.5 w-3.5" />} tone="accent" />
      <Metric label="Operational" value={d.operational_infrastructure} icon={<Activity className="h-3.5 w-3.5" />} tone="ok" />
      <Metric
        label="Degraded"
        value={d.degraded_infrastructure}
        icon={<Wrench className="h-3.5 w-3.5" />}
        tone={d.degraded_infrastructure ? "warn" : "neutral"}
        emphasize={d.degraded_infrastructure > 0}
      />
      <Metric
        label="Failed"
        value={d.failed_infrastructure}
        icon={<ServerCrash className="h-3.5 w-3.5" />}
        tone={d.failed_infrastructure ? "crit" : "neutral"}
        emphasize={d.failed_infrastructure > 0}
      />
      <Metric label="Total Services" value={d.total_services} icon={<Radio className="h-3.5 w-3.5" />} tone="accent" />
      <Metric
        label="Disrupted Services"
        value={d.disrupted_services}
        icon={<AlertOctagon className="h-3.5 w-3.5" />}
        tone={d.disrupted_services ? "crit" : "neutral"}
        emphasize={d.disrupted_services > 0}
      />
      <Metric
        label="Active Incidents"
        value={d.active_incidents}
        icon={<Siren className="h-3.5 w-3.5" />}
        tone={d.active_incidents ? "warn" : "ok"}
      />
      <Metric
        label="Critical Incidents"
        value={d.critical_incidents}
        icon={<ShieldAlert className="h-3.5 w-3.5" />}
        tone={d.critical_incidents ? "crit" : "neutral"}
        emphasize={d.critical_incidents > 0}
      />
      <Metric
        label="Average Risk"
        value={d.average_risk.toFixed(1)}
        sub="ACTIVE INCIDENTS"
        icon={<Gauge className="h-3.5 w-3.5" />}
        tone={d.active_incidents ? riskTone(d.average_risk) : "neutral"}
      />
      <Metric
        label="Pending Recs"
        value={d.pending_recommendations}
        sub="AWAITING OPERATOR"
        icon={<ClipboardList className="h-3.5 w-3.5" />}
        tone={d.pending_recommendations ? "warn" : "neutral"}
      />
    </div>
  );
}
