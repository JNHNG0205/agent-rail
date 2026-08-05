/// Who this request is from.
///
/// The one place the caller's identity is established, so the rule lives in a
/// single file rather than in every route. Today it reads a header the browser
/// sets, which is a claim rather than proof — anyone could name any owner. That
/// is honest for a demo and must not be described as access control.
///
/// It becomes real by verifying a signed token here — Privy issues an ES256 JWT
/// whose signature a server checks against a published key — without any route
/// or the runtime changing, because both only ever see the resolved string.
export async function ownerOf(request: Request): Promise<string | null> {
  const header = request.headers.get("x-agent-owner");
  return header && header.length > 0 ? header : null;
}
