import "dotenv/config";
import { createAdmin, adminCount, normaliseEmail } from "../lib/admin";
import { pool } from "../lib/db";

/// Create or update the administrator account.
///
/// Re-running for an existing address sets a new password rather than failing,
/// which is also how a reset works: there is no separate flow, and the old
/// session stops working the moment the hash changes.
///
/// Wrapped in a function rather than using top-level await — this package is not
/// an ES module, so tsx compiles it to CommonJS, where top-level await is an
/// error.
///
/// The password is an argument rather than a prompt so this can be scripted,
/// which does put it in shell history.

async function main(): Promise<void> {
  const [email, password] = process.argv.slice(2);

  if (!email || !password) {
    console.error("usage: npm run admin:create -- <email> <password>");
    process.exitCode = 1;
    return;
  }
  if (!email.includes("@")) {
    console.error(`"${email}" does not look like an email address`);
    process.exitCode = 1;
    return;
  }
  if (password.length < 8) {
    console.error("choose a password of at least 8 characters");
    process.exitCode = 1;
    return;
  }

  const before = await adminCount();
  await createAdmin(email, password);
  const after = await adminCount();

  console.log(
    after > before
      ? `created administrator ${normaliseEmail(email)}`
      : `updated the password for ${normaliseEmail(email)}`,
  );
  console.log("sign in on the Network admin tab.");
}

main()
  .catch((err) => {
    console.error("could not create the administrator:", err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
