import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { runtimeUrl } from "@/lib/runtime";
import { checkDeliverable } from "@/lib/deliverable";

/// GET /api/deliverable/:jobId — the finished work, as SVG. Member 4.
///
/// The provider serves the deliverable, not the chain, which only holds its
/// keccak256 hash. So this finds who produced the job, asks that agent for the
/// bytes, and re-derives the hash before returning them — a deliverable that
/// does not match what was committed on chain is not the work that was paid for,
/// and must not be shown as if it were.
export const dynamic = "force-dynamic";

interface ProviderRow {
  provider: string;
  deliverableHash: string | null;
}

interface DirectoryEntry {
  id: string;
  address: string;
}

export async function GET(
  _request: Request,
  { params }: { params: { jobId: string } },
) {
  if (!/^\d+$/.test(params.jobId)) {
    return NextResponse.json({ error: "jobId must be a number" }, { status: 400 });
  }

  try {
    const rows = await query<ProviderRow>(
      `SELECT provider, deliverable_hash AS "deliverableHash" FROM job WHERE id = $1`,
      [params.jobId],
    );
    const job = rows[0];
    if (!job) {
      return NextResponse.json({ error: `no job ${params.jobId}` }, { status: 404 });
    }
    const directory = (await (await fetch(`${runtimeUrl()}/agents`, { cache: "no-store" })).json()) as
      | DirectoryEntry[]
      | { error: string };
    if (!Array.isArray(directory)) {
      return NextResponse.json({ error: "the agent runtime is not reachable" }, { status: 503 });
    }
    const agent = directory.find(
      (a) => a.address.toLowerCase() === job.provider.toLowerCase(),
    );
    if (!agent) {
      return NextResponse.json(
        { error: `no hosted agent serves ${job.provider}` },
        { status: 404 },
      );
    }

    const res = await fetch(
      `${runtimeUrl()}/agents/${agent.id}/deliverable/${params.jobId}`,
      { cache: "no-store" },
    );
    const served = res.ok ? await res.text() : null;

    // The chain holds the hash; the provider holds the bytes. Checking them
    // against each other is what makes provider-supplied content safe to show —
    // see lib/deliverable.
    const check = checkDeliverable({
      jobId: params.jobId,
      onChainHash: job.deliverableHash,
      served,
    });
    if (!check.ok) {
      const { ok: _ok, status, ...body } = check;
      return NextResponse.json(body, { status });
    }
    const svg = check.svg;

    return new NextResponse(svg, {
      status: 200,
      headers: {
        "content-type": "image/svg+xml",
        // Untrusted provider output. Served as a document rather than inline
        // markup so a script inside it cannot run against this origin.
        "content-security-policy": "default-src 'none'; style-src 'unsafe-inline'",
        "x-content-type-options": "nosniff",
      },
    });
  } catch (err) {
    console.error("[api/deliverable]", err);
    return NextResponse.json({ error: "failed to load the deliverable" }, { status: 500 });
  }
}
