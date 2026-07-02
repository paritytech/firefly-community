// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity ^0.8.24;

import {Ownable2StepUpgradeable} from "@openzeppelin/contracts-upgradeable/access/Ownable2StepUpgradeable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";

/**
 * @title ContributorRegistry
 * @notice Tracks contributor tiers and governance weights for Alliance voting.
 * @dev Reads cumulative contributions from CrowdstackingPool to determine tiers.
 *      Provides weight snapshots for fair voting at proposal creation time.
 *
 * Tier Thresholds (in pUSD with 6 decimals):
 *   - none:       $0 - $4.99
 *   - spark:      $5 - $49.99
 *   - flame:      $50 - $499.99
 *   - beacon:     $500 - $4,999.99
 *   - lighthouse: $5,000+
 *
 * Governance Weights:
 *   - none:       0
 *   - spark:      1
 *   - flame:      3
 *   - beacon:     10
 *   - lighthouse: 25
 */
contract ContributorRegistry is
    Ownable2StepUpgradeable,
    UUPSUpgradeable
{
    // =========================================================================
    // Types
    // =========================================================================

    enum Tier {
        NONE,
        SPARK,
        FLAME,
        BEACON,
        LIGHTHOUSE
    }

    // =========================================================================
    // Constants
    // =========================================================================

    /// @notice Tier threshold: Spark minimum ($5)
    uint256 public constant SPARK_MIN = 5 * 1e6;

    /// @notice Tier threshold: Flame minimum ($50)
    uint256 public constant FLAME_MIN = 50 * 1e6;

    /// @notice Tier threshold: Beacon minimum ($500)
    uint256 public constant BEACON_MIN = 500 * 1e6;

    /// @notice Tier threshold: Lighthouse minimum ($5,000)
    uint256 public constant LIGHTHOUSE_MIN = 5000 * 1e6;

    /// @notice Governance weight for spark tier
    uint256 public constant WEIGHT_SPARK = 1;

    /// @notice Governance weight for flame tier
    uint256 public constant WEIGHT_FLAME = 3;

    /// @notice Governance weight for beacon tier
    uint256 public constant WEIGHT_BEACON = 10;

    /// @notice Governance weight for lighthouse tier
    uint256 public constant WEIGHT_LIGHTHOUSE = 25;

    // =========================================================================
    // State
    // =========================================================================

    /// @notice CrowdstackingPool contract for reading positions
    address public crowdstackingPool;

    /// @notice Weight snapshots for proposals
    /// @dev proposalId => contributor => snapshotted weight
    mapping(uint256 => mapping(address => uint256)) public weightSnapshots;

    /// @notice Whether a snapshot has been taken for a proposal/contributor
    mapping(uint256 => mapping(address => bool)) public hasSnapshot;

    // =========================================================================
    // Events
    // =========================================================================

    event CrowdstackingPoolUpdated(
        address indexed oldPool,
        address indexed newPool
    );

    event WeightSnapshotted(
        uint256 indexed proposalId,
        address indexed contributor,
        uint256 weight,
        Tier tier
    );

    // =========================================================================
    // Errors
    // =========================================================================

    error ZeroAddress();
    error PoolNotSet();
    error SnapshotAlreadyTaken(uint256 proposalId, address contributor);

    // =========================================================================
    // Initialization
    // =========================================================================

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /**
     * @notice Initialize the registry.
     * @param owner_ Contract owner
     * @param crowdstackingPool_ CrowdstackingPool address
     */
    function initialize(
        address owner_,
        address crowdstackingPool_
    ) public initializer {
        __Ownable_init(owner_);
        __Ownable2Step_init();
        __UUPSUpgradeable_init();

        crowdstackingPool = crowdstackingPool_;
    }

    // =========================================================================
    // Core Functions
    // =========================================================================

    /**
     * @notice Get the tier for a contributor based on cumulative contributions.
     * @param contributor Address to check
     * @return tier The contributor's tier
     */
    function getTier(address contributor) public view returns (Tier) {
        if (crowdstackingPool == address(0)) revert PoolNotSet();

        (, uint256 cumulativeContributed) = ICrowdstackingPool(crowdstackingPool)
            .getPosition(contributor);

        return _getTierForAmount(cumulativeContributed);
    }

    /**
     * @notice Get the governance weight for a contributor.
     * @param contributor Address to check
     * @return weight The contributor's governance weight
     */
    function getGovernanceWeight(address contributor) public view returns (uint256) {
        Tier tier = getTier(contributor);
        return _getWeightForTier(tier);
    }

    /**
     * @notice Snapshot a contributor's weight for a proposal.
     * @param contributor Address to snapshot
     * @param proposalId Proposal identifier
     * @dev Should be called at proposal creation time for all potential voters.
     */
    function snapshotWeight(address contributor, uint256 proposalId) external {
        if (hasSnapshot[proposalId][contributor]) {
            revert SnapshotAlreadyTaken(proposalId, contributor);
        }

        Tier tier = getTier(contributor);
        uint256 weight = _getWeightForTier(tier);

        weightSnapshots[proposalId][contributor] = weight;
        hasSnapshot[proposalId][contributor] = true;

        emit WeightSnapshotted(proposalId, contributor, weight, tier);
    }

    /**
     * @notice Get a contributor's snapshotted weight for a proposal.
     * @param contributor Address to check
     * @param proposalId Proposal identifier
     * @return weight The snapshotted weight (0 if no snapshot)
     */
    function getSnapshotWeight(
        address contributor,
        uint256 proposalId
    ) external view returns (uint256) {
        // If snapshot exists, return it; otherwise calculate current weight
        if (hasSnapshot[proposalId][contributor]) {
            return weightSnapshots[proposalId][contributor];
        }
        return getGovernanceWeight(contributor);
    }

    // =========================================================================
    // View Functions
    // =========================================================================

    /**
     * @notice Get tier for an amount (useful for simulations).
     * @param amount Contribution amount in pUSD (6 decimals)
     * @return tier The tier for that amount
     */
    function getTierForAmount(uint256 amount) external pure returns (Tier) {
        return _getTierForAmount(amount);
    }

    /**
     * @notice Get weight for a tier.
     * @param tier The tier to check
     * @return weight The governance weight
     */
    function getWeightForTier(Tier tier) external pure returns (uint256) {
        return _getWeightForTier(tier);
    }

    /**
     * @notice Get tier thresholds.
     * @return sparkMin Minimum for spark tier
     * @return flameMin Minimum for flame tier
     * @return beaconMin Minimum for beacon tier
     * @return lighthouseMin Minimum for lighthouse tier
     */
    function getTierThresholds() external pure returns (
        uint256 sparkMin,
        uint256 flameMin,
        uint256 beaconMin,
        uint256 lighthouseMin
    ) {
        return (SPARK_MIN, FLAME_MIN, BEACON_MIN, LIGHTHOUSE_MIN);
    }

    /**
     * @notice Get tier weights.
     * @return spark Weight for spark tier
     * @return flame Weight for flame tier
     * @return beacon Weight for beacon tier
     * @return lighthouse Weight for lighthouse tier
     */
    function getTierWeights() external pure returns (
        uint256 spark,
        uint256 flame,
        uint256 beacon,
        uint256 lighthouse
    ) {
        return (WEIGHT_SPARK, WEIGHT_FLAME, WEIGHT_BEACON, WEIGHT_LIGHTHOUSE);
    }

    // =========================================================================
    // Admin Functions
    // =========================================================================

    /**
     * @notice Update the CrowdstackingPool address.
     * @param newPool New pool address
     */
    function setCrowdstackingPool(address newPool) external onlyOwner {
        if (newPool == address(0)) revert ZeroAddress();

        address oldPool = crowdstackingPool;
        crowdstackingPool = newPool;

        emit CrowdstackingPoolUpdated(oldPool, newPool);
    }

    // =========================================================================
    // Internal Functions
    // =========================================================================

    function _getTierForAmount(uint256 amount) internal pure returns (Tier) {
        if (amount >= LIGHTHOUSE_MIN) return Tier.LIGHTHOUSE;
        if (amount >= BEACON_MIN) return Tier.BEACON;
        if (amount >= FLAME_MIN) return Tier.FLAME;
        if (amount >= SPARK_MIN) return Tier.SPARK;
        return Tier.NONE;
    }

    function _getWeightForTier(Tier tier) internal pure returns (uint256) {
        if (tier == Tier.LIGHTHOUSE) return WEIGHT_LIGHTHOUSE;
        if (tier == Tier.BEACON) return WEIGHT_BEACON;
        if (tier == Tier.FLAME) return WEIGHT_FLAME;
        if (tier == Tier.SPARK) return WEIGHT_SPARK;
        return 0;
    }

    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}
}

// =========================================================================
// Interface
// =========================================================================

interface ICrowdstackingPool {
    function getPosition(address contributor) external view returns (
        uint256 shares,
        uint256 cumulativeContributed
    );
}
