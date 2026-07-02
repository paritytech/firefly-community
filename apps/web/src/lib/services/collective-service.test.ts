/**
 * Tests for collective service.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  CollectiveServiceImpl,
  collectiveService,
  getActiveCollectives,
} from './collective-service';
import type { CollectiveMember } from '@cocuyo/types';
import { createCollectiveId, createDIMCredential } from '@cocuyo/types';

// Mock service utils
vi.mock('./service-utils', () => ({
  fetchFromBulletin: vi.fn(),
  paginate: vi.fn(<T>(items: T[], _params: unknown) => ({
    items,
    total: items.length,
    hasMore: false,
  })),
  filterByTopic: vi.fn(
    <T extends { topics: string[] }>(
      items: T[],
      _getter: unknown,
      topic: string | undefined
    ): T[] => {
      if (topic === undefined || topic === '') return items;
      return items.filter((item) => item.topics.includes(topic));
    }
  ),
}));

import { fetchFromBulletin } from './service-utils';
const mockedFetchFromBulletin = vi.mocked(fetchFromBulletin);

describe('CollectiveServiceImpl', () => {
  let service: CollectiveServiceImpl;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new CollectiveServiceImpl();
    mockedFetchFromBulletin.mockResolvedValue(null);
  });

  describe('getCollective', () => {
    it('returns seed collective by id', async () => {
      const result = await service.getCollective(createCollectiveId('seed-collective-001'));

      expect(result).not.toBeNull();
      expect(result?.name).toBe('Truth Seekers');
    });

    it('returns second seed collective', async () => {
      const result = await service.getCollective(createCollectiveId('seed-collective-002'));

      expect(result).not.toBeNull();
      expect(result?.name).toBe('Science Verifiers');
    });

    it('falls back to bulletin fetch for unknown id', async () => {
      await service.getCollective(createCollectiveId('unknown-id'));

      expect(mockedFetchFromBulletin).toHaveBeenCalledWith(createCollectiveId('unknown-id'));
    });

    it('returns null when not found anywhere', async () => {
      mockedFetchFromBulletin.mockResolvedValue(null);

      const result = await service.getCollective(createCollectiveId('nonexistent'));

      expect(result).toBeNull();
    });
  });

  describe('getCollectives', () => {
    it('returns paginated collective previews', async () => {
      const result = await service.getCollectives({
        pagination: { limit: 10, offset: 0 },
      });

      expect(result.items.length).toBeGreaterThan(0);
      expect(result.items[0]).toHaveProperty('id');
      expect(result.items[0]).toHaveProperty('name');
      expect(result.items[0]).toHaveProperty('memberCount');
      expect(result.items[0]).toHaveProperty('reputation');
    });

    it('filters by topic', async () => {
      const result = await service.getCollectives({
        topic: 'science',
        pagination: { limit: 10, offset: 0 },
      });

      // filterByTopic mock filters by topic
      expect(result.items.every((c) => c.topics.includes('science'))).toBe(true);
    });
  });

  describe('isMember', () => {
    it('returns false when collective not found', async () => {
      mockedFetchFromBulletin.mockResolvedValue(null);

      const result = await service.isMember(
        createCollectiveId('nonexistent'),
        createDIMCredential('user-1')
      );

      expect(result).toBe(false);
    });

    it('returns false when user is not a member', async () => {
      const result = await service.isMember(
        createCollectiveId('seed-collective-001'),
        createDIMCredential('not-a-member')
      );

      expect(result).toBe(false);
    });

    it('returns true after addMember', async () => {
      const collectiveId = createCollectiveId('seed-collective-001');
      const credential = createDIMCredential('new-member');

      service.addMember(collectiveId, {
        credentialHash: credential,
        pseudonym: 'New Member',
        role: 'member',
        joinedAt: Date.now(),
        verificationsCompleted: 0,
      });

      const result = await service.isMember(collectiveId, credential);
      expect(result).toBe(true);
    });
  });

  describe('getMemberRole', () => {
    it('returns null when not a member', async () => {
      const result = await service.getMemberRole(
        createCollectiveId('seed-collective-001'),
        createDIMCredential('not-a-member')
      );

      expect(result).toBeNull();
    });

    it('returns role after addMember', async () => {
      const collectiveId = createCollectiveId('seed-collective-001');
      const credential = createDIMCredential('role-test-member');

      service.addMember(collectiveId, {
        credentialHash: credential,
        pseudonym: 'Role Test',
        role: 'moderator',
        joinedAt: Date.now(),
        verificationsCompleted: 0,
      });

      const result = await service.getMemberRole(collectiveId, credential);
      expect(result).toBe('moderator');
    });
  });

  describe('getMember', () => {
    it('returns null when collective not found', async () => {
      mockedFetchFromBulletin.mockResolvedValue(null);

      const result = await service.getMember(
        createCollectiveId('nonexistent'),
        createDIMCredential('user-1')
      );

      expect(result).toBeNull();
    });

    it('returns null when user is not a member', async () => {
      const result = await service.getMember(
        createCollectiveId('seed-collective-001'),
        createDIMCredential('not-a-member')
      );

      expect(result).toBeNull();
    });

    it('returns member after addMember', async () => {
      const collectiveId = createCollectiveId('seed-collective-002');
      const credential = createDIMCredential('member-test');

      service.addMember(collectiveId, {
        credentialHash: credential,
        pseudonym: 'Member Test',
        role: 'member',
        joinedAt: Date.now(),
        verificationsCompleted: 0,
      });

      const result = await service.getMember(collectiveId, credential);
      expect(result).not.toBeNull();
      expect(result?.pseudonym).toBe('Member Test');
    });
  });

  describe('getCollectivesForMember', () => {
    it('returns empty array when user has no memberships', async () => {
      const result = await service.getCollectivesForMember(createDIMCredential('no-memberships'));

      expect(result).toEqual([]);
    });

    it('returns collectives after joining', async () => {
      const credential = createDIMCredential('multi-collective-member');

      service.addMember(createCollectiveId('seed-collective-001'), {
        credentialHash: credential,
        pseudonym: 'Multi Member',
        role: 'member',
        joinedAt: Date.now(),
        verificationsCompleted: 0,
      });

      const result = await service.getCollectivesForMember(credential);

      expect(result.length).toBeGreaterThan(0);
      expect(result.some((c) => c.id === createCollectiveId('seed-collective-001'))).toBe(true);
    });
  });

  describe('addMember', () => {
    it('adds member to collective', async () => {
      const collectiveId = createCollectiveId('seed-collective-001');
      const credential = createDIMCredential('add-test-member');

      service.addMember(collectiveId, {
        credentialHash: credential,
        pseudonym: 'Add Test',
        role: 'member',
        joinedAt: Date.now(),
        verificationsCompleted: 0,
      });

      const result = await service.isMember(collectiveId, credential);
      expect(result).toBe(true);
    });

    it('does not add duplicate members', async () => {
      const collectiveId = createCollectiveId('seed-collective-001');
      const credential = createDIMCredential('duplicate-test');
      const member: CollectiveMember = {
        credentialHash: credential,
        pseudonym: 'Duplicate Test',
        role: 'member',
        joinedAt: Date.now(),
        verificationsCompleted: 0,
      };

      service.addMember(collectiveId, member);
      service.addMember(collectiveId, member);

      const result = await service.isMember(collectiveId, credential);
      expect(result).toBe(true);
    });

    it('does nothing for nonexistent collective', () => {
      const credential = createDIMCredential('ghost-member');

      // Should not throw
      service.addMember(createCollectiveId('nonexistent'), {
        credentialHash: credential,
        pseudonym: 'Ghost',
        role: 'member',
        joinedAt: Date.now(),
        verificationsCompleted: 0,
      });
    });
  });
});

describe('collectiveService singleton', () => {
  it('is an instance of CollectiveServiceImpl', () => {
    expect(collectiveService).toBeInstanceOf(CollectiveServiceImpl);
  });
});

describe('getActiveCollectives', () => {
  it('returns collective previews from the backing cache', () => {
    const result = getActiveCollectives();
    expect(result.length).toBeGreaterThan(0);
    const [first] = result;
    // Shape check: preview fields, not the full Collective object.
    const shape: Record<string, unknown> = {
      id: expect.anything(),
      name: expect.any(String),
      topics: expect.any(Array),
      verificationsCompleted: expect.any(Number),
    };
    expect(first).toMatchObject(shape);
    expect(first).not.toHaveProperty('members');
    expect(first).not.toHaveProperty('governance');
  });

  it('respects the limit argument', () => {
    expect(getActiveCollectives(1)).toHaveLength(1);
    expect(getActiveCollectives(0)).toHaveLength(0);
  });
});
