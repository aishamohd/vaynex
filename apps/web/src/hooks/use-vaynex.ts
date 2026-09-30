"use client";

import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { endpoints } from "@/lib/api/endpoints";
import { qk } from "@/lib/api/query-keys";
import type {
  AuditFilters,
  EventCreate,
  IncidentFilters,
  IncidentResolveRequest,
  InfrastructureFilters,
  RecommendationFilters,
  RecommendationUpdate,
  SimulationRunRequest,
} from "@/types";

/* ----------------------------- queries ----------------------------- */

export const useReady = () =>
  useQuery({ queryKey: qk.ready, queryFn: endpoints.ready, refetchInterval: 20_000, retry: 0 });

export const useProvider = () => useQuery({ queryKey: qk.provider, queryFn: endpoints.provider, staleTime: 60_000 });

export const useDashboard = () =>
  useQuery({ queryKey: qk.dashboard, queryFn: endpoints.dashboard, refetchInterval: 15_000 });

export const useOrganizations = () =>
  useQuery({ queryKey: qk.organizations, queryFn: endpoints.organizations, staleTime: 5 * 60_000 });

export const useInfrastructureList = (f: InfrastructureFilters) =>
  useQuery({ queryKey: qk.infrastructureList(f), queryFn: () => endpoints.infrastructureList(f) });

export const useInfrastructure = (id: string | null) =>
  useQuery({
    queryKey: qk.infrastructureItem(id ?? ""),
    queryFn: () => endpoints.infrastructure(id as string),
    enabled: !!id,
  });

export const useInfrastructureDeps = (id: string | null) =>
  useQuery({
    queryKey: qk.infrastructureDeps(id ?? ""),
    queryFn: () => endpoints.infrastructureDependencies(id as string),
    enabled: !!id,
  });

export const useServices = () => useQuery({ queryKey: qk.services, queryFn: () => endpoints.services() });

export const useGraph = () =>
  useQuery({ queryKey: qk.graph, queryFn: endpoints.dependencyGraph, refetchInterval: 20_000 });

export const useIncidents = (f: IncidentFilters) =>
  useQuery({ queryKey: qk.incidentList(f), queryFn: () => endpoints.incidents(f), refetchInterval: 15_000 });

export const useIncident = (id: string | null) =>
  useQuery({ queryKey: qk.incident(id ?? ""), queryFn: () => endpoints.incident(id as string), enabled: !!id });

export const useIncidentRisk = (id: string | null) =>
  useQuery({ queryKey: qk.risk(id ?? ""), queryFn: () => endpoints.incidentRisk(id as string), enabled: !!id });

export const useRecommendations = (f: RecommendationFilters, enabled = true) =>
  useQuery({ queryKey: qk.recommendationList(f), queryFn: () => endpoints.recommendations(f), enabled });

export const useScenarios = () =>
  useQuery({ queryKey: qk.scenarios, queryFn: endpoints.scenarios, staleTime: 5 * 60_000 });

export const useAudit = (f: AuditFilters, enabled = true) =>
  useQuery({ queryKey: qk.auditList(f), queryFn: () => endpoints.audit(f), enabled, refetchInterval: 20_000 });

/* ---------------------------- mutations ---------------------------- */

function invalidate(qc: QueryClient, keys: readonly (readonly unknown[])[]) {
  return Promise.all(keys.map((queryKey) => qc.invalidateQueries({ queryKey })));
}

/** Everything a pipeline run (event / simulation) can change. */
const PIPELINE_KEYS = [qk.dashboard, qk.incidents, qk.infrastructure, qk.services, qk.graph, qk.recommendations, qk.audit];

export function useCreateEvent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: EventCreate) => endpoints.createEvent(body),
    onSuccess: () => invalidate(qc, PIPELINE_KEYS),
  });
}

export function useRunSimulation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: SimulationRunRequest) => endpoints.runSimulation(body),
    onSuccess: () => invalidate(qc, PIPELINE_KEYS),
  });
}

export function useResolveIncident() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: IncidentResolveRequest }) => endpoints.resolveIncident(id, body),
    onSuccess: (data) => {
      qc.setQueryData(qk.incident(data.id), data);
      return invalidate(qc, [...PIPELINE_KEYS, qk.risk(data.id)]);
    },
  });
}

export function useDecideRecommendation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: RecommendationUpdate }) =>
      endpoints.decideRecommendation(id, body),
    onSuccess: (rec) =>
      invalidate(qc, [qk.recommendations, qk.incident(rec.incident_id), qk.incidents, qk.dashboard, qk.audit]),
  });
}

export function useAnalyzeIncident() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => endpoints.analyzeIncident(id),
    onSuccess: (res) =>
      invalidate(qc, [qk.incident(res.incident_id), qk.recommendations, qk.dashboard, qk.audit]),
  });
}

export function useRecalculateRisk() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => endpoints.recalculateRisk(id),
    onSuccess: (risk) => invalidate(qc, [qk.risk(risk.incident_id), qk.incident(risk.incident_id), qk.dashboard, qk.audit]),
  });
}
