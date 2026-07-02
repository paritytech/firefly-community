/**
 * Tests for verdict-voting utilities.
 *
 * Includes tests for:
 * - Basic voting progress calculation
 * - Vote checking utilities
 * - MobRule extensions (Stewardship Court):
 *   - Case state transitions
 *   - Turnout requirements
 *   - Time-weighted voting
 *   - V1 to V2 conversion
 */

import { describe, it, expect } from 'vitest';
import {
  calculateVotingProgress,
  hasVoted,
  getMemberVote,
  // MobRule utilities
  getCaseState,
  checkTurnout,
  calculateVoteWeight,
  calculateWeightedVotingProgress,
  isV2Proposal,
  toV2Proposal,
  formatTimeUntilDeadline,
  type VerdictProposal,
  type VerdictProposalV2,
  type VerdictVote,
} from './verdict-voting';
import { createDIMCredential, createClaimId, createCollectiveId } from './brands';

const createMockVote = (credential: string, decision: VerdictVote['decision']): VerdictVote => ({
  voter: createDIMCredential(credential),
  decision,
  signature: 'sig-123',
  votedAt: Date.now(),
});

const createMockProposal = (overrides: Partial<VerdictProposal> = {}): VerdictProposal => ({
  id: 'proposal-1',
  claimId: createClaimId('claim-1'),
  collectiveId: createCollectiveId('collective-1'),
  proposedBy: createDIMCredential('proposer'),
  proposedStatus: 'confirmed',
  rationale: 'Test rationale',
  votes: [],
  requiredVotes: 5,
  threshold: 60,
  status: 'voting',
  createdAt: Date.now(),
  expiresAt: Date.now() + 86400000, // 24 hours from now
  ...overrides,
});

describe('calculateVotingProgress', () => {
  it('returns zero progress when no votes', () => {
    const proposal = createMockProposal({ votes: [] });
    const progress = calculateVotingProgress(proposal);

    expect(progress.totalVotes).toBe(0);
    expect(progress.voteCounts.confirmed).toBe(0);
    expect(progress.voteCounts.disputed).toBe(0);
    expect(progress.voteCounts.false).toBe(0);
    expect(progress.voteCounts.synthetic).toBe(0);
    expect(progress.voteCounts.inconclusive).toBe(0);
    expect(progress.thresholdReached).toBe(false);
  });

  it('counts votes correctly', () => {
    const proposal = createMockProposal({
      votes: [
        createMockVote('user-1', 'confirmed'),
        createMockVote('user-2', 'confirmed'),
        createMockVote('user-3', 'disputed'),
        createMockVote('user-4', 'false'),
        createMockVote('user-5', 'synthetic'),
        createMockVote('user-6', 'inconclusive'),
      ],
      requiredVotes: 5,
    });

    const progress = calculateVotingProgress(proposal);

    expect(progress.totalVotes).toBe(6);
    expect(progress.voteCounts.confirmed).toBe(2);
    expect(progress.voteCounts.disputed).toBe(1);
    expect(progress.voteCounts.false).toBe(1);
    expect(progress.voteCounts.synthetic).toBe(1);
    expect(progress.voteCounts.inconclusive).toBe(1);
  });

  it('detects threshold reached with required votes and agreement', () => {
    const proposal = createMockProposal({
      votes: [
        createMockVote('user-1', 'confirmed'),
        createMockVote('user-2', 'confirmed'),
        createMockVote('user-3', 'confirmed'),
        createMockVote('user-4', 'confirmed'),
        createMockVote('user-5', 'confirmed'),
      ],
      requiredVotes: 5,
      threshold: 60,
    });

    const progress = calculateVotingProgress(proposal);

    expect(progress.thresholdReached).toBe(true);
    expect(progress.agreementPercentage).toBe(100);
  });

  it('detects threshold not reached when insufficient votes', () => {
    const proposal = createMockProposal({
      votes: [createMockVote('user-1', 'confirmed'), createMockVote('user-2', 'confirmed')],
      requiredVotes: 5,
    });

    const progress = calculateVotingProgress(proposal);

    expect(progress.thresholdReached).toBe(false);
  });

  it('detects threshold not reached when agreement below threshold', () => {
    const proposal = createMockProposal({
      votes: [
        createMockVote('user-1', 'confirmed'),
        createMockVote('user-2', 'confirmed'),
        createMockVote('user-3', 'disputed'),
        createMockVote('user-4', 'false'),
        createMockVote('user-5', 'synthetic'),
      ],
      requiredVotes: 5,
      threshold: 60,
    });

    const progress = calculateVotingProgress(proposal);

    // 2 out of 5 = 40%, below 60% threshold
    expect(progress.thresholdReached).toBe(false);
    expect(progress.agreementPercentage).toBe(40);
  });

  it('calculates leading status', () => {
    const proposal = createMockProposal({
      votes: [
        createMockVote('user-1', 'confirmed'),
        createMockVote('user-2', 'confirmed'),
        createMockVote('user-3', 'confirmed'),
        createMockVote('user-4', 'disputed'),
        createMockVote('user-5', 'false'),
      ],
    });

    const progress = calculateVotingProgress(proposal);

    expect(progress.leadingStatus).toBe('confirmed');
  });

  it('returns null leading status when no votes', () => {
    const proposal = createMockProposal({ votes: [] });
    const progress = calculateVotingProgress(proposal);

    expect(progress.leadingStatus).toBeNull();
  });
});

