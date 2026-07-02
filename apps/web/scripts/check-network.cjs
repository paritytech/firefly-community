/**
 * Build-time network guard (NETWORK_CONFIG_PLAN PR-5).
 *
 * Runs as the `prebuild` hook. Because apps/web is a static export, the selected network is baked
 * into the bundle — so a typo'd or unknown `NEXT_PUBLIC_NETWORK` would otherwise silently ship the
 * localhost default. This fails the build on an explicit-but-unknown selector and logs the
 * resolved network (public endpoints only — no secrets) so the target is visible in build logs.
 */

const { requireKnownNetworkId, resolveNetwork } = require('@cocuyo/network-config');

try {
  requireKnownNetworkId(process.env);
} catch (err) {
  const message = err instanceof Error ? err.message : String(err);
  console.error(`\n[network-config] Build aborted: ${message}\n`);
  process.exit(1);
}

const net = resolveNetwork(process.env);
console.log(`[network-config] Building for network "${net.id}" (${net.label})`);
console.log(
  `[network-config]   chainEnvironment=${net.chainEnvironment} ` +
    `evmRpc=${net.assetHub.evmRpc} bulletin=${net.bulletin.substrateWs}`
);
