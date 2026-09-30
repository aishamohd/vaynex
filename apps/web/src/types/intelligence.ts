import type { UUID } from "./common";
import type { Recommendation } from "./recommendation";

export interface AIAction {
  title: string;
  description: string;
  priority: string;
}

export interface AIAnalysis {
  summary: string;
  potential_impact: string[];
  affected_services: string[];
  recommended_actions: AIAction[];
  /** Backend-generated evidence basis (graph + risk facts). Not model chain-of-thought. */
  reasoning: string;
  confidence: number;
  provider: string;
  model: string | null;
  advisory_only: boolean;
}

export interface AnalyzeIncidentResponse {
  incident_id: UUID;
  ai_analysis: AIAnalysis;
  new_recommendations: Recommendation[];
}

export interface ProviderInfo {
  provider: string;
  model: string | null;
  external: boolean;
}
