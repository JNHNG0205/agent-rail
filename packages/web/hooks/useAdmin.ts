"use client";

import { useCallback, useEffect, useState } from "react";

/// Whether this browser is signed in as the administrator. Member 4.
///
/// Asked of the server and never inferred here. The session is an HttpOnly
/// cookie, so this hook could not read it even if it wanted to — which is the
/// arrangement that makes "hide the tab" a courtesy rather than the control.
/// Every route behind the admin views checks the same cookie for itself.
///
/// Deliberately not tied to the Privy session. The administrator is one seeded
/// account, unrelated to whoever is signed in as a user, and someone may well be
/// both at once.

export function useAdmin() {
  const [admin, setAdmin] = useState(false);
  const [reason, setReason] = useState<string | null>(null);
  const [checked, setChecked] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/session");
      const body = (await res.json()) as { admin?: boolean; reason?: string };
      setAdmin(body.admin === true);
      setReason(body.reason ?? null);
    } catch {
      setAdmin(false);
      setReason("could not check admin access");
    } finally {
      setChecked(true);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const signIn = useCallback(
    async (email: string, password: string): Promise<string | null> => {
      try {
        const res = await fetch("/api/admin/login", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ email, password }),
        });
        const body = (await res.json()) as { admin?: boolean; error?: string };
        if (!res.ok || body.error) return body.error ?? "could not sign in";
        await refresh();
        return null;
      } catch {
        return "could not reach the server";
      }
    },
    [refresh],
  );

  const signOut = useCallback(async () => {
    await fetch("/api/admin/logout", { method: "POST" });
    await refresh();
  }, [refresh]);

  return { admin, reason, checked, signIn, signOut, refresh };
}
