/**
 * React hook for Alliance Governance Service.
 *
 * Provides access to Alliance governance with integrated wallet state.
 */

import { useMemo } from 'react';
import { getAllianceGovernanceService } from '../alliance-governance-service';
import type { AllianceGovernanceService } from '@cocuyo/types';

/**
 * Hook to access the Alliance Governance Service.
 *
 * @returns The Alliance Governance Service instance
 *
 * @example
 * ```tsx
 * const governance = useAllianceGovernanceService();
 *
 * // Create a proposal
 * const result = await governance.createProposal({
 *   poolId,
 *   title: 'Add New Outlet',
 *   description: 'Proposal to add...',
 *   payload: { type: 'outlet-add', ... }
 * });
 *
 * // Vote on a proposal
 * await governance.vote(proposalId, { decision: 'approve' });
 * ```
 */
export function useAllianceGovernanceService(): AllianceGovernanceService {
  // Resolve the chain-vs-mock service via the factory: chain mode uses the real
  // AllianceGovernanceClient, mock mode keeps the legacy session-cached impl.
  return useMemo(() => getAllianceGovernanceService(), []);
}
