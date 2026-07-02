'use strict';

/**
 * Allow large contract init code when deploying to PolkaVM / revive.
 *
 * Hardhat (>=2.26) signs local-account transactions with `micro-eth-signer`,
 * which enforces EIP-3860's 49,152-byte max init-code size on contract-creation
 * txs. That limit is an Ethereum-mainnet rule; it does NOT apply to PolkaVM, where
 * `resolc`-compiled contracts (e.g. CrowdstackingPool, ~120KB) legitimately exceed
 * it. The @parity/hardhat-polkadot plugin ships `sizeCheckPatch()` to bypass this,
 * but it patches `@nomicfoundation/ethereumjs-tx` — a library current Hardhat no
 * longer uses for signing — so the check still fires.
 *
 * This hook raises `micro-eth-signer`'s `amounts.maxInitDataSize` as soon as that
 * module loads, regardless of the require path. Deploy-tooling only — it is never
 * imported by the app or shipped.
 */

const Module = require('module');

const EIP_3860_MAX_INIT_DATA_SIZE = 49152;
const originalLoad = Module._load;

Module._load = function patchedLoad(request, parent, isMain) {
  const exported = originalLoad.apply(this, arguments);
  try {
    const amounts = exported && exported.amounts;
    if (amounts && amounts.maxInitDataSize === EIP_3860_MAX_INIT_DATA_SIZE) {
      amounts.maxInitDataSize = Number.MAX_SAFE_INTEGER;
    }
  } catch {
    // Never let the patch break module loading.
  }
  return exported;
};
