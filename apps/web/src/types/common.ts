/** Mirrors apps/api/schemas/common.py and packages/common/enums.py */
export type UUID = string;
export type ISODate = string;

export interface Page<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
}

export type Level = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
export type Criticality = Level;
export type Severity = Level;
export type RiskLevel = Level;
export type EntityKind = "INFRASTRUCTURE" | "SERVICE";

export const LEVELS: Level[] = ["LOW", "MEDIUM", "HIGH", "CRITICAL"];

export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    request_id: string | null;
    details?: { loc: string[]; msg: string; type: string }[];
  };
}

export interface HealthReady {
  status: "ready" | "degraded" | "not_ready";
  checks: {
    postgres?: { status: string; detail?: string };
    postgis?: { status: string; version?: string | null };
    redis?: { status: string };
  };
}