describe('hasVoted', () => {
  it('returns true when voter has voted', () => {
    const credential = createDIMCredential('user-1');
    const proposal = createMockProposal({
      votes: [createMockVote('user-1', 'confirmed')],
    });

    expect(hasVoted(proposal, credential)).toBe(true);
  });

  it('returns false when voter has not voted', () => {
    const credential = createDIMCredential('user-2');
    const proposal = createMockProposal({
      votes: [createMockVote('user-1', 'confirmed')],
    });

    expect(hasVoted(proposal, credential)).toBe(false);
  });

  it('returns false when no votes', () => {
    const credential = createDIMCredential('user-1');
    const proposal = createMockProposal({ votes: [] });

    expect(hasVoted(proposal, credential)).toBe(false);
  });
});

describe('getMemberVote', () => {
  it('returns vote when member has voted', () => {
    const credential = createDIMCredential('user-1');
    const vote = createMockVote('user-1', 'confirmed');
    const proposal = createMockProposal({ votes: [vote] });

    const result = getMemberVote(proposal, credential);

    expect(result).not.toBeNull();
    expect(result?.decision).toBe('confirmed');
  });

  it('returns null when member has not voted', () => {
    const credential = createDIMCredential('user-2');
    const proposal = createMockProposal({
      votes: [createMockVote('user-1', 'confirmed')],
    });

    const result = getMemberVote(proposal, credential);

    expect(result).toBeNull();
  });

  it('returns null when no votes', () => {
    const credential = createDIMCredential('user-1');
    const proposal = createMockProposal({ votes: [] });

    const result = getMemberVote(proposal, credential);

    expect(result).toBeNull();
  });
});

// ============================================================================
// MobRule Extension Tests (Stewardship Court)
// ============================================================================

const createMockV2Proposal = (overrides: Partial<VerdictProposalV2> = {}): VerdictProposalV2 => ({
  ...createMockProposal(),
  caseState: 'ripe',
  counterEvidenceDeadline: Date.now() - 1000, // Passed
  turnout: {
    minNominal: 5,
    minPercentage: 10,
  },
  eligibleVoters: 50,
  ...overrides,
});

describe('getCaseState', () => {
  it('returns "done" if caseState is already done', () => {
    const proposal = createMockV2Proposal({ caseState: 'done' });
    expect(getCaseState(proposal)).toBe('done');
  });

  it('returns "open" if counter-evidence deadline has not passed', () => {
    const proposal = createMockV2Proposal({
      caseState: 'open',
      counterEvidenceDeadline: Date.now() + 1000000, // Future
    });
    expect(getCaseState(proposal)).toBe('open');
  });

  it('returns "ripe" if counter-evidence deadline passed but not expired', () => {
    const proposal = createMockV2Proposal({
      caseState: 'open',
      counterEvidenceDeadline: Date.now() - 1000, // Past
      expiresAt: Date.now() + 1000000, // Future
    });
    expect(getCaseState(proposal)).toBe('ripe');
  });

  it('returns "done" if proposal has expired', () => {
    const proposal = createMockV2Proposal({
      caseState: 'ripe',
      counterEvidenceDeadline: Date.now() - 1000000, // Past
      expiresAt: Date.now() - 1000, // Past
    });
    expect(getCaseState(proposal)).toBe('done');
  });
});

