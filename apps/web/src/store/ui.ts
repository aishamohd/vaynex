"use client";

import { create } from "zustand";
import type { SimulationRunResponse } from "@/types";

/** UI-only state. Server data stays in TanStack Query. */
export type SimulationPhase = "idle" | "requesting" | "playing" | "complete" | "error";

interface Highlight {
  /** Node ids affected by the latest pipeline run (infra + services). */
  affected: string[];
  /** The origin node id (event source). */
  origin: string | null;
  /** Path order (names) for propagation animation, from ImpactNode.path. */
  depthById: Record<string, number>;
}

interface UIState {
  sidebarCollapsed: boolean;
  toggleSidebar: () => void;

  selectedNodeId: string | null;
  selectNode: (id: string | null) => void;

  selectedIncidentId: string | null;
  selectIncident: (id: string | null) => void;

  // Simulation / demo
  simulationPhase: SimulationPhase;
  activeStep: number; // index into result.timeline, -1 = none
  lastSimulation: SimulationRunResponse | null;
  demoMode: boolean;
  highlight: Highlight;
  setSimulationPhase: (p: SimulationPhase) => void;
  setActiveStep: (i: number) => void;
  setSimulationResult: (r: SimulationRunResponse | null) => void;
  setDemoMode: (on: boolean) => void;
  setHighlight: (h: Highlight) => void;
  clearHighlight: () => void;

  lastSync: number | null;
  markSync: () => void;
}

const EMPTY_HIGHLIGHT: Highlight = { affected: [], origin: null, depthById: {} };

export const useUI = create<UIState>((set) => ({
  sidebarCollapsed: false,
  toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),

  selectedNodeId: null,
  selectNode: (id) => set({ selectedNodeId: id }),

  selectedIncidentId: null,
  selectIncident: (id) => set({ selectedIncidentId: id }),

  simulationPhase: "idle",
  activeStep: -1,
  lastSimulation: null,
  demoMode: false,
  highlight: EMPTY_HIGHLIGHT,
  setSimulationPhase: (simulationPhase) => set({ simulationPhase }),
  setActiveStep: (activeStep) => set({ activeStep }),
  setSimulationResult: (lastSimulation) => set({ lastSimulation }),
  setDemoMode: (demoMode) => set({ demoMode }),
  setHighlight: (highlight) => set({ highlight }),
  clearHighlight: () => set({ highlight: EMPTY_HIGHLIGHT }),

  lastSync: null,
  markSync: () => set({ lastSync: Date.now() }),
}));
