"use client";

import { useEffect, useState } from "react";
import { useAuthedFetch, useSession } from "@/lib/session";
import type { AdminRole } from "@/lib/admin";

/// Whether this person may open the network admin views. Member 4.
///
/// Asked of the server every time, and never inferred here. The browser holds no
/// rule about who is an administrator — it holds an answer, which the routes
/// serving admin data check again for themselves. Hiding a tab is a courtesy;
/// the refusal that matters happens where the data is.

export function useAdmin() {
  const { signedIn } = useSession();
  const authedFetch = useAuthedFetch();
  const [role, setRole] = useState<AdminRole>("none");
  const [reason, setReason] = useState<string | null>(null);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!signedIn) {
      setRole("none");
      setReason("sign in to open the network admin views");
      setChecked(true);
      return;
    }
    setChecked(false);
    void authedFetch("/api/admin/session")
      .then((r) => r.json())
      .then((body: { role?: AdminRole; reason?: string }) => {
        if (cancelled) return;
        setRole(body.role ?? "none");
        setReason(body.reason ?? null);
      })
      .catch(() => {
        if (!cancelled) {
          setRole("none");
          setReason("could not check admin access");
        }
      })
      .finally(() => {
        if (!cancelled) setChecked(true);
      });
    return () => {
      cancelled = true;
    };
  }, [signedIn, authedFetch]);

  return {
    role,
    admin: role !== "none",
    superadmin: role === "superadmin",
    reason,
    checked,
  };
}
