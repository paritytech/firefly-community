/**
 * Tests for organization utilities.
 */

import { describe, it, expect } from 'vitest';
import {
  ROLE_PERMISSIONS,
  DEFAULT_GOVERNANCE,
  getPermissionsForRole,
  roleHasPermission,
  organizationToPreview,
  type Organization,
} from './organization';
import { createOrganizationId, createDIMCredential } from './brands';

describe('ROLE_PERMISSIONS', () => {
  it('owner has all permissions', () => {
    expect(ROLE_PERMISSIONS.owner).toContain('treasury:view');
    expect(ROLE_PERMISSIONS.owner).toContain('treasury:propose');
    expect(ROLE_PERMISSIONS.owner).toContain('treasury:approve');
    expect(ROLE_PERMISSIONS.owner).toContain('content:publish');
    expect(ROLE_PERMISSIONS.owner).toContain('content:edit');
    expect(ROLE_PERMISSIONS.owner).toContain('content:draft');
    expect(ROLE_PERMISSIONS.owner).toContain('members:invite');
    expect(ROLE_PERMISSIONS.owner).toContain('members:remove');
    expect(ROLE_PERMISSIONS.owner).toContain('members:role-change');
    expect(ROLE_PERMISSIONS.owner).toContain('governance:vote');
    expect(ROLE_PERMISSIONS.owner).toContain('governance:propose');
    expect(ROLE_PERMISSIONS.owner).toContain('settings:view');
    expect(ROLE_PERMISSIONS.owner).toContain('settings:edit');
  });

  it('admin has management permissions but not treasury:approve', () => {
    expect(ROLE_PERMISSIONS.admin).toContain('treasury:view');
    expect(ROLE_PERMISSIONS.admin).toContain('treasury:propose');
    expect(ROLE_PERMISSIONS.admin).not.toContain('treasury:approve');
    expect(ROLE_PERMISSIONS.admin).toContain('members:invite');
    expect(ROLE_PERMISSIONS.admin).toContain('members:remove');
    expect(ROLE_PERMISSIONS.admin).not.toContain('members:role-change');
  });

  it('editor has publish and edit permissions', () => {
    expect(ROLE_PERMISSIONS.editor).toContain('content:publish');
    expect(ROLE_PERMISSIONS.editor).toContain('content:edit');
    expect(ROLE_PERMISSIONS.editor).toContain('content:draft');
    expect(ROLE_PERMISSIONS.editor).not.toContain('members:invite');
  });

  it('contributor has draft permissions', () => {
    expect(ROLE_PERMISSIONS.contributor).toContain('content:draft');
    expect(ROLE_PERMISSIONS.contributor).not.toContain('content:publish');
    expect(ROLE_PERMISSIONS.contributor).not.toContain('content:edit');
    expect(ROLE_PERMISSIONS.contributor).toContain('governance:vote');
  });

  it('viewer has minimal permissions', () => {
    expect(ROLE_PERMISSIONS.viewer).toContain('settings:view');
    expect(ROLE_PERMISSIONS.viewer).not.toContain('governance:vote');
    expect(ROLE_PERMISSIONS.viewer).not.toContain('content:draft');
  });
});

describe('DEFAULT_GOVERNANCE', () => {
  it('has sensible default values', () => {
    expect(DEFAULT_GOVERNANCE.membershipApproval).toBe('vote');
    expect(DEFAULT_GOVERNANCE.minVotesForProposal).toBe(3);
    expect(DEFAULT_GOVERNANCE.proposalThreshold).toBe(66);
    expect(DEFAULT_GOVERNANCE.treasuryThreshold).toBe(2);
    expect(DEFAULT_GOVERNANCE.treasurySigners).toBe(3);
    expect(DEFAULT_GOVERNANCE.proposalDurationMs).toBe(7 * 24 * 60 * 60 * 1000);
  });
});

