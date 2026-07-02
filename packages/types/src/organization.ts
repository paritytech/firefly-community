/**
 * Organization types — multi-purpose organizational entities in F-Network.
 *
 * Organizations are the foundational identity layer for professional media outlets,
 * fact-checking collectives, civil society groups, and research institutions.
 * They have governance rules, treasury management, and membership with role-based permissions.
 */

import type { DIMCredential, OrganizationId, PolkadotAddress, TreasuryId } from './brands';

/**
 * Type of organization.
 *
 * - outlet: Professional media outlet (newsroom, news agency)
 * - collective: Fact-checking collective (group of verifiers)
 * - civil-society: NGO, advocacy group, or community organization
 * - research: Academic or research institution
 */
export type OrganizationType = 'outlet' | 'collective' | 'civil-society' | 'research';

/**
 * Role within an organization.
 *
 * - owner: Full control, can transfer ownership
 * - admin: Can manage members and most settings
 * - editor: Can publish and edit content
 * - contributor: Can create content drafts
 * - viewer: Read-only access
 */
export type OrganizationRole = 'owner' | 'admin' | 'editor' | 'contributor' | 'viewer';

/**
 * Granular permissions for organization operations.
 */
export type OrganizationPermission =
  // Treasury permissions
  | 'treasury:view'
  | 'treasury:propose'
  | 'treasury:approve'
  // Content permissions
  | 'content:publish'
  | 'content:edit'
  | 'content:draft'
  // Member management
  | 'members:invite'
  | 'members:remove'
  | 'members:role-change'
  // Governance
  | 'governance:vote'
  | 'governance:propose'
  // Settings
  | 'settings:view'
  | 'settings:edit';

/**
 * Role-to-permissions mapping.
 * Defines which permissions each role has by default.
 */
export const ROLE_PERMISSIONS: Readonly<
  Record<OrganizationRole, readonly OrganizationPermission[]>
> = {
  owner: [
    'treasury:view',
    'treasury:propose',
    'treasury:approve',
    'content:publish',
    'content:edit',
    'content:draft',
    'members:invite',
    'members:remove',
    'members:role-change',
    'governance:vote',
    'governance:propose',
    'settings:view',
    'settings:edit',
  ],
  admin: [
    'treasury:view',
    'treasury:propose',
    'content:publish',
    'content:edit',
    'content:draft',
    'members:invite',
    'members:remove',
    'governance:vote',
    'governance:propose',
    'settings:view',
    'settings:edit',
  ],
  editor: [
    'treasury:view',
    'content:publish',
    'content:edit',
    'content:draft',
    'governance:vote',
    'settings:view',
  ],
  contributor: ['treasury:view', 'content:draft', 'governance:vote', 'settings:view'],
  viewer: ['settings:view'],
};

/**
 * Get permissions for a role.
 */
export function getPermissionsForRole(role: OrganizationRole): readonly OrganizationPermission[] {
  return ROLE_PERMISSIONS[role];
}

/**
 * Check if a role has a specific permission.
 */
export function roleHasPermission(
  role: OrganizationRole,
  permission: OrganizationPermission
): boolean {
  return ROLE_PERMISSIONS[role].includes(permission);
}

/**
 * How new members can join the organization.
 */
export type OrganizationMembershipApproval = 'open' | 'vote' | 'invite-only';

/**
 * A member of an organization.
 */
export interface OrganizationMember {
  /** Member's DIM credential hash */
  readonly credentialHash: DIMCredential;
  /** Member's display pseudonym */
  readonly pseudonym: string;
  /** Role in the organization */
  readonly role: OrganizationRole;
  /** When they joined (Unix timestamp) */
  readonly joinedAt: number;
  /** Optional Polkadot address for treasury operations */
  readonly walletAddress?: PolkadotAddress;
  /** Member status */
  readonly status: 'active' | 'suspended' | 'pending';
}

/**
 * Governance rules for an organization.
 */
export interface OrganizationGovernance {
  /** How new members join */
  readonly membershipApproval: OrganizationMembershipApproval;
  /** Minimum votes needed for governance proposals */
  readonly minVotesForProposal: number;
  /** Percentage agreement needed for proposals (0-100) */
  readonly proposalThreshold: number;
  /** Treasury multi-sig threshold (e.g., 2 of 3) */
  readonly treasuryThreshold: number;
  /** Number of treasury signers required */
  readonly treasurySigners: number;
  /** Default proposal duration in milliseconds */
  readonly proposalDurationMs: number;
}

/**
 * Default governance settings.
 */
export const DEFAULT_GOVERNANCE: OrganizationGovernance = {
  membershipApproval: 'vote',
  minVotesForProposal: 3,
  proposalThreshold: 66,
  treasuryThreshold: 2,
  treasurySigners: 3,
  proposalDurationMs: 7 * 24 * 60 * 60 * 1000, // 7 days
};

