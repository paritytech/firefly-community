/**
 * Tests for Alliance governance utilities (crowdstacking).
 */

import { describe, it, expect } from 'vitest';
import {
  DEFAULT_ALLIANCE_GOVERNANCE,
  calculateAllianceVotingProgress,
  hasVotedOnAllianceProposal,
  getAllianceVote,
  allianceProposalToPreview,
  canCreateProposal,
  canVoteOnProposal,
  validateWeightChange,
  type AllianceProposal,
  type AllianceVote,
  type AllianceGovernanceConfig,
  type WeightChangePayload,
} from './alliance-governance';
import {
  createDIMCredential,
  createPolkadotAddress,
  createOutletId,
  createTreasuryId,
  createPoolId,
} from './brands';
import { type OutletAllocation } from './crowdstacking';
import { createPUSDAmount } from './currency';

const poolId = createPoolId('pool-1');
const alice = createDIMCredential('dim-alice');
const bob = createDIMCredential('dim-bob');

function makeVote(
  voter: AllianceVote['voter'],
  decision: AllianceVote['decision'],
  weight: number,
  voterTier: AllianceVote['voterTier']
): AllianceVote {
  return {
    voter,
    voterAddress: createPolkadotAddress('5Address'),
    decision,
    weight,
    voterTier,
    votedAt: 1000,
  };
}

function makeProposal(votes: readonly AllianceVote[]): AllianceProposal {
  return {
    id: 'aprop-1',
    poolId,
    proposalType: 'parameter-change',
    proposedBy: alice,
    proposerTier: 'beacon',
    title: 'Change cooldown',
    description: 'Adjust the withdrawal cooldown.',
    payload: {
      type: 'parameter-change',
      parameter: 'withdrawalCooldown',
      oldValue: 3600,
      newValue: 7200,
      rationale: 'Slower withdrawals.',
    },
    votes,
    minVotingTier: 'spark',
    quorumRequired: 100,
    approvalThreshold: 60,
    status: 'voting',
    createdAt: 100,
    expiresAt: 200,
  };
}

const config: AllianceGovernanceConfig = {
  poolId,
  ...DEFAULT_ALLIANCE_GOVERNANCE,
};

describe('DEFAULT_ALLIANCE_GOVERNANCE', () => {
  it('sets sensible tier and threshold defaults', () => {
    expect(DEFAULT_ALLIANCE_GOVERNANCE.minProposalTier).toBe('beacon');
    expect(DEFAULT_ALLIANCE_GOVERNANCE.minVotingTier).toBe('spark');
    expect(DEFAULT_ALLIANCE_GOVERNANCE.approvalThreshold).toBe(60);
    expect(DEFAULT_ALLIANCE_GOVERNANCE.emergencyApprovalThreshold).toBe(80);
  });

  it('uses a 7-day default voting duration', () => {
    expect(DEFAULT_ALLIANCE_GOVERNANCE.defaultVotingDuration).toBe(7 * 24 * 60 * 60);
  });

  it('keeps the emergency execution delay shorter than the standard delay', () => {
    expect(DEFAULT_ALLIANCE_GOVERNANCE.emergencyExecutionDelay).toBeLessThan(
      DEFAULT_ALLIANCE_GOVERNANCE.executionDelay
    );
  });
});

describe('calculateAllianceVotingProgress', () => {
  it('aggregates weight, counts, and tiers', () => {
    const proposal = makeProposal([
      makeVote(alice, 'approve', 60, 'beacon'),
      makeVote(bob, 'reject', 20, 'spark'),
    ]);

    const progress = calculateAllianceVotingProgress(proposal);
    expect(progress.weightByDecision.approve).toBe(60);
    expect(progress.weightByDecision.reject).toBe(20);
    expect(progress.votesByTier.beacon).toBe(1);
    expect(progress.votesByTier.spark).toBe(1);
    expect(progress.totalVotes).toBe(2);
    expect(progress.totalWeight).toBe(80);
  });

  it('does not reach quorum below the required weight', () => {
    const proposal = makeProposal([makeVote(alice, 'approve', 50, 'beacon')]);
    const progress = calculateAllianceVotingProgress(proposal);
    expect(progress.quorumReached).toBe(false);
    expect(progress.thresholdReached).toBe(false);
  });

  it('reaches the threshold once quorum and approval clear', () => {
    const proposal = makeProposal([
      makeVote(alice, 'approve', 80, 'beacon'),
      makeVote(bob, 'reject', 20, 'spark'),
    ]);
    const progress = calculateAllianceVotingProgress(proposal);
    expect(progress.quorumReached).toBe(true); // 100 >= 100
    expect(progress.approvalPercentage).toBe(80); // 80 / 100
    expect(progress.thresholdReached).toBe(true); // 80 >= 60
  });

  it('yields 0% approval with only abstains', () => {
    const proposal = makeProposal([makeVote(alice, 'abstain', 100, 'lighthouse')]);
    const progress = calculateAllianceVotingProgress(proposal);
    expect(progress.approvalPercentage).toBe(0);
  });

  it('uses voteTally aggregate weights when individual votes are unavailable', () => {
    // Models a chain-read proposal: no per-voter ballots, only real aggregate
    // weights. The weight metrics come from the tally; per-voter counts stay 0
    // (genuinely unknown without event indexing) rather than fabricated.
    const proposal: AllianceProposal = {
      ...makeProposal([]),
      voteTally: { approve: 80, reject: 20, abstain: 0 },
    };

    const progress = calculateAllianceVotingProgress(proposal);
    expect(progress.weightByDecision.approve).toBe(80);
    expect(progress.weightByDecision.reject).toBe(20);
    expect(progress.totalWeight).toBe(100);
    expect(progress.approvalPercentage).toBe(80);
    expect(progress.quorumReached).toBe(true);
    expect(progress.thresholdReached).toBe(true);
    // Per-voter detail is unknown for chain proposals — not fabricated.
    expect(progress.totalVotes).toBe(0);
    expect(progress.countByDecision.approve).toBe(0);
  });

  it('prefers individual votes over voteTally when both are present', () => {
    const proposal: AllianceProposal = {
      ...makeProposal([makeVote(alice, 'approve', 60, 'beacon')]),
      voteTally: { approve: 999, reject: 999, abstain: 999 },
    };
    const progress = calculateAllianceVotingProgress(proposal);
    expect(progress.weightByDecision.approve).toBe(60);
    expect(progress.totalWeight).toBe(60);
    expect(progress.totalVotes).toBe(1);
  });
});