describe('checkTurnout', () => {
  it('returns met=true when both nominal and percentage requirements are satisfied', () => {
    const proposal = createMockV2Proposal({
      votes: [
        createMockVote('user-1', 'confirmed'),
        createMockVote('user-2', 'confirmed'),
        createMockVote('user-3', 'confirmed'),
        createMockVote('user-4', 'confirmed'),
        createMockVote('user-5', 'confirmed'),
        createMockVote('user-6', 'disputed'),
      ],
      turnout: { minNominal: 5, minPercentage: 10 },
      eligibleVoters: 50,
    });

    const result = checkTurnout(proposal);
    expect(result.met).toBe(true);
    expect(result.current).toBe(6);
    expect(result.required).toBe(5); // Max of (5, ceil(50 * 0.10)) = max(5, 5) = 5
    expect(result.currentPercentage).toBe(12); // 6/50 * 100
  });

  it('returns met=false when nominal requirement not met', () => {
    const proposal = createMockV2Proposal({
      votes: [createMockVote('user-1', 'confirmed'), createMockVote('user-2', 'confirmed')],
      turnout: { minNominal: 5, minPercentage: 1 },
      eligibleVoters: 50,
    });

    const result = checkTurnout(proposal);
    expect(result.met).toBe(false);
    expect(result.current).toBe(2);
  });

  it('returns met=false when percentage requirement not met', () => {
    const proposal = createMockV2Proposal({
      votes: [
        createMockVote('user-1', 'confirmed'),
        createMockVote('user-2', 'confirmed'),
        createMockVote('user-3', 'confirmed'),
      ],
      turnout: { minNominal: 3, minPercentage: 50 }, // 50% of 50 = 25 votes
      eligibleVoters: 50,
    });

    const result = checkTurnout(proposal);
    expect(result.met).toBe(false);
    expect(result.currentPercentage).toBe(6); // 3/50 * 100
  });

  it('handles zero eligible voters gracefully', () => {
    const proposal = createMockV2Proposal({
      votes: [],
      eligibleVoters: 0,
    });

    const result = checkTurnout(proposal);
    expect(result.currentPercentage).toBe(0);
  });

  it('deduplicates votes from the same voter', () => {
    // Same voter voting twice should only count as one unique voter
    const sameCredential = createDIMCredential('duplicate-user');
    const proposal = createMockV2Proposal({
      votes: [
        {
          voter: sameCredential,
          decision: 'confirmed',
          signature: 'sig-1',
          votedAt: Date.now() - 1000,
        },
        {
          voter: sameCredential, // Same voter again
          decision: 'disputed', // Different decision
          signature: 'sig-2',
          votedAt: Date.now(),
        },
        {
          voter: createDIMCredential('other-user'),
          decision: 'confirmed',
          signature: 'sig-3',
          votedAt: Date.now(),
        },
      ],
      turnout: { minNominal: 3, minPercentage: 1 },
      eligibleVoters: 50,
    });

    const result = checkTurnout(proposal);
    // Should count 2 unique voters, not 3 votes
    expect(result.current).toBe(2);
    expect(result.met).toBe(false); // Only 2 unique voters, need 3
  });
});

