import { createHmac, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { query } from "./db";

/// The administrator account. Member 4.
///
/// A row in the database, not a value in the environment. An env credential
/// cannot be changed without editing a file and restarting the server, has no
/// record of when it was created or last used, and puts a password in plain text
/// on disk next to variables that get pasted into terminals.
///
/// Lives in its own `app` schema. The other two are spoken for: Ponder owns
/// `public` and drops it on a configuration change, which would take the
/// administrator with it, and `runtime` belongs to the agents. A third schema is
/// cheaper than either of those mistakes.
///
/// Passwords are stored as a scrypt hash with a per-row salt, so the table is not
/// a list of passwords. Verification is constant-time.
///
/// The session is a signed cookie rather than a stored row: an expiry and an HMAC
/// over it, keyed by the account's own password hash. Nothing has to be cleaned
/// up, and changing a password invalidates every session issued under the old one
/// without needing a revocation list.
///
/// Honest about strength. This gates an interface rather than a secret — jobs and
/// verdicts are public on chain and reconstructible without this application. The
/// exception is the evaluator's written reasoning, which is stored off chain and
/// served nowhere else. There is no rate limiting.

export const ADMIN_COOKIE = "agentrail_admin";

/// Eight hours: long enough for a working session, short enough that a browser
/// left open somewhere does not stay signed in indefinitely.
const SESSION_SECONDS = 8 * 60 * 60;

const SCRYPT_KEYLEN = 64;

interface AdminRow {
  email: string;
  password_hash: string;
}

let schemaReady: Promise<void> | undefined;

/// Created on first use rather than by a migration step, so a fresh clone needs
/// no extra command before `admin:create` works.
export function ensureAdminSchema(): Promise<void> {
  schemaReady ??= (async () => {
    await query(`CREATE SCHEMA IF NOT EXISTS app`);
    await query(`
      CREATE TABLE IF NOT EXISTS app.admin_user (
        email         text        PRIMARY KEY,
        password_hash text        NOT NULL,
        created_at    timestamptz NOT NULL DEFAULT now(),
        last_login_at timestamptz
      )
    `);
  })();
  return schemaReady;
}

/// `salt:derived`, both hex. Salted per row, so two administrators choosing the
/// same password do not share a hash.
export function hashPassword(password: string): string {
  const salt = randomBytes(16);
  const derived = scryptSync(password, salt, SCRYPT_KEYLEN);
  return `${salt.toString("hex")}:${derived.toString("hex")}`;
}

export function passwordMatches(password: string, stored: string): boolean {
  const [saltHex, expectedHex] = stored.split(":");
  if (!saltHex || !expectedHex) return false;
  let expected: Buffer;
  try {
    expected = Buffer.from(expectedHex, "hex");
  } catch {
    return false;
  }
  if (expected.length !== SCRYPT_KEYLEN) return false;
  const actual = scryptSync(password, Buffer.from(saltHex, "hex"), SCRYPT_KEYLEN);
  return timingSafeEqual(actual, expected);
}

export function normaliseEmail(email: string): string {
  return email.trim().toLowerCase();
}

export async function createAdmin(email: string, password: string): Promise<void> {
  await ensureAdminSchema();
  await query(
    `INSERT INTO app.admin_user (email, password_hash)
          VALUES ($1, $2)
     ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash`,
    [normaliseEmail(email), hashPassword(password)],
  );
}

export async function adminCount(): Promise<number> {
  await ensureAdminSchema();
  const rows = await query<{ count: string }>(`SELECT count(*)::text AS count FROM app.admin_user`);
  return Number(rows[0]?.count ?? 0);
}

async function findAdmin(email: string): Promise<AdminRow | undefined> {
  await ensureAdminSchema();
  const rows = await query<AdminRow>(
    `SELECT email, password_hash FROM app.admin_user WHERE email = $1`,
    [normaliseEmail(email)],
  );
  return rows[0];
}

/// Keyed by the stored hash, which is why a password change signs that account
/// out everywhere without any extra bookkeeping.
function sign(email: string, passwordHash: string, expiresAt: number): string {
  return createHmac("sha256", passwordHash).update(`${email}:${expiresAt}`).digest("hex");
}

export interface Session {
  value: string;
  maxAge: number;
}

export async function issueSession(
  email: string,
  nowSeconds = Math.floor(Date.now() / 1000),
): Promise<Session | null> {
  const row = await findAdmin(email);
  if (!row) return null;
  const expiresAt = nowSeconds + SESSION_SECONDS;
  const mac = sign(row.email, row.password_hash, expiresAt);
  // The email travels in the cookie so the signature can be checked against the
  // right account's hash; it is signed over too, so it cannot be swapped.
  //
  // base64url, not encodeURIComponent. Its alphabet has no dot, so the delimiter
  // stays unambiguous even though addresses contain them — and nothing here
  // needs percent-escaping, which is what broke this first time round: the value
  // was encoded here and encoded again by the cookie API, so `@` arrived as
  // `%2540` and matched no account.
  const value = `${Buffer.from(row.email).toString("base64url")}.${expiresAt}.${mac}`;
  return { value, maxAge: SESSION_SECONDS };
}

export async function sessionEmail(
  cookieValue: string | undefined,
  nowSeconds = Math.floor(Date.now() / 1000),
): Promise<string | null> {
  if (!cookieValue) return null;
  const [rawEmail, rawExpiry, mac] = cookieValue.split(".");
  if (!rawEmail || !rawExpiry || !mac) return null;

  const expiresAt = Number(rawExpiry);
  if (!Number.isInteger(expiresAt) || expiresAt <= nowSeconds) return null;

  const email = Buffer.from(rawEmail, "base64url").toString("utf8");
  const row = await findAdmin(email);
  if (!row) return null;

  const expected = sign(row.email, row.password_hash, expiresAt);
  const a = Buffer.from(mac);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  return row.email;
}

export async function verifyCredentials(email: string, password: string): Promise<boolean> {
  const row = await findAdmin(email);
  if (!row) {
    // Hash anyway, so a missing account and a wrong password take roughly the
    // same time and the response does not say which it was.
    scryptSync(password, randomBytes(16), SCRYPT_KEYLEN);
    return false;
  }
  if (!passwordMatches(password, row.password_hash)) return false;
  await query(`UPDATE app.admin_user SET last_login_at = now() WHERE email = $1`, [row.email]);
  return true;
}

function cookieFrom(header: string | null, name: string): string | undefined {
  if (!header) return undefined;
  for (const part of header.split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key === name) return rest.join("=");
  }
  return undefined;
}

export interface AdminCheck {
  admin: boolean;
  email: string | null;
  /// Why, in words a person can act on. Shown to whoever was refused.
  reason: string;
}

export async function checkAdmin(request: Request): Promise<AdminCheck> {
  try {
    const email = await sessionEmail(cookieFrom(request.headers.get("cookie"), ADMIN_COOKIE));
    if (email) {
      return { admin: true, email, reason: "signed in as the administrator" };
    }
    if ((await adminCount()) === 0) {
      return {
        admin: false,
        email: null,
        reason: "no administrator account has been set up",
      };
    }
    return { admin: false, email: null, reason: "sign in with the administrator account" };
  } catch (err) {
    // A database that will not answer denies. A check that falls open when
    // Postgres is down is not a check.
    console.error("[admin] could not check the session", err);
    return { admin: false, email: null, reason: "the administrator database is unavailable" };
  }
}
