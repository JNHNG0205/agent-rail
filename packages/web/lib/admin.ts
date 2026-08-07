import { appId, ownerOf, verifiedWalletsOf, UnauthorizedError } from "@/lib/owner";
import { publicClient } from "@/lib/viem";
import { addresses, JobContractAbi } from "@agentrail/shared";

/// Who may open the network admin views. Member 4.
///
/// Two ways in, and both are proved rather than claimed — the rule this codebase
/// already lives by for ownership of an agent.
///
/// The first is on chain and needs no configuration: `JobContract` has an owner,
/// the account that deployed it. That owner is a real privilege in this system —
/// it can re-point the identity registry, the evaluator module and the reputation
/// registry, which is why it is deliberately never one of the agents. If a
/// verified wallet on the signed-in account is that address, the person is
/// administering the thing they own.
///
/// The second is an allowlist, because the deployer is a throwaway key nobody
/// wants to sign in with day to day. `ADMIN_ALLOWLIST` holds Privy DIDs, email
/// addresses or wallet addresses, comma separated. Server-side only: it is never
/// sent to the browser, so the page cannot be talked into believing itself
/// privileged.
///
/// What this gate is, honestly: it controls the interface, not the data. Jobs
/// and verdicts live on public contracts, and anyone willing to read the chain
/// can reconstruct every job in these views without ever loading this
/// application. What it does protect is the evaluator's written reasoning, which
/// is stored off chain and served nowhere else.
///
/// With no Privy app configured the whole application runs on an unverified
/// header for offline development, and there is nothing to authenticate against.
/// This returns false in that case rather than true: an open demo should refuse
/// the admin views, not hand them to everyone.

/// Two levels, and the difference between them is real rather than decorative.
///
///   admin       may read the network views — every job, and the evaluator's
///               reasoning. Holds no power over the system itself.
///   superadmin  owns the deployed contracts. That account can re-point the
///               identity registry, the evaluator module and the reputation
///               registry, which is to say it can rewrite the rules every future
///               job is judged under. It is deliberately never one of the agents.
///
/// Superadmin implies admin. The reverse never holds: an allowlist is a decision
/// this application makes, and the chain does not care what it says.
export type AdminRole = "none" | "admin" | "superadmin";

export interface AdminCheck {
  role: AdminRole;
  /// Kept because most callers only ask "may I see this at all".
  admin: boolean;
  /// Why, in words a person can act on. Shown to whoever was refused.
  reason: string;
}

function superAllowlist(): string[] {
  return (process.env.SUPERADMIN_ALLOWLIST ?? "")
    .split(",")
    .map((entry) => entry.trim().toLowerCase())
    .filter((entry) => entry.length > 0);
}

function allowlist(): string[] {
  return (process.env.ADMIN_ALLOWLIST ?? "")
    .split(",")
    .map((entry) => entry.trim().toLowerCase())
    .filter((entry) => entry.length > 0);
}

/// The account that deployed JobContract, read from the chain.
///
/// Read rather than configured, so it cannot drift from the contract that is
/// actually deployed. A failure here denies rather than allows: a check that
/// falls open when the endpoint is slow is not a check.
async function contractOwner(): Promise<string | null> {
  try {
    const owner = await publicClient.readContract({
      address: addresses.JobContract,
      abi: JobContractAbi,
      functionName: "owner",
    });
    return typeof owner === "string" ? owner.toLowerCase() : null;
  } catch {
    return null;
  }
}

function decide(role: AdminRole, reason: string): AdminCheck {
  return { role, admin: role !== "none", reason };
}

export async function checkAdmin(request: Request): Promise<AdminCheck> {
  // With no Privy app configured the caller's identity is a header they wrote
  // themselves, so an allowlist entry could simply be asserted. Refuse the whole
  // section rather than hand it to whoever guesses a listed address.
  if (!appId()) {
    return decide(
      "none",
      "admin access needs a configured Privy app — identity cannot be verified without one",
    );
  }

  let did: string | null;
  try {
    did = await ownerOf(request);
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return decide("none", "sign in to open the network admin views");
    }
    throw err;
  }
  if (!did) {
    return decide("none", "sign in to open the network admin views");
  }

  const identity = did.toLowerCase();
  const admins = allowlist();
  const supers = superAllowlist();

  // Wallets come from the identity token, which not every session carries — a
  // person signed in with an email alone has no wallet to compare.
  let wallets: { address: `0x${string}` }[] = [];
  try {
    wallets = await verifiedWalletsOf(request);
  } catch {
    wallets = [];
  }
  const held = wallets.map((w) => w.address.toLowerCase());

  // Ownership of the contracts outranks anything configured here, because it is
  // the one claim this application does not get to make up.
  const owner = await contractOwner();
  if (owner && held.includes(owner)) {
    return decide("superadmin", "this wallet owns the deployed contracts");
  }
  if (supers.includes(identity) || held.some((a) => supers.includes(a))) {
    return decide("superadmin", "listed in SUPERADMIN_ALLOWLIST");
  }
  if (admins.includes(identity) || held.some((a) => admins.includes(a))) {
    return decide("admin", "listed in ADMIN_ALLOWLIST");
  }

  return decide(
    "none",
    "this account does not own the deployed contracts and is on neither admin list",
  );
}
