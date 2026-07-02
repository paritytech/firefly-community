/**
 * AllianceGovernance Contract ABI
 *
 * Generated from packages/contracts/contracts/AllianceGovernance.sol
 *
 * Key functions:
 * - propose(proposalType, payload, description): Create a proposal
 * - castVote(proposalId, support): Vote on a proposal
 * - execute(proposalId): Execute a passed proposal
 * - cancel(proposalId): Cancel a proposal
 */

/* eslint-disable @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access -- ethers Interface.decodeFunctionResult returns Result type with any[] elements */

import { Interface } from 'ethers';
import { toHex } from './utils';

// ============================================================
// ABI Definition
// ============================================================

/**
 * AllianceGovernance ABI.
 */
export const ALLIANCE_GOVERNANCE_ABI = [
  // Read functions
  'function contributorRegistry() view returns (address)',
  'function outletRegistry() view returns (address)',
  'function proposalCount() view returns (uint256)',

  // Proposal functions
  'function proposals(uint256 proposalId) view returns (uint256 id, address proposer, uint8 proposalType, bytes payload, uint256 snapshotBlock, uint256 startBlock, uint256 endBlock, uint256 forVotes, uint256 againstVotes, uint256 abstainVotes, bool executed, bool cancelled)',
  'function getProposal(uint256 proposalId) view returns (tuple(uint256 id, address proposer, uint8 proposalType, bytes payload, uint256 snapshotBlock, uint256 startBlock, uint256 endBlock, uint256 forVotes, uint256 againstVotes, uint256 abstainVotes, bool executed, bool cancelled))',
  'function state(uint256 proposalId) view returns (uint8)',

  // Voting functions
  'function hasVoted(uint256 proposalId, address voter) view returns (bool)',
  'function voteReceipts(uint256 proposalId, address voter) view returns (uint8)',
  'function voteReasons(uint256 proposalId, address voter) view returns (string)',
  'function getVotingPower(address voter, uint256 proposalId) view returns (uint256)',
  'function getVoteReceipt(uint256 proposalId, address voter) view returns (bool voted, uint8 support, string reason)',

  // Config functions
  'function proposalConfigs(uint8 proposalType) view returns (uint256 quorum, uint256 threshold, uint256 votingDelay, uint256 votingPeriod, uint256 executionDelay)',
  'function getConfig(uint8 proposalType) view returns (tuple(uint256 quorum, uint256 threshold, uint256 votingDelay, uint256 votingPeriod, uint256 executionDelay))',

  // Write functions
  'function propose(uint8 proposalType, bytes payload, string description) returns (uint256)',
  'function castVote(uint256 proposalId, uint8 support)',
  'function castVoteWithReason(uint256 proposalId, uint8 support, string reason)',
  'function execute(uint256 proposalId)',
  'function cancel(uint256 proposalId)',

  // Admin functions
  'function setConfig(uint8 proposalType, tuple(uint256 quorum, uint256 threshold, uint256 votingDelay, uint256 votingPeriod, uint256 executionDelay) config)',
  'function setContributorRegistry(address newRegistry)',
  'function setOutletRegistry(address newRegistry)',
  'function pause()',
  'function unpause()',

  // Events
  'event ProposalCreated(uint256 indexed proposalId, address indexed proposer, uint8 proposalType, uint256 snapshotBlock, uint256 startBlock, uint256 endBlock, string description)',
  'event VoteCast(uint256 indexed proposalId, address indexed voter, uint8 support, uint256 weight, string reason)',
  'event ProposalExecuted(uint256 indexed proposalId)',
  'event ProposalCancelled(uint256 indexed proposalId)',
  'event ConfigUpdated(uint8 indexed proposalType, uint256 quorum, uint256 threshold, uint256 votingDelay, uint256 votingPeriod, uint256 executionDelay)',

  // Constants
  'function BASIS_POINTS() view returns (uint256)',
  'function MIN_PROPOSAL_TIER() view returns (uint256)',
  'function MIN_VOTING_TIER() view returns (uint256)',
] as const;

// ============================================================
// Interface
// ============================================================

/**
 * ethers.js Interface for AllianceGovernance.
 */
export const allianceGovernanceInterface = new Interface(ALLIANCE_GOVERNANCE_ABI);

// ============================================================
// Types
// ============================================================

/** Proposal type enum matching Solidity */
export enum ProposalType {
  OutletAdd = 0,
  OutletRemove = 1,
  WeightChange = 2,
  ParameterChange = 3,
  Emergency = 4,
}

/** Proposal state enum matching Solidity */
export enum ProposalState {
  Pending = 0,
  Active = 1,
  Succeeded = 2,
  Defeated = 3,
  Expired = 4,
  Executed = 5,
  Cancelled = 6,
}

/** Vote type enum matching Solidity */
export enum VoteType {
  For = 0,
  Against = 1,
  Abstain = 2,
}

/** Contract proposal data */
export interface ContractProposal {
  readonly id: bigint;
  readonly proposer: string;
  readonly proposalType: ProposalType;
  readonly payload: string;
  readonly snapshotBlock: bigint;
  readonly startBlock: bigint;
  readonly endBlock: bigint;
  readonly forVotes: bigint;
  readonly againstVotes: bigint;
  readonly abstainVotes: bigint;
  readonly executed: boolean;
  readonly cancelled: boolean;
}

/** Proposal config data */
export interface ContractProposalConfig {
  readonly quorum: bigint;
  readonly threshold: bigint;
  readonly votingDelay: bigint;
  readonly votingPeriod: bigint;
  readonly executionDelay: bigint;
}

// ============================================================
// Encoding Helpers
// ============================================================

/**
 * Encode a propose call.
 */
