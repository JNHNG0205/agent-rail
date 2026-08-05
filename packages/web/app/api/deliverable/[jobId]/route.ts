import { NextResponse } from "next/server";
import { readJobOnChain } from "@/lib/contracts";
import { runtimeUrl } from "@/lib/runtime";
import { checkDeliverable } from "@/lib/deliverable";

/// GET /api/deliverable/:jobId — the finished work. Member 4.
///
/// The provider serves the deliverable, not the chain, which only holds its
/// keccak256 hash. So this finds who produced the job, asks that agent for the
/// bytes, and re-derives the hash before returning them — a deliverable that
/// does not match what was committed on chain is not the work that was paid for,
/// and must not be shown as if it were.
///
/// The job is read from the chain, not from the indexed cache, for two reasons.
/// The hash decides whether provider-supplied bytes are shown at all, and
/// checking it against a cache means trusting the cache for a security
/// decision. And the cache lags: a job settled a moment ago, or indexed while
/// the indexer was down, would have its result reported as missing when the
/// work exists and is verifiable.
export const dynamic = "force-dynamic";

/// readJobOnChain returns unknown — the ABI is cast at that boundary — so the
/// shape is checked here rather than assumed. Only the two fields this route
/// needs: who produced the work, and what hash was committed for it.
interface OnChainJob {
  provider: `0x${string}`;
  deliverableHash: `0x${string}` | null;
}

function isOnChainJob(value: unknown): value is OnChainJob {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return typeof v.provider === "string" && v.provider.startsWith("0x");
}

interface DirectoryEntry {
  id: string;
  address: string;
  service: { deliverable?: string } | null;
}

/// How the bytes are served depends on what the provider said it produces.
/// Serving Markdown as image/svg+xml would simply fail to render, and guessing
/// from the content would mean sniffing provider-supplied bytes to decide how to
/// treat them — which is the thing nosniff exists to prevent.
const CONTENT_TYPES: Record<string, string> = {
  svg: "image/svg+xml",
  markdown: "text/markdown; charset=utf-8",
  text: "text/plain; charset=utf-8",
};

/// So a saved file opens in the right thing. A poster saved without .svg is a
/// file the operating system cannot place.
const EXTENSIONS: Record<string, string> = {
  svg: "svg",
  markdown: "md",
  text: "txt",
};

export async function GET(
  request: Request,
  { params }: { params: { jobId: string } },
) {
  if (!/^\d+$/.test(params.jobId)) {
    return NextResponse.json({ error: "jobId must be a number" }, { status: 400 });
  }

  // Opt-in, because the same URL feeds the preview frame. Sending
  // Content-Disposition: attachment unconditionally would make every preview
  // download a file instead of rendering.
  const download = new URL(request.url).searchParams.get("download") === "1";

  try {
    const onChain = await readJobOnChain(BigInt(params.jobId));
    if (!isOnChainJob(onChain)) {
      return NextResponse.json({ error: `no job ${params.jobId}` }, { status: 404 });
    }
    const job = onChain;
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
    const kind = agent.service?.deliverable ?? "svg";
    // Built from the job id, which is digits — nothing provider-supplied reaches
    // this header, so there is no filename to escape and no header to inject.
    const filename = `agentrail-job-${params.jobId}.${EXTENSIONS[kind] ?? "txt"}`;

    return new NextResponse(check.content, {
      status: 200,
      headers: {
        "content-type": CONTENT_TYPES[kind] ?? CONTENT_TYPES.svg!,
        // So the browser can decide how to show it without sniffing the bytes.
        "x-deliverable-kind": kind,
        "content-disposition": `${download ? "attachment" : "inline"}; filename="${filename}"`,
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
