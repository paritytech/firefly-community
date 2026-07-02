# ADR 006: Firefly Network UX Rework - Single Conscious Creation

**Status:** Accepted
**Date:** 2026-04-07

## Context

The current UX exposes multiple object types (Signal, Post, Claim) to users, creating cognitive load and confusion. Users need to understand when to create a Signal vs a Post, and "Claim" is technical terminology that doesn't resonate with general users.

## Decision

Implement the "single conscious creation" design principle: users only create **Posts**. All other objects (Claims, Evidence, Verdicts) emerge from gestures users already understand.

### User-Visible Vocabulary

- **Post** - what users create
- **Corroborate** - supporting evidence gesture
- **Dispute** - challenging evidence gesture
- **Story** - collection of related posts
- **Bounty** - funded investigation
- **Verdict** - collective determination

### Hidden from Primary UI

- **Signal** - internal/legacy term, replaced by Post
- **Claim** - internal term, only visible in Trust Drawer

## Implementation Plan

---

## Phase 1: Type Layer Refactoring

### 1.1 Rename Signal → Post (packages/types/src/)

The current `Signal` type becomes what users call "Post." The current `Post` type is retired.

**Changes to `signal.ts` → merge into `post.ts`:**

- Rename `Signal` → `Post`
- Rename `SignalId` → `PostId` (use existing PostId brand)
- Rename `NewSignal` → `NewPost`
- Add optional `title?: string` to `PostContent`
- Rename all related types: `SignalContent` → `PostContent`, `SignalContext` → `PostContext`, etc.

**Changes to `brands.ts`:**

- Remove `SignalId` (use existing `PostId`)
- Remove `createSignalId` (use existing `createPostId`)
- Add `VerdictId` brand type

**Delete old `post.ts`** — its structure is absorbed into the renamed signal.ts

**Update `index.ts`** — export the renamed types, remove old Signal exports

### 1.2 Extend Corroboration with Evidence Fields

**Changes to `corroboration.ts`:**

```typescript
/** Evidence type for submissions via Corroborate/Dispute */
export type EvidenceType =
  | 'source_link' // URL input
  | 'document' // File upload (placeholder)
  | 'photo' // Image upload (placeholder)
  | 'observation'; // Free text firsthand account

export interface Corroboration {
  // ... existing fields ...
  readonly postId: PostId; // renamed from signalId

  // NEW evidence fields (nullable - only present when evidence submitted)
  readonly evidenceType?: EvidenceType;
  readonly evidenceContent?: string; // URL, file ref, or text
  readonly evidenceDescription?: string; // "What does this show?"
}
```

### 1.3 Update Bounty and Claim Types

**Changes to `bounty.ts`:**

- Rename `contributingSignals` → `contributingPostIds`
- Update `BountyContribution.signalId` → `postId`

**Changes to `claim.ts`:**

- Keep `ClaimEvidence` but update `signalId` → `postId` (evidence references the Post it came from)
- Claim stays internal — UI never shows "Claim" word

### 1.4 Add Verdict Type

**New types in `claim.ts` or separate file:**

```typescript
/** Verdict ID brand */
export type VerdictId = string & { readonly __brand: 'VerdictId' };

/** Verdict status (user-visible) */
export type VerdictStatus = 'confirmed' | 'disputed' | 'false' | 'synthetic' | 'inconclusive';

export interface Verdict {
  readonly id: VerdictId;
  readonly claimId: ClaimId;
  readonly collectiveId: CollectiveId;
  readonly status: VerdictStatus;
  readonly rationale: string;
  readonly issuedAt: number;
}
```

---

## Phase 2: Session State Management

### 2.1 Create AppStateProvider (apps/web/src/components/)

A single context provider managing all session state. No persistence, no mock data.

**File: `AppStateProvider.tsx`**

