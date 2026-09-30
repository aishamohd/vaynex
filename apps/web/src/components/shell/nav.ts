import {
  Activity,
  Boxes,
  BrainCircuit,
  ClipboardCheck,
  LayoutDashboard,
  Network,
  ScrollText,
  Siren,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  code: string;
}

export const NAV: NavItem[] = [
  { href: "/command", label: "Command Center", icon: LayoutDashboard, code: "01" },
  { href: "/command/incidents", label: "Incidents", icon: Siren, code: "02" },
  { href: "/command/infrastructure", label: "Infrastructure", icon: Boxes, code: "03" },
  { href: "/command/intelligence", label: "Intelligence", icon: BrainCircuit, code: "04" },
  { href: "/command/network", label: "Network", icon: Network, code: "05" },
  { href: "/command/simulation", label: "Simulation", icon: Activity, code: "06" },
  { href: "/command/recommendations", label: "Recommendations", icon: ClipboardCheck, code: "07" },
  { href: "/command/audit", label: "Audit", icon: ScrollText, code: "08" },
];
