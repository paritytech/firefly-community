/**
 * DotNS Directory - Chain-based name resolution
 *
 * Provides directory lookups for any alias/account using chain queries.
 * Wraps the existing dotns-gateway.ts with the new result types.
 *
 * Usage:
 * ```ts
 * import { createDotNsDirectory } from '@cocuyo/individuality/dotns';
 *
 * const directory = createDotNsDirectory(api);
 * const result = await directory.resolveAlias('alice');
 * if (result.ok && result.value) {
 *   console.log(`Registered by: ${result.value.account}`);
 * }
 * ```
 *
 * @license GPL-3.0
 */

import type { PolkadotAddress } from '@cocuyo/types';
import type {
  DotNsDirectory,
  DotNsRegistrationPolicy,
  DotNsEligibilityResult,
  ResolverResult,
} from './types';
import type { RegistrationRecord, EligibilityResult } from '../types';
import type { DotNsGatewayApi } from '../dotns-gateway';
import * as gateway from '../dotns-gateway';
import { isValidPersonLabel, isValidLiteLabel } from '../types';

// Re-export the gateway API type for convenience
export type { DotNsGatewayApi } from '../dotns-gateway';

/**
 * Convert gateway eligibility result to new eligibility format.
 */
function convertEligibilityResult(result: EligibilityResult): DotNsEligibilityResult {
  if (result.eligible) {
    return { eligible: true };
  }

  // Map gateway error codes to eligibility failure reasons
  const error = result.error;
  switch (error) {
    case 'InvalidName':
    case 'InvalidLiteLabel':
    case 'InvalidBaseLabel':
      return { eligible: false, reason: 'invalid_alias', message: error };

    case 'AliasAlreadyRegistered':
    case 'AlreadyReserved':
      return { eligible: false, reason: 'alias_taken', message: error };

    case 'AccountAlreadyRegistered':
      return { eligible: false, reason: 'account_has_alias', message: error };

    case 'DispatcherAddressNotSet':
    case 'ContractCallFailed':
      return { eligible: false, reason: 'gateway_unavailable', message: error };

    default:
      return { eligible: false, reason: 'network_error', message: error };
  }
}

/**
 * Create a DotNS directory and registration policy using chain queries.
 *
 * This combines both DotNsDirectory and DotNsRegistrationPolicy interfaces
 * since both require chain access.
 *
 * @param api - The DotNS Gateway API interface (from chain client)
 * @returns Combined directory and registration policy
 */
export function createDotNsDirectory(
  api: DotNsGatewayApi
): DotNsDirectory & DotNsRegistrationPolicy {
  return {
    async resolveAlias(alias: string): Promise<ResolverResult<RegistrationRecord | null>> {
      // Normalize input
      const normalized = alias.toLowerCase().trim();

      // Validate format
      if (!isValidPersonLabel(normalized) && !isValidLiteLabel(normalized)) {
        return {
          ok: false,
          error: {
            code: 'invalid_input',
            message: 'Invalid alias format',
            field: 'alias',
          },
        };
      }

      try {
        const record = await gateway.getAliasRegistration(api, normalized);
        return {
          ok: true,
          value: record,
          source: 'chain',
          fetchedAt: Date.now(),
        };
      } catch (e) {
        return {
          ok: false,
          error: {
            code: 'chain_unavailable',
            message: e instanceof Error ? e.message : String(e),
          },
        };
      }
    },

    async getAccountAlias(account: PolkadotAddress): Promise<ResolverResult<string | null>> {
      try {
        const alias = await gateway.getAccountAlias(api, account);
        return {
          ok: true,
          value: alias,
          source: 'chain',
          fetchedAt: Date.now(),
        };
      } catch (e) {
        return {
          ok: false,
          error: {
            code: 'chain_unavailable',
            message: e instanceof Error ? e.message : String(e),
          },
        };
      }
    },

    async getLiteLabelOwner(label: string): Promise<ResolverResult<PolkadotAddress | null>> {
      try {
        const owner = await gateway.getLiteLabelOwner(api, label);
        return {
          ok: true,
          value: owner,
          source: 'chain',
          fetchedAt: Date.now(),
        };
      } catch (e) {
        return {
          ok: false,
          error: {
            code: 'chain_unavailable',
            message: e instanceof Error ? e.message : String(e),
          },
        };
      }
    },

    async canRegister(account: PolkadotAddress, alias: string): Promise<DotNsEligibilityResult> {
      try {
        const result = await gateway.canRegisterFullName(api, account, alias);
        return convertEligibilityResult(result);
      } catch (e) {
        return {
          eligible: false,
          reason: 'network_error',
          message: e instanceof Error ? e.message : String(e),
        };
      }
    },
  };
}
