/**
 * Tests for governance voting utilities.
 */

import { describe, it, expect } from 'vitest';
import {
  calculateGovernanceVotingProgress,
  hasVotedOnProposal,
  getMemberProposalVote,
  proposalToPreview,
  type GovernanceProposal,
  type GovernanceVote,
} from './governance';
import { createOrganizationId, createDIMCredential } from './brands';

const alice = createDIMCredential('dim-alice');
const bob = createDIMCredential('dim-bob');
const carol = createDIMCredential('dim-carol');

function makeVote(
  voter: GovernanceVote['voter'],
  decision: GovernanceVote['decision'],
  weight: number
): GovernanceVote {
  return {
    voter,
    decision,
    weight,
    signature: `sig-${voter}`,
    votedAt: 1000,
  };
}

function makeProposal(votes: readonly GovernanceVote[]): GovernanceProposal {
  return {
    id: 'prop-1',
    organizationId: createOrganizationId('org-1'),
    proposalType: 'policy',
    proposedBy: alice,
    title: 'Adopt new policy',
    description: 'A policy change.',
    payload: {
      type: 'policy',
      changes: [{ field: 'quorum', oldValue: 10, newValue: 20, description: 'Raise quorum' }],
    },
    votes,
    requiredWeight: 30,
    threshold: 60,
    status: 'voting',
    createdAt: 100,
    expiresAt: 200,
  };
}

describe('calculateGovernanceVotingProgress', () => {
  it('aggregates weight and counts by decision', () => {
    const proposal = makeProposal([
      makeVote(alice, 'approve', 20),
      makeVote(bob, 'reject', 5),
      makeVote(carol, 'abstain', 100),
    ]);

    const progress = calculateGovernanceVotingProgress(proposal);

    expect(progress.weightByDecision.approve).toBe(20);
    expect(progress.weightByDecision.reject).toBe(5);
    expect(progress.weightByDecision.abstain).toBe(100);
    expect(progress.countByDecision.approve).toBe(1);
    expect(progress.totalVotes).toBe(3);
    // totalWeight includes abstains
    expect(progress.totalWeight).toBe(125);
  });

  it('excludes abstains from the approval percentage', () => {
    const proposal = makeProposal([
      makeVote(alice, 'approve', 20),
      makeVote(bob, 'reject', 20),
      makeVote(carol, 'abstain', 1000),
    ]);

    const progress = calculateGovernanceVotingProgress(proposal);
    // 20 approve / (20 approve + 20 reject) = 50%
    expect(progress.approvalPercentage).toBe(50);
  });

  it('reports threshold reached when weight and approval both clear', () => {
    const proposal = makeProposal([
      makeVote(alice, 'approve', 25),
      makeVote(bob, 'approve', 10),
      makeVote(carol, 'reject', 5),
    ]);

    const progress = calculateGovernanceVotingProgress(proposal);
    expect(progress.totalWeight).toBe(40); // >= requiredWeight 30
    expect(progress.approvalPercentage).toBeCloseTo(87.5);
    expect(progress.thresholdReached).toBe(true);
  });

  it('reports threshold not reached when below required weight', () => {
    const proposal = makeProposal([makeVote(alice, 'approve', 10)]);
    const progress = calculateGovernanceVotingProgress(proposal);
    expect(progress.thresholdReached).toBe(false);
  });

  it('yields 0% approval when there are no non-abstain votes', () => {
    const proposal = makeProposal([makeVote(alice, 'abstain', 50)]);
    const progress = calculateGovernanceVotingProgress(proposal);
    expect(progress.approvalPercentage).toBe(0);
    expect(progress.thresholdReached).toBe(false);
  });
});

describe('hasVotedOnProposal', () => {
  it('is true when the credential has voted', () => {
    const proposal = makeProposal([makeVote(alice, 'approve', 10)]);
    expect(hasVotedOnProposal(proposal, alice)).toBe(true);
  });

  it('is false when the credential has not voted', () => {
    const proposal = makeProposal([makeVote(alice, 'approve', 10)]);
    expect(hasVotedOnProposal(proposal, bob)).toBe(false);
  });
});

describe('getMemberProposalVote', () => {
  it('returns the vote when present', () => {
    const vote = makeVote(alice, 'reject', 10);
    const proposal = makeProposal([vote]);
    expect(getMemberProposalVote(proposal, alice)).toBe(vote);
  });

  it('returns null when absent', () => {
    const proposal = makeProposal([makeVote(alice, 'reject', 10)]);
    expect(getMemberProposalVote(proposal, bob)).toBeNull();
  });
});

describe('proposalToPreview', () => {
  it('derives a preview with vote count and approval percentage', () => {
    const proposal = makeProposal([makeVote(alice, 'approve', 20), makeVote(bob, 'reject', 20)]);

    const preview = proposalToPreview(proposal);
    expect(preview.id).toBe('prop-1');
    expect(preview.proposalType).toBe('policy');
    expect(preview.voteCount).toBe(2);
    expect(preview.approvalPercentage).toBe(50);
    expect(preview.status).toBe('voting');
  });
});
