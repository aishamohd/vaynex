import { API_PREFIX } from "./config";
import { ApiError, isApiErrorBody } from "./errors";
import { getToken, handleUnauthorized } from "@/lib/auth/session";

type Query = Record<string, string | number | boolean | null | undefined>;

interface RequestOptions {
  query?: Query;
  body?: unknown;
  signal?: AbortSignal;
  /** Skip the Authorization header (login). */
  anonymous?: boolean;
  /** Do not trigger the global "session expired" redirect on 401 (login form). */
  suppressAuthRedirect?: boolean;
}

function buildUrl(path: string, query?: Query): string {
  const url = `${API_PREFIX}${path.startsWith("/") ? path : `/${path}`}`;
  if (!query) return url;
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) {
    if (v === undefined || v === null || v === "") continue;
    params.set(k, String(v));
  }
  const qs = params.toString();
  return qs ? `${url}?${qs}` : url;
}

async function request<T>(method: string, path: string, opts: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = { Accept: "application/json" };
  if (opts.body !== undefined) headers["Content-Type"] = "application/json";
  if (!opts.anonymous) {
    const token = getToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  let res: Response;
  try {
    res = await fetch(buildUrl(path, opts.query), {
      method,
      headers,
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
      signal: opts.signal,
      cache: "no-store",
    });
  } catch (err) {
    if ((err as { name?: string })?.name === "AbortError") throw err;
    throw new ApiError({ status: 0, code: "NETWORK_ERROR", message: "Network error" });
  }

  if (res.status === 204) return undefined as T;

  let data: unknown = null;
  const text = await res.text();
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = null;
    }
  }

  if (!res.ok) {
    const requestId = res.headers.get("X-Request-ID");
    const apiErr = isApiErrorBody(data)
      ? new ApiError({
          status: res.status,
          code: data.error.code,
          message: data.error.message,
          requestId: data.error.request_id ?? requestId,
          details: data.error.details,
        })
      : new ApiError({ status: res.status, code: `HTTP_${res.status}`, message: res.statusText, requestId });
    if (res.status === 401 && !opts.suppressAuthRedirect) handleUnauthorized();
    throw apiErr;
  }
  return data as T;
}

export const api = {
  get: <T>(path: string, opts?: Omit<RequestOptions, "body">) => request<T>("GET", path, opts),
  post: <T>(path: string, body?: unknown, opts?: Omit<RequestOptions, "body">) =>
    request<T>("POST", path, { ...opts, body }),
  patch: <T>(path: string, body?: unknown, opts?: Omit<RequestOptions, "body">) =>
    request<T>("PATCH", path, { ...opts, body }),
  delete: <T>(path: string, opts?: Omit<RequestOptions, "body">) => request<T>("DELETE", path, opts),
};
