import { NextResponse } from "next/server";
import { ADMIN_COOKIE, issueSession, verifyCredentials } from "@/lib/admin";

/// POST /api/admin/login — the one administrator signs in. Member 4.
///
/// The cookie is HttpOnly, so the page that sets it cannot read it back. That is
/// the point: script on the page has no way to leak the session, and every check
/// happens on the server anyway.
///
/// One failure message for a wrong email and a wrong password alike. Telling
/// somebody which half they got right narrows their next guess for nothing.

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "expected a JSON body" }, { status: 400 });
  }

  const { email, password } = (body ?? {}) as { email?: unknown; password?: unknown };
  if (typeof email !== "string" || typeof password !== "string") {
    return NextResponse.json({ error: "email and password are required" }, { status: 400 });
  }

  if (!(await verifyCredentials(email, password))) {
    return NextResponse.json({ error: "that email and password do not match" }, { status: 401 });
  }

  const session = await issueSession(email);
  if (!session) {
    return NextResponse.json({ error: "could not start a session" }, { status: 500 });
  }
  const response = NextResponse.json({ admin: true });
  response.cookies.set(ADMIN_COOKIE, session.value, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: session.maxAge,
    // Off on localhost, which is where this runs; a cookie marked secure is
    // never sent over plain http and the sign-in would silently never stick.
    secure: process.env.NODE_ENV === "production",
  });
  return response;
}
