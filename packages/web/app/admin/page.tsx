import Link from "next/link";
import { ArrowLeft, Layers } from "lucide-react";
import { AdminView } from "@/components/agentrail/views/admin-view";

/// /admin — the network views, on their own route. Member 4.
///
/// Unlisted rather than hidden by a permission. It was a fifth tab in the main
/// navigation, which put an administrator's door in front of every user who has
/// no business with it and no way through it. Someone who needs this knows the
/// address; nobody else is invited to wonder what they are missing.
///
/// Its own page rather than a tab, so it can be opened, bookmarked and reloaded
/// on its own — an administrator arriving at a locked screen should not have to
/// pass through somebody else's assistant to reach it.
///
/// Not a security boundary. The route renders for anyone; what refuses is the
/// sign-in inside it and, more to the point, the API routes behind each panel.

export const metadata = {
  title: "Network admin — AgentRail",
  // Unlisted is not secret, but there is no reason to help a crawler index it.
  robots: { index: false, follow: false },
};

export default function AdminPage() {
  return (
    <div className="min-h-dvh">
      <header className="masthead-in border-b border-rail/15 bg-rail text-rail-foreground">
        <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-2.5">
            <span className="flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Layers className="size-5" aria-hidden="true" />
            </span>
            <span className="font-display text-lg font-semibold tracking-tight">
              AgentRail
            </span>
            <span className="rounded-full border border-white/15 bg-white/10 px-2.5 py-0.5 text-xs font-medium text-rail-foreground/80">
              admin
            </span>
          </div>

          <Link
            href="/"
            className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 bg-white/10 px-3 py-2 text-sm font-medium transition-colors hover:bg-white/15"
          >
            <ArrowLeft className="size-4" aria-hidden="true" />
            Back to the app
          </Link>
        </div>
      </header>

      <main className="rise rise-1 mx-auto w-full max-w-7xl px-4 py-7 sm:px-6 lg:px-8 lg:py-9">
        <AdminView />
      </main>
    </div>
  );
}