export function encodePropose(
  proposalType: ProposalType,
  payload: string,
  description: string
): string {
  return allianceGovernanceInterface.encodeFunctionData('propose', [
    proposalType,
    payload,
    description,
  ]);
}

/**
 * Encode a castVote call.
 */
export function encodeCastVote(proposalId: bigint, support: VoteType): string {
  return allianceGovernanceInterface.encodeFunctionData('castVote', [proposalId, support]);
}

/**
 * Encode a castVoteWithReason call.
 */
export function encodeCastVoteWithReason(
  proposalId: bigint,
  support: VoteType,
  reason: string
): string {
  return allianceGovernanceInterface.encodeFunctionData('castVoteWithReason', [
    proposalId,
    support,
    reason,
  ]);
}

/**
 * Encode an execute call.
 */
export function encodeExecute(proposalId: bigint): string {
  return allianceGovernanceInterface.encodeFunctionData('execute', [proposalId]);
}

/**
 * Encode a cancel call.
 */
export function encodeCancel(proposalId: bigint): string {
  return allianceGovernanceInterface.encodeFunctionData('cancel', [proposalId]);
}

/**
 * Encode a getProposal call.
 */
export function encodeGetProposal(proposalId: bigint): string {
  return allianceGovernanceInterface.encodeFunctionData('getProposal', [proposalId]);
}

/**
 * Decode a getProposal result.
 */
export function decodeGetProposal(data: string | Uint8Array): ContractProposal {
  const hexData = toHex(data);
  const result = allianceGovernanceInterface.decodeFunctionResult('getProposal', hexData);
  const tuple = result[0];
  return {
    id: BigInt(tuple[0]),
    proposer: String(tuple[1]),
    proposalType: Number(tuple[2]) as ProposalType,
    payload: String(tuple[3]),
    snapshotBlock: BigInt(tuple[4]),
    startBlock: BigInt(tuple[5]),
    endBlock: BigInt(tuple[6]),
    forVotes: BigInt(tuple[7]),
    againstVotes: BigInt(tuple[8]),
    abstainVotes: BigInt(tuple[9]),
    executed: Boolean(tuple[10]),
    cancelled: Boolean(tuple[11]),
  };
}

/**
 * Encode a state call.
 */
export function encodeState(proposalId: bigint): string {
  return allianceGovernanceInterface.encodeFunctionData('state', [proposalId]);
}

/**
 * Decode a state result.
 */
export function decodeState(data: string | Uint8Array): ProposalState {
  const hexData = toHex(data);
  const result = allianceGovernanceInterface.decodeFunctionResult('state', hexData);
  return Number(result[0]) as ProposalState;
}

/**
 * Encode a hasVoted call.
 */
export function encodeHasVoted(proposalId: bigint, voter: string): string {
  return allianceGovernanceInterface.encodeFunctionData('hasVoted', [proposalId, voter]);
}

/**
 * Decode a hasVoted result.
 */
export function decodeHasVoted(data: string | Uint8Array): boolean {
  const hexData = toHex(data);
  const result = allianceGovernanceInterface.decodeFunctionResult('hasVoted', hexData);
  return Boolean(result[0]);
}

/**
 * Encode a getVotingPower call.
 */
export function encodeGetVotingPower(voter: string, proposalId: bigint): string {
  return allianceGovernanceInterface.encodeFunctionData('getVotingPower', [voter, proposalId]);
}

/**
 * Decode a getVotingPower result.
 */
export function decodeGetVotingPower(data: string | Uint8Array): bigint {
  const hexData = toHex(data);
  const result = allianceGovernanceInterface.decodeFunctionResult('getVotingPower', hexData);
  return BigInt(result[0]);
}

/**
 * Encode a getConfig call.
 */
export function encodeGetConfig(proposalType: ProposalType): string {
  return allianceGovernanceInterface.encodeFunctionData('getConfig', [proposalType]);
}

/**
 * Decode a getConfig result.
 */
export function decodeGetConfig(data: string | Uint8Array): ContractProposalConfig {
  const hexData = toHex(data);
  const result = allianceGovernanceInterface.decodeFunctionResult('getConfig', hexData);
  const tuple = result[0];
  return {
    quorum: BigInt(tuple[0]),
    threshold: BigInt(tuple[1]),
    votingDelay: BigInt(tuple[2]),
    votingPeriod: BigInt(tuple[3]),
    executionDelay: BigInt(tuple[4]),
  };
}

/**
 * Encode a proposalCount call.
 */
export function encodeProposalCount(): string {
  return allianceGovernanceInterface.encodeFunctionData('proposalCount');
}

/**
 * Decode a proposalCount result.
 */
export function decodeProposalCount(data: string | Uint8Array): bigint {
  const hexData = toHex(data);
  const result = allianceGovernanceInterface.decodeFunctionResult('proposalCount', hexData);
  return BigInt(result[0]);
}

// ============================================================
// Payload Encoding Helpers
// ============================================================

/**
 * Encode an OutletAdd payload.
 */
export function encodeOutletAddPayload(outletId: string, treasury: string, weight: bigint): string {
  const abiCoder = allianceGovernanceInterface;
  return abiCoder
    .getAbiCoder()
    .encode(['bytes32', 'address', 'uint256'], [outletId, treasury, weight]);
}

/**
 * Encode an OutletRemove payload.
 */
export function encodeOutletRemovePayload(outletId: string): string {
  const abiCoder = allianceGovernanceInterface;
  return abiCoder.getAbiCoder().encode(['bytes32'], [outletId]);
}

/**
 * Encode a WeightChange payload.
 */
export function encodeWeightChangePayload(outletIds: string[], weights: bigint[]): string {
  const abiCoder = allianceGovernanceInterface;
  return abiCoder.getAbiCoder().encode(['bytes32[]', 'uint256[]'], [outletIds, weights]);
}