```typescript
interface AppState {
  // Core entities
  posts: Map<PostId, Post>;
  corroborations: Map<CorroborationId, Corroboration>;
  claims: Map<ClaimId, Claim>;
  bounties: Map<BountyId, Bounty>;
  storyChains: Map<ChainId, StoryChain>;
  verdicts: Map<VerdictId, Verdict>;

  // User state
  currentUser: {
    isConnected: boolean;
    isOutletAccount: boolean; // flag for bounty creation permission
    credentialHash: DIMCredential | null;
    pseudonym: string | null;
    createdPostIds: PostId[];
    createdStoryIds: ChainId[];
    corroborationIds: CorroborationId[];
  };

  // Derived data
  postClaims: Map<PostId, ClaimId[]>;
  postCorroborations: Map<PostId, CorroborationId[]>;
  postBounties: Map<PostId, BountyId[]>;
  bountyPosts: Map<BountyId, PostId[]>;
  claimVerdicts: Map<ClaimId, VerdictId | null>;
}

interface AppStateActions {
  createPost: (input: NewPost) => Post;
  submitCorroboration: (
    postId: PostId,
    type: 'corroborate' | 'dispute',
    evidence: EvidenceInput
  ) => Corroboration;
  extractClaim: (postId: PostId, statement: string) => Claim;
  createBounty: (postId: PostId, input: NewBountyInput) => Bounty;
  issueVerdict: (claimId: ClaimId, verdict: VerdictInput) => Verdict;
  createStory: (title: string, description: string, firstPostId: PostId) => StoryChain;
  addPostToStory: (chainId: ChainId, postId: PostId) => void;
  toggleOutletMode: () => void; // for demo purposes
}
```

### 2.2 Update Existing Providers

- **IlluminateProvider** → becomes `CreatePostProvider` (terminology change)
- **CreateBountyProvider** → keep, but update to use new state

---

## Phase 3: UI Components

### 3.1 New PostCard Component (packages/ui/src/components/PostCard/)

Replace current PostCard and SignalCard with unified component supporting all states.

**States to support:**

1. Default (no bounty, no verdict)
2. Bounty attached, no verdict
3. Verdict issued

**Structure:**

```typescript
interface PostCardProps {
  post: Post;
  bounty?: BountyBadgeInfo;
  verdict?: VerdictBadgeInfo;
  corroborationCount: number;
  disputeCount: number;

  // Callbacks
  onCorroborate: () => void;
  onDispute: () => void;
  onAddToStory: () => void;
  onOpenTrustDrawer: () => void;
  onClick?: () => void;
}
```

**Visual elements:**

- Author row: avatar + pseudonym + firefly verification indicator
- Title (if present, Unbounded font, larger)
- Body text
- Context tags (topic, location, timestamp)
- Corroboration/Dispute counts (evidence counts, not engagement)
- Action buttons: [Corroborate] [Dispute] + subtle "Add to Story"
- Bounty badge (if attached): "Under investigation" or "Verification funded" with gold accent
- Verdict badge (if issued): Confirmed/Disputed/False/Synthetic/Inconclusive with gold accent

### 3.2 CorroborateDisputeSheet Component (apps/web/src/components/)

Bottom sheet for evidence submission. Opens on Corroborate/Dispute tap.

**File: `CorroborateDisputeSheet/CorroborateDisputeSheet.tsx`**

**Props:**

```typescript
interface CorroborateDisputeSheetProps {
  isOpen: boolean;
  mode: 'corroborate' | 'dispute';
  post: Post;
  bounty?: BountyBadgeInfo;
  onSubmit: (evidence: EvidenceInput) => void;
  onClose: () => void;
}

interface EvidenceInput {
  type: EvidenceType;
  content: string;
  description?: string;
}
```

**UI Structure:**

- Header: "Add your evidence" (or "This post is under funded investigation..." if bounty)
- Evidence type selector: radio buttons for source_link / document / photo / observation
- Input area: URL input, file upload placeholder, or textarea based on type
- Optional description field
- Submit button: "Corroborate" or "Dispute" (matches mode)

### 3.3 TrustDrawer Component (apps/web/src/components/)

Responsive: bottom sheet on mobile, side drawer on desktop.

**File: `TrustDrawer/TrustDrawer.tsx`**

**Props:**

```typescript
interface TrustDrawerProps {
  isOpen: boolean;
  post: Post;
  claims: Claim[];
  corroborations: Corroboration[];
  bounty?: Bounty;
  verdict?: Verdict;
  onClose: () => void;
}
```

**Sections:**

1. **Claims section**: extracted claim statements, status badges
2. **Evidence section**: corroborations grouped by type (corroborating/challenging)
3. **Verdict section**: if exists, show prominently with rationale
4. **Bounty section**: if exists, show title, description, funding, collective

### 3.4 AddToStorySheet Component

For creating new stories or adding to existing ones.

**File: `AddToStorySheet/AddToStorySheet.tsx`**

**Two modes:**

