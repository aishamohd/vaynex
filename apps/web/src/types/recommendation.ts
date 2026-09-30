import type { ISODate, UUID } from "./common";

export type RecommendationPriority = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
export type RecommendationSource = "RULE_ENGINE" | "AI";
export type RecommendationStatus = "PENDING" | "ACCEPTED" | "REJECTED" | "COMPLETED";
export const RECOMMENDATION_STATUSES: RecommendationStatus[] = ["PENDING", "ACCEPTED", "REJECTED", "COMPLETED"];

export interface Recommendation {
  id: UUID;
  incident_id: UUID;
  title: string;
  description: string;
  priority: RecommendationPriority;
  source: RecommendationSource;
  status: RecommendationStatus;
  decided_by?: UUID | null;
  decided_at?: ISODate | null;
  decision_note?: string | null;
  created_at: ISODate;
  updated_at: ISODate;
}

export type RecommendationDecision = "ACCEPTED" | "REJECTED" | "COMPLETED";

export interface RecommendationUpdate {
  status: RecommendationDecision;
  note?: string | null;
}

export interface RecommendationFilters {
  incident_id?: string;
  status?: RecommendationStatus | "";
  source?: RecommendationSource | "";
  priority?: RecommendationPriority | "";
  limit?: number;
  offset?: number;
}