describe('calculateVoteWeight', () => {
  const halfLife = 24 * 60 * 60 * 1000; // 24 hours

  it('returns 1.0 for votes cast at proposal creation', () => {
    const proposalCreatedAt = Date.now() - 1000;
    const vote: VerdictVote = {
      voter: createDIMCredential('user-1'),
      decision: 'confirmed',
      signature: 'sig-123',
      votedAt: proposalCreatedAt,
    };

    const weight = calculateVoteWeight(vote, proposalCreatedAt, halfLife);
    expect(weight).toBeCloseTo(1.0, 2);
  });

  it('returns ~0.5 for votes cast 24 hours after proposal creation', () => {
    const proposalCreatedAt = Date.now() - 2 * halfLife;
    const vote: VerdictVote = {
      voter: createDIMCredential('user-1'),
      decision: 'confirmed',
      signature: 'sig-123',
      votedAt: proposalCreatedAt + halfLife,
    };

    const weight = calculateVoteWeight(vote, proposalCreatedAt, halfLife);
    expect(weight).toBeCloseTo(0.5, 2);
  });

  it('returns ~0.25 for votes cast 48 hours after proposal creation', () => {
    const proposalCreatedAt = Date.now() - 3 * halfLife;
    const vote: VerdictVote = {
      voter: createDIMCredential('user-1'),
      decision: 'confirmed',
      signature: 'sig-123',
      votedAt: proposalCreatedAt + 2 * halfLife,
    };

    const weight = calculateVoteWeight(vote, proposalCreatedAt, halfLife);
    expect(weight).toBeCloseTo(0.25, 2);
  });

  it('returns 1.0 for votes cast before proposal creation (edge case)', () => {
    const proposalCreatedAt = Date.now();
    const vote: VerdictVote = {
      voter: createDIMCredential('user-1'),
      decision: 'confirmed',
      signature: 'sig-123',
      votedAt: proposalCreatedAt - 1000,
    };

    const weight = calculateVoteWeight(vote, proposalCreatedAt, halfLife);
    expect(weight).toBe(1.0);
  });
});

describe('calculateWeightedVotingProgress', () => {
  const halfLife = 24 * 60 * 60 * 1000;

  it('calculates weighted vote totals correctly', () => {
    const proposalCreatedAt = Date.now() - halfLife;

    const proposal = createMockV2Proposal({
      createdAt: proposalCreatedAt,
      votes: [
        {
          voter: createDIMCredential('user-1'),
          decision: 'confirmed',
          signature: 'sig-1',
          votedAt: proposalCreatedAt, // Weight: 1.0
        },
        {
          voter: createDIMCredential('user-2'),
          decision: 'confirmed',
          signature: 'sig-2',
          votedAt: proposalCreatedAt + halfLife, // Weight: 0.5
        },
      ],
      turnout: { minNominal: 2, minPercentage: 1 },
      eligibleVoters: 100,
    });

    const progress = calculateWeightedVotingProgress(proposal, halfLife);
    expect(progress.totalVotes).toBe(2);
    expect(progress.weightedTotalVotes).toBeCloseTo(1.5, 1); // 1.0 + 0.5
    expect(progress.weightedAgreementPercentage).toBeCloseTo(100, 0); // All confirmed
  });

  it('includes turnout check results', () => {
    const proposal = createMockV2Proposal({
      votes: [
        createMockVote('user-1', 'confirmed'),
        createMockVote('user-2', 'confirmed'),
        createMockVote('user-3', 'confirmed'),
        createMockVote('user-4', 'confirmed'),
        createMockVote('user-5', 'confirmed'),
      ],
      turnout: { minNominal: 5, minPercentage: 10 },
      eligibleVoters: 50,
    });

    const progress = calculateWeightedVotingProgress(proposal, halfLife);
    expect(progress.turnout.met).toBe(true);
    expect(progress.turnout.current).toBe(5);
  });

  it('sets readyToFinalize when turnout and threshold are met', () => {
    const proposal = createMockV2Proposal({
      votes: [
        createMockVote('user-1', 'confirmed'),
        createMockVote('user-2', 'confirmed'),
        createMockVote('user-3', 'confirmed'),
        createMockVote('user-4', 'confirmed'),
        createMockVote('user-5', 'confirmed'),
      ],
      requiredVotes: 5,
      threshold: 60,
      turnout: { minNominal: 5, minPercentage: 10 },
      eligibleVoters: 50,
    });

    const progress = calculateWeightedVotingProgress(proposal, halfLife);
    expect(progress.readyToFinalize).toBe(true);
  });

  it('sets readyToFinalize=false when turnout not met', () => {
    const proposal = createMockV2Proposal({
      votes: [createMockVote('user-1', 'confirmed'), createMockVote('user-2', 'confirmed')],
      requiredVotes: 2,
      threshold: 60,
      turnout: { minNominal: 5, minPercentage: 10 },
      eligibleVoters: 50,
    });

    const progress = calculateWeightedVotingProgress(proposal, halfLife);
    expect(progress.readyToFinalize).toBe(false);
  });
});