describe('getPermissionsForRole', () => {
  it('returns permissions for owner', () => {
    const permissions = getPermissionsForRole('owner');
    expect(permissions).toBe(ROLE_PERMISSIONS.owner);
  });

  it('returns permissions for admin', () => {
    const permissions = getPermissionsForRole('admin');
    expect(permissions).toBe(ROLE_PERMISSIONS.admin);
  });

  it('returns permissions for editor', () => {
    const permissions = getPermissionsForRole('editor');
    expect(permissions).toBe(ROLE_PERMISSIONS.editor);
  });

  it('returns permissions for contributor', () => {
    const permissions = getPermissionsForRole('contributor');
    expect(permissions).toBe(ROLE_PERMISSIONS.contributor);
  });

  it('returns permissions for viewer', () => {
    const permissions = getPermissionsForRole('viewer');
    expect(permissions).toBe(ROLE_PERMISSIONS.viewer);
  });
});

describe('roleHasPermission', () => {
  it('owner has treasury:approve permission', () => {
    expect(roleHasPermission('owner', 'treasury:approve')).toBe(true);
  });

  it('admin does not have treasury:approve permission', () => {
    expect(roleHasPermission('admin', 'treasury:approve')).toBe(false);
  });

  it('editor has content:publish permission', () => {
    expect(roleHasPermission('editor', 'content:publish')).toBe(true);
  });

  it('contributor does not have content:publish permission', () => {
    expect(roleHasPermission('contributor', 'content:publish')).toBe(false);
  });

  it('contributor has governance:vote permission', () => {
    expect(roleHasPermission('contributor', 'governance:vote')).toBe(true);
  });

  it('viewer does not have governance:vote permission', () => {
    expect(roleHasPermission('viewer', 'governance:vote')).toBe(false);
  });
});

describe('organizationToPreview', () => {
  const createMockOrganization = (): Organization => ({
    id: createOrganizationId('org-1'),
    name: 'Test Organization',
    description: 'A test organization for testing purposes.',
    mission: 'To test things thoroughly.',
    type: 'collective',
    topics: ['politics', 'environment'],
    members: [
      {
        credentialHash: createDIMCredential('user-1'),
        role: 'owner',
        pseudonym: 'Owner User',
        joinedAt: Date.now() - 86400000,
        status: 'active',
      },
      {
        credentialHash: createDIMCredential('user-2'),
        role: 'contributor',
        pseudonym: 'Member User',
        joinedAt: Date.now(),
        status: 'active',
      },
    ],
    governance: DEFAULT_GOVERNANCE,
    reputation: {
      score: 85,
      contentPublished: 50,
      verificationsCompleted: 100,
      accuracyRate: 0.92,
      engagementScore: 78,
    },
    createdAt: Date.now() - 86400000,
    updatedAt: Date.now(),
  });

  it('converts organization to preview', () => {
    const org = createMockOrganization();
    const preview = organizationToPreview(org);

    expect(preview.id).toBe(org.id);
    expect(preview.name).toBe(org.name);
    expect(preview.description).toBe(org.description);
    expect(preview.type).toBe(org.type);
    expect(preview.topics).toEqual(org.topics);
    expect(preview.memberCount).toBe(2);
    expect(preview.reputation).toBe(85);
  });

  it('only counts active members', () => {
    const org = createMockOrganization();
    const orgWithSuspended: Organization = {
      ...org,
      members: [
        ...org.members,
        {
          credentialHash: createDIMCredential('user-3'),
          role: 'editor',
          pseudonym: 'Suspended User',
          joinedAt: Date.now(),
          status: 'suspended',
        },
        {
          credentialHash: createDIMCredential('user-4'),
          role: 'contributor',
          pseudonym: 'Pending User',
          joinedAt: Date.now(),
          status: 'pending',
        },
      ],
    };

    const preview = organizationToPreview(orgWithSuspended);

    expect(preview.memberCount).toBe(2); // Only active members
  });

  it('includes location when present', () => {
    const org = createMockOrganization();
    const orgWithLocation: Organization = {
      ...org,
      location: 'San Francisco, CA',
    };

    const preview = organizationToPreview(orgWithLocation);

    expect(preview.location).toBe('San Francisco, CA');
  });

  it('excludes location when not present', () => {
    const org = createMockOrganization();
    const preview = organizationToPreview(org);

    expect('location' in preview).toBe(false);
  });
});
