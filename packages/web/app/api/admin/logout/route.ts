import { NextResponse } from "next/server";
import { ADMIN_COOKIE } from "@/lib/admin";

/// POST /api/admin/logout — end the administrator session.
///
/// Clears the cookie, which is the whole of it: nothing is stored server-side,
/// so there is no session record to revoke.

export const dynamic = "force-dynamic";

export async function POST() {
  const response = NextResponse.json({ admin: false });
  response.cookies.set(ADMIN_COOKIE, "", { httpOnly: true, path: "/", maxAge: 0 });
  return response;
}
