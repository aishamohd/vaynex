/** One function per backend endpoint used by the UI (see docs/frontend-backend-contract.md). */
import { api } from "./client";
import type {
  AnalyzeIncidentResponse,
  AuditFilters,
  AuditLog,
  DashboardOverview,
  Dependency,
  DependencyGraph,
  EventCreate,
  EventProcessingResult,
  HealthReady,
  Incident,
  IncidentDetail,
  IncidentFilters,
  IncidentResolveRequest,
  Infrastructure,
  InfrastructureDependencies,
  InfrastructureFilters,
  LoginRequest,
  Organization,
  Page,
  ProviderInfo,
  PublicService,
  Recommendation,
  RecommendationFilters,
  RecommendationUpdate,
  Risk,
  RiskEvaluateRequest,
  RiskEvaluateResponse,
  RiskHistory,
  ScenarioInfo,
  SimulationRunRequest,
  SimulationRunResponse,
  TokenResponse,
  User,
  VaynexEvent,
} from "@/types";

type Q = Record<string, string | number | boolean | undefined>;

export const endpoints = {
  // Health
  health: () => api.get<{ status: string }>("/health", { anonymous: true }),
  ready: () => api.get<HealthReady>("/health/ready", { anonymous: true }),

  // Auth
  login: (body: LoginRequest) =>
    api.post<TokenResponse>("/auth/login", body, { anonymous: true, suppressAuthRedirect: true }),
  me: () => api.get<User>("/auth/me"),

  // Dashboard
  dashboard: () => api.get<DashboardOverview>("/dashboard/overview"),

  // Organizations
  organizations: () => api.get<Page<Organization>>("/organizations", { query: { limit: 200 } }),

  // Infrastructure
  infrastructureList: (f: InfrastructureFilters = {}) =>
    api.get<Page<Infrastructure>>("/infrastructure", { query: { limit: 200, ...f } as Q }),
  infrastructure: (id: string) => api.get<Infrastructure>(`/infrastructure/${id}`),
  infrastructureDependencies: (id: string) =>
    api.get<InfrastructureDependencies>(`/infrastructure/${id}/dependencies`),

  // Services
  services: (q: Q = {}) => api.get<Page<PublicService>>("/services", { query: { limit: 200, ...q } }),

  // Dependencies
  dependencyGraph: () => api.get<DependencyGraph>("/dependencies/graph"),
  dependencies: (q: Q = {}) => api.get<Page<Dependency>>("/dependencies", { query: { limit: 200, ...q } }),

  // Events
  createEvent: (body: EventCreate) => api.post<EventProcessingResult>("/events", body),
  events: (q: Q = {}) => api.get<Page<VaynexEvent>>("/events", { query: { limit: 50, ...q } }),

  // Incidents
  incidents: (f: IncidentFilters = {}) =>
    api.get<Page<Incident>>("/incidents", { query: { limit: 100, ...f } as Q }),
  incident: (id: string) => api.get<IncidentDetail>(`/incidents/${id}`),
  resolveIncident: (id: string, body: IncidentResolveRequest) =>
    api.post<IncidentDetail>(`/incidents/${id}/resolve`, body),

  // Risk
  incidentRisk: (id: string) => api.get<RiskHistory>(`/risk/incidents/${id}`),
  recalculateRisk: (id: string) => api.post<Risk>(`/risk/incidents/${id}/recalculate`),
  evaluateRisk: (body: RiskEvaluateRequest) => api.post<RiskEvaluateResponse>("/risk/evaluate", body),

  // Intelligence
  analyzeIncident: (id: string) => api.post<AnalyzeIncidentResponse>(`/intelligence/analyze/${id}`),
  provider: () => api.get<ProviderInfo>("/intelligence/provider"),

  // Recommendations
  recommendations: (f: RecommendationFilters = {}) =>
    api.get<Page<Recommendation>>("/recommendations", { query: { limit: 200, ...f } as Q }),
  decideRecommendation: (id: string, body: RecommendationUpdate) =>
    api.patch<Recommendation>(`/recommendations/${id}`, body),

  // Simulation
  scenarios: () => api.get<ScenarioInfo[]>("/simulation/scenarios"),
  runSimulation: (body: SimulationRunRequest) => api.post<SimulationRunResponse>("/simulation/run", body),

  // Audit
  audit: (f: AuditFilters = {}) => api.get<Page<AuditLog>>("/audit", { query: { limit: 200, ...f } as Q }),
};
