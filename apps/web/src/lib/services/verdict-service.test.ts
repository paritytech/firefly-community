/**
 * Behavioural tests for the verdict / verdict-proposal services.
 *
 * The boundaries mocked: the wallet accessors + Bulletin upload (service-utils)
 * and the collective service (membership + governance). The services' own logic
 * runs for real: connection guards, membership/duplicate-proposal gating,
 * proposer auto-vote, the full vote-validation chain, persistence rollback on
 * upload failure, and threshold-driven finalization (which issues a verdict and
 * flips the proposal to 'approved').
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createClaimId, createCollectiveId, createDIMCredential } from '@cocuyo/types';
import type { Collective, DIMCredential } from '@cocuyo/types';

const getConnectedWallet = vi.fn<() => string | null>();
const getConnectedCredential = vi.fn<() => DIMCredential | null>();
const uploadToBulletin =
  vi.fn<(data: unknown) => Promise<{ ok: boolean } & Record<string, unknown>>>();

vi.mock('./service-utils', async () => {
  const actual = await vi.importActual<typeof import('./service-utils')>('./service-utils');
  return {
    ...actual,
    getConnectedWallet: () => getConnectedWallet(),
    getConnectedCredential: () => getConnectedCredential(),
    uploadToBulletin: (data: unknown) => uploadToBulletin(data),
    fetchFromBulletin: vi.fn().mockResolvedValue(null),
  };
});

const isMember = vi.fn<() => Promise<boolean>>();
const getCollective = vi.fn<() => Promise<Collective | null>>();
vi.mock('./collective-service', () => ({
  collectiveService: {
    isMember: () => isMember(),
    getCollective: () => getCollective(),
  },
}));

import { VerdictServiceImpl, VerdictProposalServiceImpl } from './verdict-service';

const COLLECTIVE_ID = createCollectiveId('col-1');
const CLAIM_ID = createClaimId('claim-1');
const PROPOSER = createDIMCredential('proposer-1');
const VOTER = createDIMCredential('voter-2');

function collective(overrides: Partial<Collective['governance']> = {}): Collective {
  return {
    id: COLLECTIVE_ID,
    name: 'Test Collective',
    description: '',
    mission: '',
    topics: [],
    members: [
      {
        credentialHash: PROPOSER,
        pseudonym: 'Proposer',
        role: 'member',
        joinedAt: 0,
        verificationsCompleted: 0,
      },
      {
        credentialHash: VOTER,
        pseudonym: 'Voter',
        role: 'member',
        joinedAt: 0,
        verificationsCompleted: 0,
      },
    ],
    governance: {
      minVotesForVerdict: 2,
      verdictThreshold: 66,
      membershipApproval: 'vote',
      ...overrides,
    },
    reputation: { score: 0, verificationsCompleted: 0, accuracyRate: 0, avgResponseTime: 0 },
    createdAt: 0,
    updatedAt: 0,
  } as Collective;
}

let cidCounter = 0;
beforeEach(() => {
  vi.clearAllMocks();
  cidCounter = 0;
  // Distinct CID per upload so cached proposals/verdicts have stable, unique ids.
  uploadToBulletin.mockImplementation(() =>
    Promise.resolve({ ok: true, value: { cid: `cid-${++cidCounter}` } })
  );
  getConnectedWallet.mockReturnValue('wallet-1');
  getConnectedCredential.mockReturnValue(PROPOSER);
  isMember.mockResolvedValue(true);
  getCollective.mockResolvedValue(collective());
});

describe('VerdictServiceImpl.issueVerdict', () => {
  it('rejects when no wallet credential is connected', async () => {
    getConnectedCredential.mockReturnValue(null);
    const service = new VerdictServiceImpl();

    const result = await service.issueVerdict({
      claimId: CLAIM_ID,
      status: 'confirmed',
      rationale: 'r',
    });

    expect(result.ok).toBe(false);
    expect(uploadToBulletin).not.toHaveBeenCalled();
  });

  it('uploads the verdict, assigns the CID as id, and links it to the claim for lookup', async () => {
    const service = new VerdictServiceImpl();
    const claimId = createClaimId('issue-claim-a');

    const result = await service.issueVerdict({
      claimId,
      status: 'confirmed',
      rationale: 'because evidence',
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toBe('cid-1');

    // getVerdictForClaim resolves through the claim→verdict map populated on issue.
    const fetched = await service.getVerdictForClaim(claimId);
    expect(fetched?.id).toBe('cid-1');
    expect(fetched?.status).toBe('confirmed');
  });

  it('propagates the upload error and stores nothing', async () => {
    uploadToBulletin.mockResolvedValue({ ok: false, error: 'bulletin offline' });
    const service = new VerdictServiceImpl();
    const claimId = createClaimId('issue-claim-b');

    const result = await service.issueVerdict({
      claimId,
      status: 'confirmed',
      rationale: 'r',
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe('bulletin offline');
    expect(await service.getVerdictForClaim(claimId)).toBeNull();
  });
});

describe('VerdictProposalServiceImpl.createProposal', () => {
  it('rejects when the wallet is not connected', async () => {
    getConnectedWallet.mockReturnValue(null);
    getConnectedCredential.mockReturnValue(null);
    const service = new VerdictProposalServiceImpl();

    const result = await service.createProposal({
      claimId: CLAIM_ID,
      collectiveId: COLLECTIVE_ID,
      proposedStatus: 'confirmed',
      rationale: 'r',
    });
    expect(result.ok).toBe(false);
  });

  it('rejects when the proposer is not a member of the collective', async () => {
    isMember.mockResolvedValue(false);
    const service = new VerdictProposalServiceImpl();

    const result = await service.createProposal({
      claimId: CLAIM_ID,
      collectiveId: COLLECTIVE_ID,
      proposedStatus: 'confirmed',
      rationale: 'r',
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain('member');
  });

  it('rejects when the collective does not exist', async () => {
    getCollective.mockResolvedValue(null);
    const service = new VerdictProposalServiceImpl();

    const result = await service.createProposal({
      claimId: CLAIM_ID,
      collectiveId: COLLECTIVE_ID,
      proposedStatus: 'confirmed',
      rationale: 'r',
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain('not found');
  });

  it('creates a proposal seeded with the proposer’s own vote and the collective governance settings', async () => {
    const service = new VerdictProposalServiceImpl();

    const result = await service.createProposal({
      claimId: createClaimId('create-claim-a'),
      collectiveId: COLLECTIVE_ID,
      proposedStatus: 'disputed',
      rationale: 'looks off',
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const proposal = await service.getProposal(result.value);
    expect(proposal).not.toBeNull();
    expect(proposal?.status).toBe('voting');
    expect(proposal?.requiredVotes).toBe(2); // from governance.minVotesForVerdict
    expect(proposal?.threshold).toBe(66);
    // Proposer is auto-voted in agreement with their proposed status.
    expect(proposal?.votes).toHaveLength(1);
    expect(proposal?.votes[0]?.voter).toBe(PROPOSER);
    expect(proposal?.votes[0]?.decision).toBe('disputed');
    expect(proposal?.votes[0]?.signature).toMatch(/^sig:/);
  });

  it('rejects a second active proposal for the same claim from the same collective', async () => {
    const service = new VerdictProposalServiceImpl();
    const claimId = createClaimId('create-claim-dup');
    const first = await service.createProposal({
      claimId,
      collectiveId: COLLECTIVE_ID,
      proposedStatus: 'confirmed',
      rationale: 'first',
    });
    expect(first.ok).toBe(true);

    const second = await service.createProposal({
      claimId,
      collectiveId: COLLECTIVE_ID,
      proposedStatus: 'confirmed',
      rationale: 'second',
    });
    expect(second.ok).toBe(false);
    if (!second.ok) expect(second.error).toContain('active proposal already exists');
  });
});

describe('VerdictProposalServiceImpl.vote', () => {
  // The proposal cache is module-level and not reset between tests, so each test
  // proposes on a unique claim id to stay isolated from the others.
  let claimSeq = 0;
  async function makeProposal(service: VerdictProposalServiceImpl): Promise<{
    id: string;
    claimId: ReturnType<typeof createClaimId>;
  }> {
    const claimId = createClaimId(`vote-claim-${++claimSeq}`);
    getConnectedCredential.mockReturnValue(PROPOSER);
    const r = await service.createProposal({
      claimId,
      collectiveId: COLLECTIVE_ID,
      proposedStatus: 'confirmed',
      rationale: 'r',
    });
    if (!r.ok) throw new Error(`setup failed: ${r.error}`);
    return { id: r.value, claimId };
  }

  it('rejects a vote on a non-existent proposal', async () => {
    const service = new VerdictProposalServiceImpl();
    const result = await service.vote('no-such-proposal', { decision: 'confirmed' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain('not found');
  });

  it('rejects a duplicate vote from the same credential (proposer already auto-voted)', async () => {
    const service = new VerdictProposalServiceImpl();
    const { id } = await makeProposal(service);
    // Proposer auto-voted at creation; voting again must be refused.
    const result = await service.vote(id, { decision: 'confirmed' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain('already voted');
  });

  it('rejects a vote from a non-member', async () => {
    const service = new VerdictProposalServiceImpl();
    const { id } = await makeProposal(service);

    getConnectedCredential.mockReturnValue(VOTER);
    isMember.mockResolvedValue(false); // voter not in collective
    const result = await service.vote(id, { decision: 'confirmed' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain('member');
  });

  it('records a second member vote and finalizes once the threshold is reached', async () => {
    const service = new VerdictProposalServiceImpl();
    const { id, claimId } = await makeProposal(service); // proposer voted 'confirmed' (1/2)

    // A second member agrees → 2/2 votes, 100% agreement ≥ 66% threshold ⇒ finalize.
    getConnectedCredential.mockReturnValue(VOTER);
    isMember.mockResolvedValue(true);
    const result = await service.vote(id, { decision: 'confirmed', rationale: 'agree' });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.voter).toBe(VOTER);
      expect(result.value.decision).toBe('confirmed');
    }

    // Finalization flipped the proposal to 'approved' and issued a verdict for the claim.
    const proposal = await service.getProposal(id);
    expect(proposal?.status).toBe('approved');
    const verdictService = new VerdictServiceImpl();
    expect(await verdictService.getVerdictForClaim(claimId)).not.toBeNull();
  });

  it('rolls back the cached vote and reports failure when persistence of the vote fails', async () => {
    const service = new VerdictProposalServiceImpl();
    const { id } = await makeProposal(service);

    getConnectedCredential.mockReturnValue(VOTER);
    isMember.mockResolvedValue(true);
    // Next upload (the vote write) fails.
    uploadToBulletin.mockResolvedValueOnce({ ok: false, error: 'write failed' });

    const result = await service.vote(id, { decision: 'disputed' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain('persistence failed');

    // Rollback: the proposal still has only the proposer's auto-vote.
    const proposal = await service.getProposal(id);
    expect(proposal).not.toBeNull();
    expect(proposal?.votes).toHaveLength(1);
    expect(proposal?.votes[0]?.voter).toBe(PROPOSER);
  });
});