describe('hasVotedOnAllianceProposal / getAllianceVote', () => {
  it('detects whether a credential has voted', () => {
    const proposal = makeProposal([makeVote(alice, 'approve', 10, 'beacon')]);
    expect(hasVotedOnAllianceProposal(proposal, alice)).toBe(true);
    expect(hasVotedOnAllianceProposal(proposal, bob)).toBe(false);
  });

  it('returns the matching vote or null', () => {
    const vote = makeVote(alice, 'reject', 10, 'beacon');
    const proposal = makeProposal([vote]);
    expect(getAllianceVote(proposal, alice)).toBe(vote);
    expect(getAllianceVote(proposal, bob)).toBeNull();
  });
});

describe('allianceProposalToPreview', () => {
  it('derives a preview with weight and approval', () => {
    const proposal = makeProposal([
      makeVote(alice, 'approve', 60, 'beacon'),
      makeVote(bob, 'reject', 40, 'spark'),
    ]);
    const preview = allianceProposalToPreview(proposal);
    expect(preview.voteCount).toBe(2);
    expect(preview.totalVotingWeight).toBe(100);
    expect(preview.approvalPercentage).toBe(60);
  });
});

describe('canCreateProposal', () => {
  it('allows tiers at or above the minimum proposal tier', () => {
    expect(canCreateProposal('beacon', config)).toBe(true);
    expect(canCreateProposal('lighthouse', config)).toBe(true);
  });

  it('rejects tiers below the minimum proposal tier', () => {
    expect(canCreateProposal('spark', config)).toBe(false);
    expect(canCreateProposal('none', config)).toBe(false);
  });
});

describe('canVoteOnProposal', () => {
  it('allows tiers at or above the minimum voting tier', () => {
    expect(canVoteOnProposal('spark', config)).toBe(true);
    expect(canVoteOnProposal('flame', config)).toBe(true);
  });

  it('rejects the none tier', () => {
    expect(canVoteOnProposal('none', config)).toBe(false);
  });
});

describe('validateWeightChange', () => {
  function outlet(id: string, weight: number, isActive = true): OutletAllocation {
    return {
      outletId: createOutletId(id),
      treasury: createTreasuryId(`treasury-${id}`),
      name: id,
      weight,
      isActive,
      addedAt: 0,
      totalDistributed: createPUSDAmount(0n),
    };
  }

  it('accepts a change whose weights sum to 10000', () => {
    const current = [outlet('a', 5000), outlet('b', 5000)];
    const change: WeightChangePayload = {
      type: 'weight-change',
      newWeights: [
        { outletId: createOutletId('a'), weight: 6000 },
        { outletId: createOutletId('b'), weight: 4000 },
      ],
      rationale: 'Rebalance.',
    };
    expect(validateWeightChange(current, change)).toEqual({ valid: true });
  });

  it('rejects weights that do not sum to 10000', () => {
    const current = [outlet('a', 5000), outlet('b', 5000)];
    const change: WeightChangePayload = {
      type: 'weight-change',
      newWeights: [{ outletId: createOutletId('a'), weight: 6000 }],
      rationale: 'Bad rebalance.',
    };
    const result = validateWeightChange(current, change);
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/must sum to 10000/);
  });

  it('rejects a change referencing an unknown outlet', () => {
    const current = [outlet('a', 10000)];
    const change: WeightChangePayload = {
      type: 'weight-change',
      newWeights: [{ outletId: createOutletId('zzz'), weight: 10000 }],
      rationale: 'Unknown.',
    };
    const result = validateWeightChange(current, change);
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/Unknown outlet/);
  });

  it('rejects negative weights', () => {
    const current = [outlet('a', 5000), outlet('b', 5000)];
    const change: WeightChangePayload = {
      type: 'weight-change',
      newWeights: [{ outletId: createOutletId('a'), weight: -100 }],
      rationale: 'Negative.',
    };
    const result = validateWeightChange(current, change);
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/cannot be negative/);
  });

  it('ignores inactive outlets when building the weight map', () => {
    const current = [outlet('a', 10000), outlet('b', 0, false)];
    const change: WeightChangePayload = {
      type: 'weight-change',
      newWeights: [{ outletId: createOutletId('a'), weight: 10000 }],
      rationale: 'Keep active only.',
    };
    expect(validateWeightChange(current, change)).toEqual({ valid: true });
  });
});