- "Start new story": title + description form
- "Add to existing story": searchable list of user's stories

### 3.5 CreateBountySheet Component

Updated bounty creation flow (outlet/collective only).

**Fields:**

- Title
- Description
- Target Post (pre-filled if opened from a Post)
- Target scope: "General investigation" or specific claim
- Funding amount (display only)
- Assign to Collective (optional dropdown)

### 3.6 ExtractClaimSheet Component

User-initiated claim extraction from Trust Drawer.

**File: `ExtractClaimSheet/ExtractClaimSheet.tsx`**

**Fields:**

- Claim statement textarea
- Submit button

### 3.7 VerdictBadge Component

Distinct from VerificationBadge. Shows verdict status with gold accent.

**Statuses with colors:**

- Confirmed: gold background
- Disputed: amber/warning
- False: red
- Synthetic: orange
- Inconclusive: gray

### 3.8 OutletModeToggle Component

For demo purposes only. A simple toggle in the settings/debug area.

**File: `OutletModeToggle.tsx`**

Allows demoing bounty creation without wallet switching.

### 3.9 IssueVerdictSheet Component

Accessible from TrustDrawer when currentUser.isOutletAccount is true
and a Claim exists with no current Verdict.

Fields:

- Claim statement (read-only, showing which claim is being adjudicated)
- Verdict status selector: Confirmed / Disputed / False / Synthetic / Inconclusive
- Rationale (textarea, required)
- Submit button: "Issue Verdict"

On submit:

- Verdict is created in AppState
- Trust drawer updates to show Verdict section
- Post card updates to show Verdict badge
- IssueVerdictSheet closes

---

## Phase 4: Route Updates

### 4.1 Redirect Signal Routes

**File: `apps/web/src/app/[locale]/signal/[id]/page.tsx`**

Convert to redirect:

```typescript
import { redirect } from 'next/navigation';

export default function SignalRedirect({ params }) {
  redirect(`/${params.locale}/explore`);
}
```

### 4.2 Update Explore Page

**File: `apps/web/src/app/[locale]/explore/page.tsx`**

- Rename "Signals" tab → "Posts"
- Use new PostCard component
- Remove SignalCard usage
- Bounties appear as badges on Posts, not separate tab
- Keep Stories tab

### 4.3 Update Post Detail Page

**File: `apps/web/src/app/[locale]/post/[id]/page.tsx`**

- Update to use new Post type (merged from Signal)
- Include TrustDrawer access
- Include Corroborate/Dispute buttons

---

## Phase 5: Vocabulary and Copy Updates

### 5.1 Translation Files

Update all translation files to:

- Remove "Signal" terminology in user-facing strings
- Remove "Claim" from primary UI (keep for trust drawer labels)
- Use "Post", "Corroborate", "Dispute", "Story", "Bounty", "Verdict"

### 5.2 Component Props and Translations

- Update `SignalCardTranslations` → `PostCardTranslations`
- Update info popovers in explore page
- Update all aria-labels and accessibility text

---

## Phase 6: Integration and Polish

### 6.1 Wire Up State to Components

- Connect AppStateProvider to all pages via layout
- Update services to use new state (or bypass services, use context directly)
- Ensure all five states are reachable:
  1. Empty feed (no Posts)
  2. Post with no corroborations, no bounty, no verdict
  3. Post with corroborations but no bounty
  4. Post with bounty and corroborations but no verdict
  5. Post with complete chain: bounty → corroborations → verdict

### 6.2 Demo Flow Testing

Verify these user journeys work:

1. **Casual reader**: Open feed → see empty state → create Post → see it in feed
2. **Contributor**: Open Post → tap Corroborate → submit evidence → see count update
3. **Story curator**: Create Post → Add to Story → create new Story → view Story page
4. **Outlet**: Toggle outlet mode → Create Bounty on Post → see badge appear
5. **Collective**: Issue Verdict on claim → see badge appear on Post

---

## Critical Clarifications

### Post-Bounty Relationship

Bounties can have multiple contributing posts. Posts can contribute to multiple bounties.

```typescript
// In AppState
postBounties: Map<PostId, BountyId[]>; // Posts contributing to which bounties
bountyPosts: Map<BountyId, PostId[]>; // Bounty's contributing posts

// The "bounty badge" on a PostCard shows the PRIMARY bounty (first attached)
// Trust drawer shows all bounties a post contributes to
```

