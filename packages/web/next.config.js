/** @type {import('next').NextConfig} */

// Privy declares these as optional peers — Solana, Farcaster, Abstract and a
// smart-account library this app does not use. webpack resolves the imports
// anyway and fails the build on the ones that are absent, so they are aliased
// away rather than installed: pulling in three more chains' SDKs to satisfy a
// bundler would be a lot of dependency for code that never runs.
const UNUSED_PRIVY_PEERS = [
  "@abstract-foundation/agw-client",
  "@farcaster/mini-app-solana",
  "@solana/kit",
  "@solana-program/system",
  "@solana-program/token",
  "@solana-program/memo",
  "permissionless",
];

const nextConfig = {
  reactStrictMode: true,
  // @agentrail/shared ships TypeScript source; let Next transpile it.
  transpilePackages: ["@agentrail/shared"],
  webpack: (config) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      ...Object.fromEntries(UNUSED_PRIVY_PEERS.map((name) => [name, false])),
    };
    return config;
  },
};

module.exports = nextConfig;