describe('isV2Proposal', () => {
  it('returns true for V2 proposals', () => {
    const proposal = createMockV2Proposal();
    expect(isV2Proposal(proposal)).toBe(true);
  });

  it('returns false for V1 proposals', () => {
    const proposal = createMockProposal();
    expect(isV2Proposal(proposal)).toBe(false);
  });
});

describe('toV2Proposal', () => {
  it('converts a V1 proposal to V2 with defaults', () => {
    const v1 = createMockProposal({
      createdAt: Date.now() - 3600000, // 1 hour ago
    });

    const v2 = toV2Proposal(v1, {
      counterEvidenceWindowMs: 2 * 24 * 60 * 60 * 1000, // 2 days
      eligibleVoters: 25,
      minTurnoutNominal: 5,
      minTurnoutPercent: 10,
    });

    expect(v2.turnout.minNominal).toBe(5);
    expect(v2.turnout.minPercentage).toBe(10);
    expect(v2.eligibleVoters).toBe(25);
    expect(v2.counterEvidenceDeadline).toBe(v1.createdAt + 2 * 24 * 60 * 60 * 1000);
  });

  it('determines case state based on timing', () => {
    const now = Date.now();
    const counterEvidenceWindowMs = 1000; // 1 second for testing

    // Case: Still in counter-evidence window
    const v1Open = createMockProposal({ createdAt: now });
    const v2Open = toV2Proposal(v1Open, {
      counterEvidenceWindowMs,
      eligibleVoters: 10,
      minTurnoutNominal: 5,
      minTurnoutPercent: 10,
    });
    expect(v2Open.caseState).toBe('open');

    // Case: Counter-evidence window passed
    const v1Ripe = createMockProposal({
      createdAt: now - 2 * counterEvidenceWindowMs,
      expiresAt: now + 1000000,
    });
    const v2Ripe = toV2Proposal(v1Ripe, {
      counterEvidenceWindowMs,
      eligibleVoters: 10,
      minTurnoutNominal: 5,
      minTurnoutPercent: 10,
    });
    expect(v2Ripe.caseState).toBe('ripe');
  });

  it('sets caseState to done for approved/rejected proposals', () => {
    const v1Approved = createMockProposal({ status: 'approved' });
    const v2 = toV2Proposal(v1Approved, {
      counterEvidenceWindowMs: 1000,
      eligibleVoters: 10,
      minTurnoutNominal: 5,
      minTurnoutPercent: 10,
    });
    expect(v2.caseState).toBe('done');
  });
});

describe('formatTimeUntilDeadline', () => {
  it('returns "Ended" for past deadlines', () => {
    const pastDeadline = Date.now() - 1000;
    expect(formatTimeUntilDeadline(pastDeadline)).toBe('Ended');
  });

  it('formats days and hours correctly', () => {
    const deadline = Date.now() + 2 * 24 * 60 * 60 * 1000 + 5 * 60 * 60 * 1000; // 2d 5h
    const result = formatTimeUntilDeadline(deadline);
    expect(result).toBe('2d 5h');
  });

  it('formats hours and minutes when less than a day', () => {
    const deadline = Date.now() + 5 * 60 * 60 * 1000 + 30 * 60 * 1000; // 5h 30m
    const result = formatTimeUntilDeadline(deadline);
    expect(result).toBe('5h 30m');
  });

  it('formats minutes when less than an hour', () => {
    const deadline = Date.now() + 45 * 60 * 1000; // 45 minutes
    const result = formatTimeUntilDeadline(deadline);
    expect(result).toBe('45m');
  });
});