/**
 * Reputation metrics for an organization.
 */
export interface OrganizationReputation {
  /** Overall reputation score 0-100 */
  readonly score: number;
  /** Total content pieces published */
  readonly contentPublished: number;
  /** For collectives: total verifications completed */
  readonly verificationsCompleted?: number;
  /** Accuracy rate for fact-checking (if applicable) */
  readonly accuracyRate?: number;
  /** Member satisfaction/engagement score */
  readonly engagementScore: number;
}

/**
 * An organization in the Firefly Network.
 */
export interface Organization {
  /** Unique identifier */
  readonly id: OrganizationId;
  /** CID on Bulletin Chain */
  readonly cid?: string;
  /** Organization type */
  readonly type: OrganizationType;
  /** Display name */
  readonly name: string;
  /** Short description (for previews) */
  readonly description: string;
  /** Full mission statement */
  readonly mission: string;
  /** Topics/domains this organization focuses on */
  readonly topics: readonly string[];
  /** Geographic focus (optional) */
  readonly location?: string;
  /** Current members */
  readonly members: readonly OrganizationMember[];
  /** Governance rules */
  readonly governance: OrganizationGovernance;
  /** Reputation metrics */
  readonly reputation: OrganizationReputation;
  /** Associated treasury ID (if created) */
  readonly treasuryId?: TreasuryId;
  /** Website URL */
  readonly websiteUrl?: string;
  /** When created (Unix timestamp) */
  readonly createdAt: number;
  /** When last updated (Unix timestamp) */
  readonly updatedAt: number;
}

/**
 * Preview card for organization listings.
 */
export interface OrganizationPreview {
  readonly id: OrganizationId;
  readonly type: OrganizationType;
  readonly name: string;
  readonly description: string;
  readonly topics: readonly string[];
  readonly location?: string;
  readonly memberCount: number;
  readonly reputation: number;
}

/**
 * Data needed to create a new organization.
 */
export interface NewOrganization {
  readonly type: OrganizationType;
  readonly name: string;
  readonly description: string;
  readonly mission: string;
  readonly topics: readonly string[];
  readonly location?: string;
  readonly websiteUrl?: string;
  /** Optional custom governance (defaults to DEFAULT_GOVERNANCE) */
  readonly governance?: Partial<OrganizationGovernance>;
}

/**
 * Status of a membership invitation.
 */
export type InvitationStatus = 'pending' | 'accepted' | 'declined' | 'expired';

/**
 * An invitation to join an organization.
 */
export interface OrganizationInvitation {
  /** Invitation ID */
  readonly id: string;
  /** Organization being joined */
  readonly organizationId: OrganizationId;
  /** Inviter's credential */
  readonly invitedBy: DIMCredential;
  /** Invitee's credential */
  readonly invitee: DIMCredential;
  /** Proposed role for the invitee */
  readonly proposedRole: OrganizationRole;
  /** Optional message */
  readonly message?: string;
  /** Current status */
  readonly status: InvitationStatus;
  /** When invitation was sent (Unix timestamp) */
  readonly sentAt: number;
  /** When invitation expires (Unix timestamp) */
  readonly expiresAt: number;
  /** When invitation was resolved (Unix timestamp) */
  readonly resolvedAt?: number;
}

/**
 * A request to join an organization (for 'open' or 'vote' membership types).
 */
export interface OrganizationJoinRequest {
  /** Request ID */
  readonly id: string;
  /** Organization being joined */
  readonly organizationId: OrganizationId;
  /** Applicant info */
  readonly applicant: {
    readonly credentialHash: DIMCredential;
    readonly pseudonym: string;
  };
  /** Message from applicant */
  readonly message: string;
  /** Requested role (usually 'contributor' or 'viewer') */
  readonly requestedRole: OrganizationRole;
  /** Current status */
  readonly status: 'pending' | 'approved' | 'rejected';
  /** Votes from existing members (if membership is 'vote') */
  readonly votes: readonly {
    readonly voter: DIMCredential;
    readonly approve: boolean;
    readonly votedAt: number;
  }[];
  /** When request was created (Unix timestamp) */
  readonly createdAt: number;
  /** When request was resolved (Unix timestamp) */
  readonly resolvedAt?: number;
}

/**
 * Convert an Organization to an OrganizationPreview.
 */
export function organizationToPreview(org: Organization): OrganizationPreview {
  const preview: OrganizationPreview = {
    id: org.id,
    type: org.type,
    name: org.name,
    description: org.description,
    topics: org.topics,
    memberCount: org.members.filter((m) => m.status === 'active').length,
    reputation: org.reputation.score,
  };

  if (org.location !== undefined) {
    return { ...preview, location: org.location };
  }

  return preview;
}
