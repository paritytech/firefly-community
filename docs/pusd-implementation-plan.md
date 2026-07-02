# pUSD + Coinage Implementation Plan

> [!WARNING]
> **Experimental concept/design document.** This code is developed and published by Parity as a prototype and proof-of-concept — it is **not** a Parity product or an operated service. The design here is experimental and unaudited; all figures, timelines, and dependencies are **illustrative only** and do not represent commitments.

> Detailed task breakdown for Phases 1-2b (no external dependencies)

## Overview

This plan covers the phases we can implement immediately without waiting for external dependencies (pUSD Asset ID, Coinage deployment).

**Goal:** Working prototype with full UX using mock services.

---

## Phase 1: Currency Foundation

**Duration:** 1-2 weeks
**Dependencies:** None

### 1.1 Create Currency Types ✅ COMPLETE

**File:** `packages/types/src/currency.ts`

- [x] Define `PUSD` configuration constant (symbol, decimals, etc.)
- [x] Create `PUSDAmount` branded type
- [x] Implement `createPUSDAmount()` constructor with validation
- [x] Implement `parsePUSD()` for string → amount conversion
- [x] Implement `formatPUSD()` for amount → display string
- [x] Implement `addPUSD()`, `subtractPUSD()` arithmetic helpers
- [x] Define `PUSDBalance` interface (available, locked, total)
- [x] Write unit tests for all utilities (46 tests)

### 1.2 Create Coinage Types ✅ COMPLETE

**File:** `packages/types/src/coinage.ts`

- [x] Define `CoinExponent` type (0-14)
- [x] Define `COIN_VALUES_CENTS` constant mapping
- [x] Create `Coin` interface (exponent, age, owner, derivationIndex)
- [x] Create `CoinPublicKey` branded type
- [x] Create `CoinWallet` interface
- [x] Create `RecyclerVoucher` interface
- [x] Create `RecyclerClaimToken` type (free_person, free_lite_person, paid)
- [x] Create `PendingTransfer` interface
- [x] Implement `decomposeAmountCents()` for amount → denominations
- [x] Implement `formatCoinValue()` for display
- [x] Write unit tests (38 tests)

### 1.3 Create Payment Mode Types ✅ COMPLETE

**File:** `packages/types/src/payment-mode.ts`

- [x] Define `PaymentMode` type ('public' | 'private')
- [x] Define `PaymentModeContext` interface (useCase, preferences, compliance)
- [x] Implement `selectPaymentMode()` logic
- [x] Write unit tests (31 tests)

### 1.4 Extend Existing Types ✅ COMPLETE

**File:** `packages/types/src/brands.ts`

- [x] Add `TransactionHash` branded type
- [x] Add `EscrowId` branded type
- [x] Add `CoinPublicKey` branded type

**File:** `packages/types/src/bounty.ts`

- [x] Import `PUSDAmount` type
- [x] Update `fundingAmount` to use `PUSDAmount`
- [x] Add `escrowId` field
- [x] Add `fundingTxHash` field
- [x] Add `payoutMode` field
- [x] Create `BountyPayout` interface
- [x] Create `PayoutDistribution` interface

**File:** `apps/web/src/lib/services/mock-data-bounties.ts`

- [x] Update mock data to use new types

### 1.5 Export All Types ✅ COMPLETE

**File:** `packages/types/src/index.ts`

- [x] Export currency module
- [x] Export coinage module
- [x] Export payment-mode module

---

## Phase 2: Mock Payment Services

**Duration:** 2-3 weeks
**Dependencies:** Phase 1

### 2.1 Create Payments Package

**Directory:** `packages/payments/`

- [ ] Create `package.json` with dependencies
- [ ] Create `tsconfig.json` extending base config
- [ ] Create `src/index.ts` with exports

### 2.2 Define Service Interfaces

**File:** `packages/types/src/services.ts` (extend existing)

- [ ] Define `PaymentService` interface
  - [ ] `getBalance(address): Promise<PUSDBalance>`
  - [ ] `transfer(from, to, amount): Promise<TransactionHash>`
  - [ ] `watchTransfers(address, callback): Unsubscribe`

- [ ] Define `EscrowService` interface
  - [ ] `createEscrow(bountyId, funder, amount): Promise<EscrowState>`
  - [ ] `getEscrow(escrowId): Promise<EscrowState | null>`
  - [ ] `releaseFunds(escrowId, distributions): Promise<TransactionHash>`
  - [ ] `refundFunds(escrowId): Promise<TransactionHash>`

- [ ] Define `CoinageService` interface
  - [ ] `scanForCoins(): Promise<CoinWallet>`
  - [ ] `onboard(amount, source): Promise<RecyclerVoucher[]>`
  - [ ] `claimCoins(vouchers, claimToken): Promise<Coin[]>`
  - [ ] `splitCoin(coin, into): Promise<Coin[]>`
  - [ ] `prepareTransfer(coins): TransferPackage`
  - [ ] `claimTransfer(keys): Promise<Coin[]>`
  - [ ] `recycleCoin(coins, claimToken): Promise<Coin[]>`
  - [ ] `offboard(coins, destination, claimToken): Promise<TransactionHash>`

### 2.3 Implement Mock Payment Service

**File:** `packages/payments/src/mock-payment-service.ts`

- [ ] Create `MockPaymentService` class
- [ ] Implement in-memory balance tracking
- [ ] Implement mock transfer with delays
- [ ] Implement mock event emission
- [ ] Write unit tests

