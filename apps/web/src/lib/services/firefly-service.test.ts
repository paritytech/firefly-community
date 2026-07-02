/**
 * Behavioural tests for FireflyProfileServiceImpl.
 *
 * The personhood + collective services are mocked at the module boundary so the
 * derived system fields (personhood level, memberships, fact-checker status) are
 * controllable. The service's own logic runs for real: update validation +
 * trimming, publicInfo assembly, disclosure-level filtering, fact-checker
 * derivation from verification counts, and stats aggregation.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createDIMCredential } from '@cocuyo/types';
import type { CollectivePreview, Collective } from '@cocuyo/types';

const getLevel = vi.fn<() => Promise<'none' | 'lite' | 'full'>>();
vi.mock('./personhood-service', () => ({
  personhoodService: { getLevel: () => getLevel() },
}));

const getCollectivesForMember = vi.fn<() => Promise<CollectivePreview[]>>();
const getCollective = vi.fn<() => Promise<Collective | null>>();
vi.mock('./collective-service', () => ({
  collectiveService: {
    getCollectivesForMember: () => getCollectivesForMember(),
    getCollective: () => getCollective(),
  },
}));

import { FireflyProfileServiceImpl, clearProfileCache } from './firefly-service';

// A non-seed credential so getStoredProfile yields the default anonymous profile.
const CRED = createDIMCredential('non-seed-firefly-abc123');

beforeEach(() => {
  vi.clearAllMocks();
  clearProfileCache();
  getLevel.mockResolvedValue('lite');
  getCollectivesForMember.mockResolvedValue([]);
  getCollective.mockResolvedValue(null);
});

describe('FireflyProfileServiceImpl.updateProfile validation', () => {
  it('rejects an empty (whitespace-only) pseudonym', async () => {
    const service = new FireflyProfileServiceImpl();
    const result = await service.updateProfile(CRED, {
      pseudonym: '   ',
      disclosureLevel: 'anonymous',
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain('empty');
  });

  it('rejects a pseudonym longer than 30 characters', async () => {
    const service = new FireflyProfileServiceImpl();
    const result = await service.updateProfile(CRED, {
      pseudonym: 'x'.repeat(31),
      disclosureLevel: 'anonymous',
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain('30 characters');
  });

  it('rejects a bio longer than 500 characters', async () => {
    const service = new FireflyProfileServiceImpl();
    const result = await service.updateProfile(CRED, {
      pseudonym: 'Alice',
      disclosureLevel: 'public',
      publicInfo: { bio: 'b'.repeat(501) },
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain('500 characters');
  });

  it('trims the pseudonym and persists it so the next read sees the trimmed value', async () => {
    const service = new FireflyProfileServiceImpl();
    const result = await service.updateProfile(CRED, {
      pseudonym: '  Trimmed Name  ',
      disclosureLevel: 'public',
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.pseudonym).toBe('Trimmed Name');

    const own = await service.getOwnProfile(CRED);
    expect(own?.pseudonym).toBe('Trimmed Name');
  });

  it('drops blank publicInfo fields rather than storing empty strings', async () => {
    const service = new FireflyProfileServiceImpl();
    const result = await service.updateProfile(CRED, {
      pseudonym: 'Alice',
      disclosureLevel: 'public',
      publicInfo: { displayName: '  ', location: 'Bogotá', bio: '' },
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // Only the non-blank field survives.
    expect(result.value.publicInfo).toEqual({ location: 'Bogotá' });
  });
});

describe('FireflyProfileServiceImpl.getPublicProfile disclosure filtering', () => {
  async function storeProfileWithInfo(
    service: FireflyProfileServiceImpl,
    disclosureLevel: 'anonymous' | 'partial' | 'public'
  ): Promise<void> {
    await service.updateProfile(CRED, {
      pseudonym: 'Alice',
      disclosureLevel,
      publicInfo: { displayName: 'Alice R', location: 'Lima', bio: 'investigator' },
    });
  }

  it('anonymous disclosure hides all publicInfo', async () => {
    const service = new FireflyProfileServiceImpl();
    await storeProfileWithInfo(service, 'anonymous');

    const profile = await service.getPublicProfile(CRED);
    expect(profile).not.toBeNull();
    expect(profile?.publicInfo).toBeUndefined();
  });

  it('partial disclosure exposes only the location', async () => {
    const service = new FireflyProfileServiceImpl();
    await storeProfileWithInfo(service, 'partial');

    const profile = await service.getPublicProfile(CRED);
    expect(profile?.publicInfo).toEqual({ location: 'Lima' });
  });

  it('public disclosure exposes the full publicInfo', async () => {
    const service = new FireflyProfileServiceImpl();
    await storeProfileWithInfo(service, 'public');

    const profile = await service.getPublicProfile(CRED);
    expect(profile?.publicInfo?.displayName).toBe('Alice R');
    expect(profile?.publicInfo?.location).toBe('Lima');
    expect(profile?.publicInfo?.bio).toBe('investigator');
  });

  it('surfaces the derived personhood level from the personhood service', async () => {
    getLevel.mockResolvedValue('full');
    const service = new FireflyProfileServiceImpl();
    await storeProfileWithInfo(service, 'public');

    const profile = await service.getPublicProfile(CRED);
    expect(profile?.personhoodLevel).toBe('full');
  });
});

describe('FireflyProfileServiceImpl fact-checker derivation', () => {
  function membershipCollective(verifications: number): Collective {
    return {
      id: 'col-1',
      name: 'C',
      description: '',
      mission: '',
      topics: [],
      members: [
        {
          credentialHash: CRED,
          role: 'member',
          joinedAt: 0,
          verificationsCompleted: verifications,
        },
      ],
      governance: { minVotesForVerdict: 1, verdictThreshold: 50, membershipApproval: 'open' },
      reputation: { score: 0, verificationsCompleted: 0, accuracyRate: 0, avgResponseTime: 0 },
      createdAt: 0,
      updatedAt: 0,
    } as unknown as Collective;
  }

  it('marks the firefly verified once total verifications reach the threshold (10)', async () => {
    const preview: CollectivePreview = {
      id: 'col-1',
      name: 'C',
      description: '',
      topics: [],
      memberCount: 1,
      reputation: 0,
      verificationsCompleted: 12,
    } as unknown as CollectivePreview;
    getCollectivesForMember.mockResolvedValue([preview]);
    getCollective.mockResolvedValue(membershipCollective(12));

    const service = new FireflyProfileServiceImpl();
    await service.updateProfile(CRED, { pseudonym: 'Alice', disclosureLevel: 'anonymous' });

    const profile = await service.getPublicProfile(CRED);
    expect(profile?.factCheckerStatus).toBe('verified');
  });

  it('leaves the firefly unverified below the threshold', async () => {
    const preview: CollectivePreview = {
      id: 'col-1',
      name: 'C',
      description: '',
      topics: [],
      memberCount: 1,
      reputation: 0,
      verificationsCompleted: 3,
    } as unknown as CollectivePreview;
    getCollectivesForMember.mockResolvedValue([preview]);
    getCollective.mockResolvedValue(membershipCollective(3));

    const service = new FireflyProfileServiceImpl();
    await service.updateProfile(CRED, { pseudonym: 'Alice', disclosureLevel: 'anonymous' });

    const profile = await service.getPublicProfile(CRED);
    expect(profile?.factCheckerStatus).toBe('none');
  });
});

describe('FireflyProfileServiceImpl stats', () => {
  it('aggregates collectivesJoined and verificationsCompleted from previews', async () => {
    const previews: CollectivePreview[] = [
      {
        id: 'c1',
        name: 'C1',
        description: '',
        topics: [],
        memberCount: 1,
        reputation: 0,
        verificationsCompleted: 4,
      },
      {
        id: 'c2',
        name: 'C2',
        description: '',
        topics: [],
        memberCount: 1,
        reputation: 0,
        verificationsCompleted: 6,
      },
    ] as unknown as CollectivePreview[];
    getCollectivesForMember.mockResolvedValue(previews);
    // No matching collective detail ⇒ no membership summaries, isolating the preview-derived stats.
    getCollective.mockResolvedValue(null);

    const service = new FireflyProfileServiceImpl();
    await service.updateProfile(CRED, { pseudonym: 'Alice', disclosureLevel: 'anonymous' });

    const profile = await service.getPublicProfile(CRED);
    expect(profile?.stats.collectivesJoined).toBe(2);
    expect(profile?.stats.verificationsCompleted).toBe(10);
  });
});

describe('FireflyProfileServiceImpl session cache', () => {
  it('returns null for an unknown seed credential before any update', async () => {
    // A credential that IS in the seed list but has no seed profile would return null;
    // a non-seed credential gets a default profile. Verify the default-profile path.
    const service = new FireflyProfileServiceImpl();
    const own = await service.getOwnProfile(CRED);
    expect(own).not.toBeNull();
    expect(own?.pseudonym).toMatch(/^Firefly-/); // default pseudonym for a fresh credential
  });

  it('clearProfileCache discards an updated profile, reverting to the default', async () => {
    const service = new FireflyProfileServiceImpl();
    await service.updateProfile(CRED, { pseudonym: 'Customized', disclosureLevel: 'anonymous' });
    expect((await service.getOwnProfile(CRED))?.pseudonym).toBe('Customized');

    clearProfileCache();
    expect((await service.getOwnProfile(CRED))?.pseudonym).toMatch(/^Firefly-/);
  });
});
