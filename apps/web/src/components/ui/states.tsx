import { AlertTriangle, Loader2, RotateCw, ShieldAlert, WifiOff } from "lucide-react";
import type { ReactNode } from "react";
import { ApiError } from "@/lib/api/errors";
import { cn } from "@/lib/utils/cn";
import { Button } from "./button";

export function LoadingState({ label = "CONNECTING TO VAYNEX", className }: { label?: string; className?: string }) {
  return (
    <div className={cn("flex h-full min-h-[120px] flex-col items-center justify-center gap-3 text-muted", className)}>
      <Loader2 className="h-5 w-5 animate-spin text-cyan" />
      <span className="label animate-blink">{label}</span>
    </div>
  );
}

export function EmptyState({
  title,
  hint,
  icon,
  className,
}: {
  title: string;
  hint?: ReactNode;
  icon?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex h-full min-h-[120px] flex-col items-center justify-center gap-2 text-center", className)}>
      {icon}
      <span className="label text-ink/70">{title}</span>
      {hint && <p className="max-w-sm text-xs text-muted">{hint}</p>}
    </div>
  );
}

export function ErrorState({
  error,
  onRetry,
  title,
  className,
}: {
  error: unknown;
  onRetry?: () => void;
  title?: string;
  className?: string;
}) {
  const e = error instanceof ApiError ? error : null;
  const offline = e?.kind === "network";
  const forbidden = e?.kind === "forbidden";
  const heading = title ?? (offline ? "DATA FABRIC OFFLINE" : forbidden ? "ACCESS RESTRICTED" : "REQUEST FAILED");
  const Icon = offline ? WifiOff : forbidden ? ShieldAlert : AlertTriangle;
  return (
    <div className={cn("flex h-full min-h-[120px] flex-col items-center justify-center gap-2 p-4 text-center", className)}>
      <Icon className={cn("h-5 w-5", forbidden ? "text-amber" : "text-red")} />
      <span className={cn("label", forbidden ? "text-amber" : "text-red")}>{heading}</span>
      <p className="max-w-sm text-xs text-muted">{e ? e.humanMessage : "Something went wrong."}</p>
      {e?.requestId && <p className="font-mono text-2xs text-dim">REQ {e.requestId.slice(0, 12)}</p>}
      {onRetry && !forbidden && (
        <Button size="sm" variant="outline" onClick={onRetry} className="mt-1">
          <RotateCw className="h-3 w-3" /> Retry
        </Button>
      )}
    </div>
  );
}

/** Renders loading / error / empty / success for a query-like object. */
export function QueryView<T>({
  query,
  loadingLabel,
  empty,
  isEmpty,
  children,
  errorTitle,
}: {
  query: { data: T | undefined; isLoading: boolean; isError: boolean; error: unknown; refetch: () => unknown };
  loadingLabel?: string;
  empty?: ReactNode;
  isEmpty?: (data: T) => boolean;
  errorTitle?: string;
  children: (data: T) => ReactNode;
}) {
  if (query.isLoading) return <LoadingState label={loadingLabel} />;
  if (query.isError && query.data === undefined)
    return <ErrorState error={query.error} onRetry={() => void query.refetch()} title={errorTitle} />;
  if (query.data === undefined) return <LoadingState label={loadingLabel} />;
  if (isEmpty && isEmpty(query.data) && empty) return <>{empty}</>;
  return <>{children(query.data)}</>;
}
