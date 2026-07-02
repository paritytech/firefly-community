// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity ^0.8.24;

import {ReentrancyGuardUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import {PausableUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import {Ownable2StepUpgradeable} from "@openzeppelin/contracts-upgradeable/access/Ownable2StepUpgradeable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * @title OutletRegistry
 * @notice Registry of news outlets eligible for crowdstacking distributions.
 * @dev Manages outlet allocations (weights) and distributes funds proportionally.
 *      Weights are in basis points (10000 = 100%).
 *
 * Governance:
 *   - Owner (or governance contract) can add/remove outlets
 *   - Owner (or governance contract) can update allocation weights
 *   - Distributions can be triggered by authorized distributors
 */
contract OutletRegistry is
    ReentrancyGuardUpgradeable,
    PausableUpgradeable,
    Ownable2StepUpgradeable,
    UUPSUpgradeable
{
    using SafeERC20 for IERC20;

    // =========================================================================
    // Types
    // =========================================================================

    struct Outlet {
        address treasury;
        uint256 weight;
        bool isActive;
        uint256 addedAt;
        uint256 totalDistributed;
    }

    // =========================================================================
    // Constants
    // =========================================================================

    /// @notice Basis points denominator (10000 = 100%)
    uint256 public constant BASIS_POINTS = 10000;

    // =========================================================================
    // State
    // =========================================================================

    /// @notice Payment token (pUSD)
    IERC20 public paymentToken;

    /// @notice Outlets by ID (bytes32 allows for flexible ID schemes)
    mapping(bytes32 => Outlet) public outlets;

    /// @notice Array of outlet IDs for iteration
    bytes32[] public outletIds;

    /// @notice Total weight of all active outlets
    uint256 public totalWeight;

    /// @notice Authorized distributors (e.g., CrowdstackingPool)
    mapping(address => bool) public distributors;

    /// @notice Governance contract (can add/remove outlets)
    address public governance;

    /// @notice Total amount distributed all-time
    uint256 public totalDistributedAllTime;

    // =========================================================================
    // Events
    // =========================================================================

    event OutletAdded(
        bytes32 indexed outletId,
        address indexed treasury,
        uint256 weight
    );

    event OutletRemoved(
        bytes32 indexed outletId,
        address indexed treasury
    );

    event OutletUpdated(
        bytes32 indexed outletId,
        uint256 oldWeight,
        uint256 newWeight
    );

    event WeightsUpdated(
        bytes32[] outletIds,
        uint256[] newWeights
    );

    event Distributed(
        uint256 totalAmount,
        uint256 outletCount
    );

    event DistributorUpdated(
        address indexed distributor,
        bool authorized
    );

    event GovernanceUpdated(
        address indexed oldGovernance,
        address indexed newGovernance
    );

    // =========================================================================
    // Errors
    // =========================================================================

    error OutletAlreadyExists(bytes32 outletId);
    error OutletNotFound(bytes32 outletId);
    error OutletNotActive(bytes32 outletId);
    error InvalidWeight(uint256 weight);
    error WeightSumMismatch(uint256 expected, uint256 actual);
    error ArrayLengthMismatch(uint256 idsLength, uint256 weightsLength);
    error UnauthorizedDistributor(address caller);
    error UnauthorizedGovernance(address caller);
    error ZeroAddress();
    error ZeroAmount();

    // =========================================================================
    // Modifiers
    // =========================================================================

    modifier onlyGovernance() {
        if (msg.sender != governance && msg.sender != owner()) {
            revert UnauthorizedGovernance(msg.sender);
        }
        _;
    }

    modifier onlyDistributor() {
        if (!distributors[msg.sender] && msg.sender != owner()) {
            revert UnauthorizedDistributor(msg.sender);
        }
        _;
    }

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
     * @param paymentToken_ pUSD token address
     * @param governance_ Governance contract address
     */
    function initialize(
        address owner_,
        address paymentToken_,
        address governance_
    ) public initializer {
        if (paymentToken_ == address(0)) revert ZeroAddress();

        __ReentrancyGuard_init();
        __Pausable_init();
        __Ownable_init(owner_);
        __Ownable2Step_init();
        __UUPSUpgradeable_init();

        paymentToken = IERC20(paymentToken_);
        governance = governance_;
    }

    // =========================================================================
    // Governance Functions
    // =========================================================================

    /**
     * @notice Add a new outlet to the registry.
     * @param outletId Unique outlet identifier
     * @param treasury Treasury address to receive distributions
     * @param weight Initial allocation weight (basis points)
     */
    function addOutlet(
        bytes32 outletId,
        address treasury,
        uint256 weight
    ) external onlyGovernance {
        if (treasury == address(0)) revert ZeroAddress();
        if (outlets[outletId].treasury != address(0)) {
            revert OutletAlreadyExists(outletId);
        }

        outlets[outletId] = Outlet({
            treasury: treasury,
            weight: weight,
            isActive: true,
            addedAt: block.timestamp,
            totalDistributed: 0
        });

        outletIds.push(outletId);
        totalWeight += weight;

        emit OutletAdded(outletId, treasury, weight);
    }

    /**
     * @notice Remove an outlet from the registry.
     * @param outletId Outlet to remove
     */
    function removeOutlet(bytes32 outletId) external onlyGovernance {
        Outlet storage outlet = outlets[outletId];
        if (outlet.treasury == address(0)) {
            revert OutletNotFound(outletId);
        }

        // Reduce total weight
        if (outlet.isActive) {
            totalWeight -= outlet.weight;
        }

        // Mark as inactive (don't delete to preserve history)
        outlet.isActive = false;
        outlet.weight = 0;

        emit OutletRemoved(outletId, outlet.treasury);
    }

    /**
     * @notice Update allocation weights for multiple outlets.
     * @param ids Array of outlet IDs
     * @param weights Array of new weights
     * @dev Sum of active outlet weights must equal BASIS_POINTS after update.
     */
    function updateWeights(
        bytes32[] calldata ids,
        uint256[] calldata weights
    ) external onlyGovernance {
        if (ids.length != weights.length) {
            revert ArrayLengthMismatch(ids.length, weights.length);
        }

        // Apply updates and calculate new total
        uint256 newTotalWeight = totalWeight;

        for (uint256 i = 0; i < ids.length; i++) {
            Outlet storage outlet = outlets[ids[i]];
            if (outlet.treasury == address(0)) {
                revert OutletNotFound(ids[i]);
            }
            if (!outlet.isActive) {
                revert OutletNotActive(ids[i]);
            }

            uint256 oldWeight = outlet.weight;
            outlet.weight = weights[i];

            // Update running total
            newTotalWeight = newTotalWeight - oldWeight + weights[i];
        }

        // Validate sum equals BASIS_POINTS
        if (newTotalWeight != BASIS_POINTS) {
            revert WeightSumMismatch(BASIS_POINTS, newTotalWeight);
        }

        totalWeight = newTotalWeight;

        emit WeightsUpdated(ids, weights);
    }

    // =========================================================================
    // Distribution Functions
    // =========================================================================

    /**
     * @notice Distribute funds to all active outlets proportionally.
     * @param amount Total amount to distribute
     */
    function distribute(uint256 amount) external nonReentrant whenNotPaused onlyDistributor {
        if (amount == 0) revert ZeroAmount();
        if (totalWeight == 0) return; // No outlets to distribute to

        // Transfer total amount from caller
        paymentToken.safeTransferFrom(msg.sender, address(this), amount);

        uint256 distributed = 0;
        uint256 outletCount = 0;

        // Distribute to each active outlet
        for (uint256 i = 0; i < outletIds.length; i++) {
            bytes32 outletId = outletIds[i];
            Outlet storage outlet = outlets[outletId];

            if (outlet.isActive && outlet.weight > 0) {
                uint256 share = (amount * outlet.weight) / BASIS_POINTS;

                if (share > 0) {
                    outlet.totalDistributed += share;
                    distributed += share;
                    outletCount++;

                    paymentToken.safeTransfer(outlet.treasury, share);
                }
            }
        }

        totalDistributedAllTime += distributed;

        emit Distributed(distributed, outletCount);
    }

    // =========================================================================
    // View Functions
    // =========================================================================

    /**
     * @notice Get outlet details.
     * @param outletId Outlet identifier
     * @return outlet Outlet struct
     */
    function getOutlet(bytes32 outletId) external view returns (Outlet memory) {
        return outlets[outletId];
    }

    /**
     * @notice Get all outlet IDs.
     * @return Array of outlet IDs
     */
    function getOutletIds() external view returns (bytes32[] memory) {
        return outletIds;
    }

    /**
     * @notice Get count of active outlets.
     * @return count Number of active outlets
     */
    function getActiveOutletCount() external view returns (uint256 count) {
        for (uint256 i = 0; i < outletIds.length; i++) {
            if (outlets[outletIds[i]].isActive) {
                count++;
            }
        }
    }

    /**
     * @notice Calculate distribution amounts for each outlet.
     * @param totalAmount Total amount to distribute
     * @return ids Array of outlet IDs
     * @return amounts Array of distribution amounts
     */
    function calculateDistributions(uint256 totalAmount) external view returns (
        bytes32[] memory ids,
        uint256[] memory amounts
    ) {
        uint256 activeCount = 0;
        for (uint256 i = 0; i < outletIds.length; i++) {
            if (outlets[outletIds[i]].isActive && outlets[outletIds[i]].weight > 0) {
                activeCount++;
            }
        }

        ids = new bytes32[](activeCount);
        amounts = new uint256[](activeCount);

        uint256 idx = 0;
        for (uint256 i = 0; i < outletIds.length; i++) {
            bytes32 outletId = outletIds[i];
            Outlet storage outlet = outlets[outletId];

            if (outlet.isActive && outlet.weight > 0) {
                ids[idx] = outletId;
                amounts[idx] = (totalAmount * outlet.weight) / BASIS_POINTS;
                idx++;
            }
        }
    }

    // =========================================================================
    // Admin Functions
    // =========================================================================

    /**
     * @notice Update distributor authorization.
     * @param distributor Address to update
     * @param authorized Whether to authorize
     */
    function setDistributor(address distributor, bool authorized) external onlyOwner {
        distributors[distributor] = authorized;
        emit DistributorUpdated(distributor, authorized);
    }

    /**
     * @notice Update governance contract.
     * @param newGovernance New governance address
     */
    function setGovernance(address newGovernance) external onlyOwner {
        address oldGovernance = governance;
        governance = newGovernance;
        emit GovernanceUpdated(oldGovernance, newGovernance);
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    // =========================================================================
    // Internal Functions
    // =========================================================================

    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}
}
