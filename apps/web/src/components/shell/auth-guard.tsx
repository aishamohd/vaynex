"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { endpoints } from "@/lib/api/endpoints";
import { qk } from "@/lib/api/query-keys";
import { updateUser } from "@/lib/auth/session";
import { useHydrated, useSession } from "@/hooks/use-session";
import { LoadingState } from "@/components/ui/states";

/** Client-side guard: requires a stored JWT and re-validates it with GET /auth/me. */
export function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const hydrated = useHydrated();
  const session = useSession();

  const me = useQuery({
    queryKey: qk.me,
    queryFn: endpoints.me,
    enabled: hydrated && !!session,
    staleTime: 60_000,
  });

  useEffect(() => {
    if (hydrated && !session) router.replace("/login");
  }, [hydrated, session, router]);

  useEffect(() => {
    if (me.data) updateUser(me.data);
  }, [me.data]);

  if (!hydrated || !session) {
    return (
      <div className="flex h-screen items-center justify-center bg-bg">
        <LoadingState label="VERIFYING OPERATOR" />
      </div>
    );
  }
  return <>{children}</>;
}
