import { NextResponse } from "next/server";
import { checkAdmin } from "@/lib/admin";

/// GET /api/admin/session — may this caller open the network admin views?
///
/// The decision is made here and not in the browser. A page can hide a tab, and
/// a page can be told to stop hiding it; what matters is that the routes serving
/// admin-only data ask this same function, so refusing in the interface and
/// refusing at the source are one rule rather than two.
///
/// Returns 200 with `admin: false` rather than 401. This is a question, not an
/// attempt — the ordinary answer for almost everyone is "no", and an error
/// status would make a normal page load look like a failure.

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const result = await checkAdmin(request);
    return NextResponse.json(result);
  } catch (err) {
    console.error("[api/admin/session]", err);
    return NextResponse.json({ error: "could not check admin access" }, { status: 500 });
  }
}
