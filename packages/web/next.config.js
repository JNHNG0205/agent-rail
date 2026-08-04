/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // @agentrail/shared ships TypeScript source; let Next transpile it.
  transpilePackages: ["@agentrail/shared"],
};

module.exports = nextConfig;