### 2.4 Implement Mock Escrow Service

**File:** `packages/payments/src/mock-escrow-service.ts`

- [ ] Create `MockEscrowService` class
- [ ] Implement in-memory escrow state
- [ ] Implement create/release/refund logic
- [ ] Validate distribution amounts
- [ ] Write unit tests

### 2.5 Implement Mock Coinage Service

**File:** `packages/payments/src/mock-coinage-service.ts`

- [ ] Create `MockCoinageService` class
- [ ] Implement mock coin wallet
- [ ] Implement mock onboard/offboard
- [ ] Implement mock split/transfer
- [ ] Implement mock recycler (instant, no real privacy)
- [ ] Write unit tests

### 2.6 Create Payment Router

**File:** `packages/payments/src/router.ts`

- [ ] Create `PaymentRouter` class
- [ ] Implement mode selection logic
- [ ] Route to appropriate service based on mode
- [ ] Write unit tests

### 2.7 Create React Hooks

**File:** `apps/web/src/lib/hooks/usePayments.ts`

- [ ] Create `usePaymentService()` hook
- [ ] Create `useEscrowService()` hook
- [ ] Create `useCoinageService()` hook
- [ ] Create `useWalletBalance()` hook
- [ ] Wire to context providers

---

## Phase 2b: Bounty UI

**Duration:** 3-4 weeks
**Dependencies:** Phase 2

### 2b.1 Wallet Dashboard Component

**Directory:** `apps/web/src/components/Wallet/`

- [ ] Create `WalletDashboard.tsx` - main dashboard
- [ ] Create `PublicBalance.tsx` - pUSD balance display
- [ ] Create `PrivateBalance.tsx` - coin balance display
- [ ] Create `TransactionHistory.tsx` - recent transactions
- [ ] Create `PendingTransfers.tsx` - incoming transfers to claim
- [ ] Style with Tailwind, firefly gold accent for amounts
- [ ] Write component tests

### 2b.2 Bounty Creation Flow

**Directory:** `apps/web/src/components/Bounty/`

- [ ] Create `CreateBountyForm.tsx`
  - [ ] Title and description inputs
  - [ ] Topic selector (multi-select)
  - [ ] Location input (optional)
  - [ ] Amount input with pUSD formatting
  - [ ] Duration selector
  - [ ] Wallet connection prompt
  - [ ] Submit with escrow creation

- [ ] Create `AmountInput.tsx` - pUSD amount input component
  - [ ] Format as user types
  - [ ] Show coin decomposition for private mode
  - [ ] Validate minimum/maximum

- [ ] Create `CreateBountyConfirmation.tsx`
  - [ ] Summary of bounty details
  - [ ] Escrow explanation
  - [ ] Transaction signing prompt

### 2b.3 Bounty List View

**Directory:** `apps/web/src/app/bounties/`

- [ ] Create `page.tsx` - bounty list page
- [ ] Create `BountyCard.tsx` - individual bounty preview
  - [ ] Title, topics, location
  - [ ] Funding amount (formatted pUSD)
  - [ ] Contribution count
  - [ ] Time remaining
  - [ ] Status indicator

- [ ] Create `BountyFilters.tsx`
  - [ ] Filter by topic
  - [ ] Filter by status (open/fulfilled/expired)
  - [ ] Filter by location
  - [ ] Sort options

### 2b.4 Bounty Detail View

**Directory:** `apps/web/src/app/bounties/[id]/`

- [ ] Create `page.tsx` - bounty detail page
- [ ] Create `BountyHeader.tsx` - title, status, funding
- [ ] Create `BountyDescription.tsx` - full description
- [ ] Create `ContributingSignals.tsx` - signals that address this bounty
- [ ] Create `BountyActions.tsx`
  - [ ] "Contribute Signal" button (links to illuminate flow)
  - [ ] "Cancel Bounty" button (for funder, if open)

### 2b.5 Bounty Fulfillment Flow

- [ ] Create `LinkSignalToBounty.tsx`
  - [ ] Select from user's signals
  - [ ] Or create new signal
  - [ ] Submit contribution

- [ ] Create `BountyPayoutStatus.tsx`
  - [ ] Verification progress
  - [ ] Payout distribution preview
  - [ ] Claim payout button

### 2b.6 Integration with Existing Pages

- [ ] Add "Bounties" link to navigation
- [ ] Add "Create Bounty" CTA to relevant pages
- [ ] Add bounty indicators to signal cards (if signal addresses bounty)

---

## Success Criteria

### Phase 1 Complete When:

- [ ] All type definitions compile without errors
- [ ] All utility functions have >90% test coverage
- [ ] Types are exported and usable from `@cocuyo/types`

### Phase 2 Complete When:

- [ ] Mock services implement all interface methods
- [ ] Services have >80% test coverage
- [ ] React hooks work with mock services
- [ ] Can simulate full bounty lifecycle with mocks

### Phase 2b Complete When:

- [ ] Bounty creation flow works end-to-end (with mocks)
- [ ] Bounty list displays mock bounties
- [ ] Bounty detail shows full information
- [ ] Wallet dashboard shows mock balances
- [ ] All components pass accessibility audit
- [ ] Mobile responsive design complete

---

## Next Steps After Phase 2b

1. **Resolve external dependencies** (pUSD Asset ID, Coinage access)
2. **Design chat infrastructure** for private transfers
3. **Plan Phases 3-5** once external dependencies are available