### SignalId Migration Strategy

**Clean break** (not aliasing). Update all references from `SignalId` to `PostId` in one pass. The codebase is small enough and all in TypeScript — the compiler will catch missed references.

Affected locations:

- `Corroboration.signalId` → `postId`
- `NewCorroboration.signalId` → `postId`
- `ClaimEvidence.signalId` → `postId`
- `BountyContribution.signalId` → `postId`
- `StoryChain.signalIds` → `postIds`
- `ChainStats.signalCount` → `postCount`
- All service interfaces

### Post Type Must Inherit Signal's Verification

The merged Post type keeps the `SignalVerification` structure (renamed to `PostVerification`):

```typescript
export interface PostVerification {
  readonly status: VerificationStatus;
  readonly verifiedBy?: CollectiveId;
  readonly verdictCid?: string;
  readonly verifiedAt?: number;
}
```

### Claim Extraction

For the demo, claims are **user-initiated** (not auto-extracted). Any user can extract a claim from a post via the Trust Drawer. In a future version, AI-assisted extraction could suggest claims.

### User Content Tracking

Add to AppState:

```typescript
currentUser: {
  // ... existing fields ...
  createdPostIds: PostId[];
  createdStoryIds: ChainId[];
  corroborationIds: CorroborationId[];
}
```

---

## File Checklist

### Types (packages/types/src/)

- [ ] Merge `signal.ts` content into `post.ts`
- [ ] Update `brands.ts` (add VerdictId, remove SignalId)
- [ ] Update `corroboration.ts` (add evidence fields, rename signalId → postId)
- [ ] Update `bounty.ts` (rename signal references to post)
- [ ] Update `claim.ts` (rename signal references to post)
- [ ] Update `chain.ts` (rename signalIds → postIds, signalCount → postCount)
- [ ] Add Verdict types
- [ ] Update `services.ts`
- [ ] Update `index.ts` exports
- [ ] Delete old `signal.ts`

### Components (packages/ui/src/components/)

- [ ] Create new `PostCard/` (replaces SignalCard and old PostCard)
- [ ] Delete old `SignalCard/`
- [ ] Delete old `PostCard/`
- [ ] Update `VerificationBadge/` for verdict statuses

### App Components (apps/web/src/components/)

- [ ] Create `AppStateProvider.tsx`
- [ ] Create `CorroborateDisputeSheet/`
- [ ] Create `TrustDrawer/`
- [ ] Create `AddToStorySheet/`
- [ ] Create `ExtractClaimSheet/`
- [ ] Update `CreateBountyModal/` or create `CreateBountySheet/`
- [ ] Rename `IlluminateProvider` → `CreatePostProvider`
- [ ] Update `IlluminateModal` → `CreatePostModal`
- [ ] Create `VerdictBadge.tsx`
- [ ] Create `OutletModeToggle.tsx` (for demo)

### Routes (apps/web/src/app/[locale]/)

- [ ] Update `explore/` page and components
- [ ] Update `post/[id]/` page
- [ ] Convert `signal/[id]/` to redirect
- [ ] Update `chain/[id]/` to use new types
- [ ] Update `bounties/` and `bounty/[id]/`

### Services (apps/web/src/lib/services/)

- [ ] Update or bypass to use AppStateProvider

### Translations (apps/web/messages/)

- [ ] Update en.json
- [ ] Update es.json

---

## Verification

After implementation, verify:

1. **Type safety**: `pnpm typecheck` passes
2. **Lint**: `pnpm lint` passes with zero warnings
3. **Build**: `pnpm build` succeeds
4. **Dev server**: `pnpm dev` runs without errors
5. **All five post states** reachable through UI interactions
6. **All five user journeys** work end-to-end
7. **Responsive behavior**: Trust drawer works as bottom sheet (mobile) and side drawer (desktop)
8. **No "Signal" or "Claim" in primary UI** (only in trust drawer for claims)

---

## Consequences

### Positive

- Simpler mental model for users (create Posts, not Signals/Posts/Claims)
- Reduced cognitive load in primary UI
- More intuitive evidence submission flow
- Cleaner vocabulary alignment with user expectations

### Negative

- Significant refactoring effort across types, components, and routes
- Need to update all translations
- Existing mock data and tests need updating

### Neutral

- Claims remain as internal concept for verification workflow
- Bounties attach to Posts rather than being standalone entities in feed
