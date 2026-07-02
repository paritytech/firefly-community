// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity ^0.8.24;

import {ReentrancyGuardUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import {PausableUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import {Ownable2StepUpgradeable} from "@openzeppelin/contracts-upgradeable/access/Ownable2StepUpgradeable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";

/**
 * @title AllianceGovernance
 * @notice On-chain Alliance governance with snapshot-based voting.
 * @dev Enables contributors to propose and vote on outlet management,
 *      weight changes, and parameter modifications.
 *
 * Proposal Types:
 *   - OutletAdd: Add a new outlet to receive funding
 *   - OutletRemove: Remove an outlet from the registry
 *   - WeightChange: Modify allocation weights
 *   - ParameterChange: Change pool parameters
 *   - Emergency: Emergency actions (higher threshold required)
 *
 * Voting:
 *   - Weight snapshots are taken at proposal creation via ContributorRegistry
 *   - Contributors vote using their snapshotted weight (fair voting)
 *   - Support options: For (0), Against (1), Abstain (2)
 *
 * Execution:
 *   - Approved proposals execute actions on OutletRegistry
 *   - Emergency proposals have higher thresholds and shorter timelocks
 */
contract AllianceGovernance is
    ReentrancyGuardUpgradeable,
    PausableUpgradeable,
    Ownable2StepUpgradeable,
    UUPSUpgradeable
{
    // =========================================================================
    // Types
    // =========================================================================

    enum ProposalType {
        OutletAdd,
        OutletRemove,
        WeightChange,
        ParameterChange,
        Emergency
    }

    enum ProposalState {
        Pending,    // Created but not yet active
        Active,     // Voting period ongoing
        Succeeded,  // Passed threshold
        Defeated,   // Failed to pass
        Expired,    // Voting period ended without quorum
        Executed,   // Successfully executed
        Cancelled   // Cancelled by proposer or governance
    }

    enum VoteType {
        For,
        Against,
        Abstain
    }

    struct Proposal {
        uint256 id;
        address proposer;
        ProposalType proposalType;
        bytes payload;              // ABI-encoded typed payload
        uint256 snapshotBlock;      // Block for voting power snapshot
        uint256 startBlock;         // Voting starts (after voting delay)
        uint256 endBlock;           // Voting ends
        uint256 forVotes;
        uint256 againstVotes;
        uint256 abstainVotes;
        bool executed;
        bool cancelled;
    }

    struct ProposalConfig {
        uint256 quorum;             // Minimum total votes required
        uint256 threshold;          // Percentage required to pass (in basis points, e.g., 6000 = 60%)
        uint256 votingDelay;        // Blocks before voting starts
        uint256 votingPeriod;       // Blocks for voting
        uint256 executionDelay;     // Blocks before execution allowed
    }

    // =========================================================================
    // Constants
    // =========================================================================

    /// @notice Basis points denominator (10000 = 100%)
    uint256 public constant BASIS_POINTS = 10000;

    /// @notice Minimum tier required to create proposals (BEACON = 3)
    uint256 public constant MIN_PROPOSAL_TIER = 3;

    /// @notice Minimum tier required to vote (SPARK = 1)
    uint256 public constant MIN_VOTING_TIER = 1;

    // =========================================================================
    // State
    // =========================================================================

    /// @notice ContributorRegistry contract for weight snapshots
    IContributorRegistry public contributorRegistry;

    /// @notice OutletRegistry contract for executing proposals
    IOutletRegistry public outletRegistry;

    /// @notice Total number of proposals
    uint256 public proposalCount;

    /// @notice Proposals by ID
    mapping(uint256 => Proposal) public proposals;

    /// @notice Whether an account has voted on a proposal
    mapping(uint256 => mapping(address => bool)) public hasVoted;

    /// @notice Vote receipts (proposalId => voter => VoteType)
    mapping(uint256 => mapping(address => VoteType)) public voteReceipts;

    /// @notice Vote reasons (proposalId => voter => reason)
    mapping(uint256 => mapping(address => string)) public voteReasons;

    /// @notice Configuration per proposal type
    mapping(ProposalType => ProposalConfig) public proposalConfigs;

    // =========================================================================
    // Events
    // =========================================================================

    event ProposalCreated(
        uint256 indexed proposalId,
        address indexed proposer,
        ProposalType proposalType,
        uint256 snapshotBlock,
        uint256 startBlock,
        uint256 endBlock,
        string description
    );

    event VoteCast(
        uint256 indexed proposalId,
        address indexed voter,
        VoteType support,
        uint256 weight,
        string reason
    );

    event ProposalExecuted(
        uint256 indexed proposalId
    );

    event ProposalCancelled(
        uint256 indexed proposalId
    );

    event ConfigUpdated(
        ProposalType indexed proposalType,
        uint256 quorum,
        uint256 threshold,
        uint256 votingDelay,
        uint256 votingPeriod,
        uint256 executionDelay
    );

    event ContributorRegistryUpdated(
        address indexed oldRegistry,
        address indexed newRegistry
    );

    event OutletRegistryUpdated(
        address indexed oldRegistry,
        address indexed newRegistry
    );

    // =========================================================================
    // Errors
    // =========================================================================

    error ZeroAddress();
    error InsufficientTier(uint256 required, uint256 actual);
    error ProposalNotFound(uint256 proposalId);
    error ProposalNotActive(uint256 proposalId, ProposalState currentState);
    error ProposalNotSucceeded(uint256 proposalId, ProposalState currentState);
    error ProposalAlreadyExecuted(uint256 proposalId);
    error ProposalAlreadyCancelled(uint256 proposalId);
    error AlreadyVoted(uint256 proposalId, address voter);
    error NoVotingPower(address voter);
    error ExecutionTooEarly(uint256 proposalId, uint256 currentBlock, uint256 executionBlock);
    error OnlyProposer(address caller, address proposer);
    error InvalidPayload();
    error ExecutionFailed(uint256 proposalId, string reason);

    // =========================================================================
    // Initialization
    // =========================================================================

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /**
     * @notice Initialize the governance contract.
     * @param owner_ Contract owner
     * @param contributorRegistry_ ContributorRegistry address
     * @param outletRegistry_ OutletRegistry address
     */
    function initialize(
        address owner_,
        address contributorRegistry_,
        address outletRegistry_
    ) public initializer {
        if (contributorRegistry_ == address(0)) revert ZeroAddress();
        if (outletRegistry_ == address(0)) revert ZeroAddress();

        __ReentrancyGuard_init();
        __Pausable_init();
        __Ownable_init(owner_);
        __Ownable2Step_init();
        __UUPSUpgradeable_init();

        contributorRegistry = IContributorRegistry(contributorRegistry_);
        outletRegistry = IOutletRegistry(outletRegistry_);

        // Default configurations
        _setDefaultConfigs();
    }

    /**
     * @dev Set default configurations for each proposal type.
     */
    function _setDefaultConfigs() internal {
        // Standard proposals: 7-day voting, 60% threshold, 2-day timelock
        ProposalConfig memory standard = ProposalConfig({
            quorum: 100,           // 100 total voting weight
            threshold: 6000,       // 60%
            votingDelay: 1,        // 1 block delay
            votingPeriod: 50400,   // ~7 days (assuming 12s blocks)
            executionDelay: 14400  // ~2 days timelock
        });

        proposalConfigs[ProposalType.OutletAdd] = standard;
        proposalConfigs[ProposalType.OutletRemove] = standard;
        proposalConfigs[ProposalType.WeightChange] = standard;
        proposalConfigs[ProposalType.ParameterChange] = standard;

        // Emergency proposals: 3-day voting, 80% threshold, 6-hour timelock
        proposalConfigs[ProposalType.Emergency] = ProposalConfig({
            quorum: 150,           // Higher quorum for emergencies
            threshold: 8000,       // 80%
            votingDelay: 1,
            votingPeriod: 21600,   // ~3 days
            executionDelay: 1800   // ~6 hours
        });
    }

    // =========================================================================
    // Core Functions
    // =========================================================================

    /**
     * @notice Create a new proposal.
     * @param proposalType Type of proposal
     * @param payload ABI-encoded proposal data
     * @param description Human-readable description
     * @return proposalId The new proposal ID
     */
    function propose(
        ProposalType proposalType,
        bytes calldata payload,
        string calldata description
    ) external whenNotPaused returns (uint256) {
        // Check proposer tier
        uint256 tier = uint256(contributorRegistry.getTier(msg.sender));
        if (tier < MIN_PROPOSAL_TIER) {
            revert InsufficientTier(MIN_PROPOSAL_TIER, tier);
        }

        // Validate payload based on type
        _validatePayload(proposalType, payload);

        // Get config for this proposal type
        ProposalConfig memory config = proposalConfigs[proposalType];

        // Create proposal
        uint256 proposalId = ++proposalCount;
        uint256 snapshotBlock = block.number;
        uint256 startBlock = block.number + config.votingDelay;
        uint256 endBlock = startBlock + config.votingPeriod;

        proposals[proposalId] = Proposal({
            id: proposalId,
            proposer: msg.sender,
            proposalType: proposalType,
            payload: payload,
            snapshotBlock: snapshotBlock,
            startBlock: startBlock,
            endBlock: endBlock,
            forVotes: 0,
            againstVotes: 0,
            abstainVotes: 0,
            executed: false,
            cancelled: false
        });

        // Snapshot proposer's weight
        contributorRegistry.snapshotWeight(msg.sender, proposalId);

        emit ProposalCreated(
            proposalId,
            msg.sender,
            proposalType,
            snapshotBlock,
            startBlock,
            endBlock,
            description
        );

        return proposalId;
    }

    /**
     * @notice Cast a vote on a proposal.
     * @param proposalId Proposal to vote on
     * @param support Vote type (For, Against, Abstain)
     */
    function castVote(
        uint256 proposalId,
        VoteType support
    ) external whenNotPaused {
        _castVote(proposalId, support, "");
    }

    /**
     * @notice Cast a vote with a reason.
     * @param proposalId Proposal to vote on
     * @param support Vote type
     * @param reason Explanation for the vote
     */
    function castVoteWithReason(
        uint256 proposalId,
        VoteType support,
        string calldata reason
    ) external whenNotPaused {
        _castVote(proposalId, support, reason);
    }

    /**
     * @dev Internal vote casting logic.
     */
    function _castVote(
        uint256 proposalId,
        VoteType support,
        string memory reason
    ) internal {
        Proposal storage proposal = proposals[proposalId];
        if (proposal.id == 0) revert ProposalNotFound(proposalId);

        ProposalState currentState = state(proposalId);
        if (currentState != ProposalState.Active) {
            revert ProposalNotActive(proposalId, currentState);
        }

        if (hasVoted[proposalId][msg.sender]) {
            revert AlreadyVoted(proposalId, msg.sender);
        }

        // Check voter tier
        uint256 tier = uint256(contributorRegistry.getTier(msg.sender));
        if (tier < MIN_VOTING_TIER) {
            revert InsufficientTier(MIN_VOTING_TIER, tier);
        }

        // Try to snapshot weight (may already exist)
        try contributorRegistry.snapshotWeight(msg.sender, proposalId) {
            // Snapshot created
        } catch {
            // Snapshot already exists, which is fine
        }

        // Get voting power from snapshot
        uint256 weight = contributorRegistry.getSnapshotWeight(msg.sender, proposalId);
        if (weight == 0) revert NoVotingPower(msg.sender);

        // Record vote
        hasVoted[proposalId][msg.sender] = true;
        voteReceipts[proposalId][msg.sender] = support;

        if (bytes(reason).length > 0) {
            voteReasons[proposalId][msg.sender] = reason;
        }

        // Tally vote
        if (support == VoteType.For) {
            proposal.forVotes += weight;
        } else if (support == VoteType.Against) {
            proposal.againstVotes += weight;
        } else {
            proposal.abstainVotes += weight;
        }

        emit VoteCast(proposalId, msg.sender, support, weight, reason);
    }

    /**
     * @notice Execute a successful proposal.
     * @param proposalId Proposal to execute
     */
    function execute(uint256 proposalId) external nonReentrant whenNotPaused {
        Proposal storage proposal = proposals[proposalId];
        if (proposal.id == 0) revert ProposalNotFound(proposalId);

        ProposalState currentState = state(proposalId);
        if (currentState != ProposalState.Succeeded) {
            revert ProposalNotSucceeded(proposalId, currentState);
        }

        if (proposal.executed) revert ProposalAlreadyExecuted(proposalId);

        // Check execution delay
        ProposalConfig memory config = proposalConfigs[proposal.proposalType];
        uint256 executionBlock = proposal.endBlock + config.executionDelay;
        if (block.number < executionBlock) {
            revert ExecutionTooEarly(proposalId, block.number, executionBlock);
        }

        proposal.executed = true;

        // Execute based on proposal type
        _executeProposal(proposal);

        emit ProposalExecuted(proposalId);
    }

    /**
     * @notice Cancel a proposal.
     * @param proposalId Proposal to cancel
     * @dev Only the proposer can cancel, and only before execution
     */
    function cancel(uint256 proposalId) external {
        Proposal storage proposal = proposals[proposalId];
        if (proposal.id == 0) revert ProposalNotFound(proposalId);

        if (msg.sender != proposal.proposer && msg.sender != owner()) {
            revert OnlyProposer(msg.sender, proposal.proposer);
        }

        if (proposal.executed) revert ProposalAlreadyExecuted(proposalId);
        if (proposal.cancelled) revert ProposalAlreadyCancelled(proposalId);

        proposal.cancelled = true;

        emit ProposalCancelled(proposalId);
    }

    // =========================================================================
    // View Functions
    // =========================================================================

    /**
     * @notice Get the current state of a proposal.
     * @param proposalId Proposal to check
     * @return ProposalState
     */
    function state(uint256 proposalId) public view returns (ProposalState) {
        Proposal storage proposal = proposals[proposalId];
        if (proposal.id == 0) revert ProposalNotFound(proposalId);

        if (proposal.cancelled) return ProposalState.Cancelled;
        if (proposal.executed) return ProposalState.Executed;

        if (block.number < proposal.startBlock) return ProposalState.Pending;
        if (block.number <= proposal.endBlock) return ProposalState.Active;

        // Voting ended - check outcome
        ProposalConfig memory config = proposalConfigs[proposal.proposalType];
        uint256 totalVotes = proposal.forVotes + proposal.againstVotes + proposal.abstainVotes;

        // Check quorum
        if (totalVotes < config.quorum) return ProposalState.Expired;

        // Check threshold (abstains don't count for threshold calculation)
        uint256 votingWeight = proposal.forVotes + proposal.againstVotes;
        if (votingWeight == 0) return ProposalState.Defeated;

        uint256 approvalPercentage = (proposal.forVotes * BASIS_POINTS) / votingWeight;
        if (approvalPercentage >= config.threshold) {
            return ProposalState.Succeeded;
        }

        return ProposalState.Defeated;
    }

    /**
     * @notice Get voting power for an address on a proposal.
     * @param voter Address to check
     * @param proposalId Proposal ID
     * @return weight Voting power
     */
    function getVotingPower(
        address voter,
        uint256 proposalId
    ) external view returns (uint256) {
        return contributorRegistry.getSnapshotWeight(voter, proposalId);
    }

    /**
     * @notice Get proposal details.
     * @param proposalId Proposal to fetch
     * @return Proposal struct
     */
    function getProposal(uint256 proposalId) external view returns (Proposal memory) {
        if (proposals[proposalId].id == 0) revert ProposalNotFound(proposalId);
        return proposals[proposalId];
    }

    /**
     * @notice Get the vote receipt for a voter on a proposal.
     * @param proposalId Proposal ID
     * @param voter Voter address
     * @return voted Whether the voter has voted
     * @return support The vote type (if voted)
     * @return reason The vote reason (if any)
     */
    function getVoteReceipt(
        uint256 proposalId,
        address voter
    ) external view returns (bool voted, VoteType support, string memory reason) {
        voted = hasVoted[proposalId][voter];
        if (voted) {
            support = voteReceipts[proposalId][voter];
            reason = voteReasons[proposalId][voter];
        }
    }

    /**
     * @notice Get configuration for a proposal type.
     * @param proposalType Type to query
     * @return config ProposalConfig struct
     */
    function getConfig(ProposalType proposalType) external view returns (ProposalConfig memory) {
        return proposalConfigs[proposalType];
    }

    // =========================================================================
    // Internal Functions
    // =========================================================================

    /**
     * @dev Validate proposal payload based on type.
     */
    function _validatePayload(ProposalType proposalType, bytes calldata payload) internal pure {
        if (proposalType == ProposalType.OutletAdd) {
            // Expect: (bytes32 outletId, address treasury, uint256 weight)
            if (payload.length < 96) revert InvalidPayload();
        } else if (proposalType == ProposalType.OutletRemove) {
            // Expect: (bytes32 outletId)
            if (payload.length < 32) revert InvalidPayload();
        } else if (proposalType == ProposalType.WeightChange) {
            // Expect: (bytes32[] outletIds, uint256[] weights)
            if (payload.length < 64) revert InvalidPayload();
        } else if (proposalType == ProposalType.ParameterChange) {
            // Expect: (bytes32 paramName, uint256 value)
            if (payload.length < 64) revert InvalidPayload();
        } else if (proposalType == ProposalType.Emergency) {
            // Emergency payloads are flexible
            if (payload.length < 32) revert InvalidPayload();
        }
    }

    /**
     * @dev Execute proposal based on type.
     */
    function _executeProposal(Proposal storage proposal) internal {
        if (proposal.proposalType == ProposalType.OutletAdd) {
            _executeOutletAdd(proposal.payload);
        } else if (proposal.proposalType == ProposalType.OutletRemove) {
            _executeOutletRemove(proposal.payload);
        } else if (proposal.proposalType == ProposalType.WeightChange) {
            _executeWeightChange(proposal.payload);
        } else if (proposal.proposalType == ProposalType.ParameterChange) {
            // Parameter changes are logged but not auto-executed
            // Owner must apply them manually for safety
        } else if (proposal.proposalType == ProposalType.Emergency) {
            _executeEmergency(proposal.payload);
        }
    }

    function _executeOutletAdd(bytes memory payload) internal {
        (bytes32 outletId, address treasury, uint256 weight) = abi.decode(
            payload,
            (bytes32, address, uint256)
        );
        outletRegistry.addOutlet(outletId, treasury, weight);
    }

    function _executeOutletRemove(bytes memory payload) internal {
        bytes32 outletId = abi.decode(payload, (bytes32));
        outletRegistry.removeOutlet(outletId);
    }

    function _executeWeightChange(bytes memory payload) internal {
        (bytes32[] memory outletIds, uint256[] memory weights) = abi.decode(
            payload,
            (bytes32[], uint256[])
        );
        outletRegistry.updateWeights(outletIds, weights);
    }

    function _executeEmergency(bytes memory payload) internal {
        (bytes32 action) = abi.decode(payload, (bytes32));

        if (action == keccak256("PAUSE_REGISTRY")) {
            outletRegistry.pause();
        } else if (action == keccak256("UNPAUSE_REGISTRY")) {
            outletRegistry.unpause();
        }
        // Other emergency actions can be added here
    }

    // =========================================================================
    // Admin Functions
    // =========================================================================

    /**
     * @notice Update configuration for a proposal type.
     * @param proposalType Type to update
     * @param config New configuration
     */
    function setConfig(
        ProposalType proposalType,
        ProposalConfig calldata config
    ) external onlyOwner {
        proposalConfigs[proposalType] = config;

        emit ConfigUpdated(
            proposalType,
            config.quorum,
            config.threshold,
            config.votingDelay,
            config.votingPeriod,
            config.executionDelay
        );
    }

    /**
     * @notice Update the ContributorRegistry address.
     * @param newRegistry New registry address
     */
    function setContributorRegistry(address newRegistry) external onlyOwner {
        if (newRegistry == address(0)) revert ZeroAddress();

        address oldRegistry = address(contributorRegistry);
        contributorRegistry = IContributorRegistry(newRegistry);

        emit ContributorRegistryUpdated(oldRegistry, newRegistry);
    }

    /**
     * @notice Update the OutletRegistry address.
     * @param newRegistry New registry address
     */
    function setOutletRegistry(address newRegistry) external onlyOwner {
        if (newRegistry == address(0)) revert ZeroAddress();

        address oldRegistry = address(outletRegistry);
        outletRegistry = IOutletRegistry(newRegistry);

        emit OutletRegistryUpdated(oldRegistry, newRegistry);
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}
}

// =========================================================================
// Interfaces
// =========================================================================

interface IContributorRegistry {
    enum Tier {
        NONE,
        SPARK,
        FLAME,
        BEACON,
        LIGHTHOUSE
    }

    function getTier(address contributor) external view returns (Tier);
    function getGovernanceWeight(address contributor) external view returns (uint256);
    function snapshotWeight(address contributor, uint256 proposalId) external;
    function getSnapshotWeight(address contributor, uint256 proposalId) external view returns (uint256);
}

interface IOutletRegistry {
    function addOutlet(bytes32 outletId, address treasury, uint256 weight) external;
    function removeOutlet(bytes32 outletId) external;
    function updateWeights(bytes32[] calldata ids, uint256[] calldata weights) external;
    function pause() external;
    function unpause() external;
}
