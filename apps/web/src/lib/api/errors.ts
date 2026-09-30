import type { ApiErrorBody } from "@/types";

export type ApiErrorKind =
  | "network"
  | "unauthorized"
  | "forbidden"
  | "not_found"
  | "conflict"
  | "validation"
  | "server"
  | "bad_request"
  | "unknown";

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly requestId: string | null;
  readonly details: { loc: string[]; msg: string; type: string }[] | undefined;
  readonly kind: ApiErrorKind;

  constructor(opts: {
    status: number;
    code: string;
    message: string;
    requestId?: string | null;
    details?: { loc: string[]; msg: string; type: string }[];
  }) {
    super(opts.message);
    this.name = "ApiError";
    this.status = opts.status;
    this.code = opts.code;
    this.requestId = opts.requestId ?? null;
    this.details = opts.details;
    this.kind = kindFor(opts.status);
  }

  /** Short, human-readable message suitable for UI (never a stack trace). */
  get humanMessage(): string {
    switch (this.kind) {
      case "network":
        return "Cannot reach the Vaynex API. Check that the backend is running.";
      case "unauthorized":
        return this.code === "INVALID_CREDENTIALS" ? "Invalid email or password." : "Your session has expired. Sign in again.";
      case "forbidden":
        return this.message || "Your role does not permit this action.";
      case "validation": {
        if (this.details && this.details.length) {
          const first = this.details[0];
          const field = first.loc.filter((p) => p !== "body").join(".");
          return field ? `${field}: ${first.msg}` : first.msg;
        }
        return this.message || "The request was not valid.";
      }
      case "server":
        return "The Vaynex API hit an unexpected error.";
      default:
        return this.message || "Request failed.";
    }
  }
}

function kindFor(status: number): ApiErrorKind {
  if (status === 0) return "network";
  if (status === 401) return "unauthorized";
  if (status === 403) return "forbidden";
  if (status === 404) return "not_found";
  if (status === 409) return "conflict";
  if (status === 422) return "validation";
  if (status === 400) return "bad_request";
  if (status >= 500) return "server";
  return "unknown";
}

export function isApiErrorBody(value: unknown): value is ApiErrorBody {
  return (
    typeof value === "object" &&
    value !== null &&
    "error" in value &&
    typeof (value as { error: unknown }).error === "object" &&
    (value as { error: { code?: unknown } }).error !== null &&
    typeof (value as { error: { code?: unknown } }).error.code === "string"
  );
}

export function toApiError(err: unknown): ApiError {
  if (err instanceof ApiError) return err;
  return new ApiError({ status: 0, code: "NETWORK_ERROR", message: "Network error" });
}

export function errorMessage(err: unknown): string {
  if (err instanceof ApiError) return err.humanMessage;
  return "Something went wrong.";
}
