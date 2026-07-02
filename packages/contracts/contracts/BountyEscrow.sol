// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity ^0.8.24;

import {ReentrancyGuardUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import {PausableUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import {Ownable2StepUpgradeable} from "@openzeppelin/contracts-upgradeable/access/Ownable2StepUpgradeable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * @title BountyEscrow
 * @notice Minimal escrow contract for Firefly Network bounties.
 * @dev Funds are locked when a bounty is created and released to contributors
 *      when the bounty is fulfilled. No shipping, no delivery codes — just
 *      lock → hold → release.
 *
 * Lifecycle:
 *   1. Funder calls fundBounty() — funds locked, status = OPEN
 *   2. Contributors add signals off-chain
 *   3. Funder calls releaseBounty() with allocation — funds distributed, status = CLOSED
 *   OR
 *   3. Funder calls cancelBounty() — funds returned, status = CANCELLED
 *   OR
 *   3. Anyone calls claimExpired() after expiry — funds returned, status = EXPIRED
 */
contract BountyEscrow is
    ReentrancyGuardUpgradeable,
    PausableUpgradeable,
    Ownable2StepUpgradeable,
    UUPSUpgradeable
{
    using SafeERC20 for IERC20;

    // =========================================================================
    // Types
    // =========================================================================

    enum BountyStatus {
        OPEN,
        CLOSED,
        CANCELLED,
        EXPIRED
    }

    struct Bounty {
        address funder;
        address paymentAsset; // address(0) for native token
        uint256 amount;
        uint256 expiresAt;
        BountyStatus status;
    }

    struct Allocation {
        address recipient;
        uint256 amount;
    }

    // =========================================================================
    // State
    // =========================================================================

    /// @notice Bounty storage by ID
    mapping(bytes32 => Bounty) public bounties;

    /// @notice Native asset sentinel value
    address public constant NATIVE_ASSET = address(0);

    // =========================================================================
    // Events
    // =========================================================================

    event BountyFunded(
        bytes32 indexed bountyId,
        address indexed funder,
        address paymentAsset,
        uint256 amount,
        uint256 expiresAt
    );

    event BountyReleased(
        bytes32 indexed bountyId,
        uint256 recipientCount,
        uint256 totalAmount
    );

    event BountyCancelled(bytes32 indexed bountyId, uint256 refundAmount);

    event BountyExpired(bytes32 indexed bountyId, uint256 refundAmount);

    // =========================================================================
    // Errors
    // =========================================================================

    error BountyAlreadyExists(bytes32 bountyId);
    error BountyNotFound(bytes32 bountyId);
    error BountyNotOpen(bytes32 bountyId, BountyStatus currentStatus);
    error BountyNotExpired(bytes32 bountyId, uint256 expiresAt, uint256 currentTime);
    error NotFunder(bytes32 bountyId, address caller, address funder);
    error InvalidExpiration(uint256 expiresAt, uint256 currentTime);
    error AllocationMismatch(uint256 totalAllocated, uint256 bountyAmount);
    error InvalidNativeAmount(uint256 sent, uint256 expected);
    error NativeNotAccepted();
    error TransferFailed(address to, uint256 amount);
    error EmptyAllocations();

    // =========================================================================
    // Initialization
    // =========================================================================

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(address owner_) public initializer {
        __ReentrancyGuard_init();
        __Pausable_init();
        __Ownable_init(owner_);
        __Ownable2Step_init();
        __UUPSUpgradeable_init();
    }

    // =========================================================================
    // Core Functions
    // =========================================================================

    /**
     * @notice Fund a new bounty.
     * @param bountyId_ Unique identifier for the bounty (e.g., keccak256 of off-chain ID)
     * @param paymentAsset_ Token address (address(0) for native)
     * @param amount_ Amount to lock in escrow
     * @param expiresAt_ Unix timestamp when bounty expires
     */
    function fundBounty(
        bytes32 bountyId_,
        address paymentAsset_,
        uint256 amount_,
        uint256 expiresAt_
    ) external payable nonReentrant whenNotPaused {
        // Validate
        if (bounties[bountyId_].funder != address(0)) {
            revert BountyAlreadyExists(bountyId_);
        }
        if (expiresAt_ <= block.timestamp) {
            revert InvalidExpiration(expiresAt_, block.timestamp);
        }

        // Lock funds
        _lockFunds(paymentAsset_, amount_);

        // Store bounty
        bounties[bountyId_] = Bounty({
            funder: msg.sender,
            paymentAsset: paymentAsset_,
            amount: amount_,
            expiresAt: expiresAt_,
            status: BountyStatus.OPEN
        });

        emit BountyFunded(bountyId_, msg.sender, paymentAsset_, amount_, expiresAt_);
    }

    /**
     * @notice Release bounty funds to multiple recipients.
     * @param bountyId_ The bounty to release
     * @param allocations_ Array of (recipient, amount) pairs
     * @dev Sum of allocations must equal bounty amount exactly.
     */
    function releaseBounty(
        bytes32 bountyId_,
        Allocation[] calldata allocations_
    ) external nonReentrant {
        Bounty storage bounty = bounties[bountyId_];

        // Validate
        if (bounty.funder == address(0)) {
            revert BountyNotFound(bountyId_);
        }
        if (bounty.status != BountyStatus.OPEN) {
            revert BountyNotOpen(bountyId_, bounty.status);
        }
        if (msg.sender != bounty.funder) {
            revert NotFunder(bountyId_, msg.sender, bounty.funder);
        }
        if (allocations_.length == 0) {
            revert EmptyAllocations();
        }

        // Verify allocations sum to bounty amount
        uint256 total = 0;
        for (uint256 i = 0; i < allocations_.length; i++) {
            total += allocations_[i].amount;
        }
        if (total != bounty.amount) {
            revert AllocationMismatch(total, bounty.amount);
        }

        // Update status before transfers (CEI pattern)
        bounty.status = BountyStatus.CLOSED;

        // Transfer to each recipient
        for (uint256 i = 0; i < allocations_.length; i++) {
            _transferFunds(
                allocations_[i].recipient,
                allocations_[i].amount,
                bounty.paymentAsset
            );
        }

        emit BountyReleased(bountyId_, allocations_.length, bounty.amount);
    }

    /**
     * @notice Cancel a bounty and return funds to funder.
     * @param bountyId_ The bounty to cancel
     * @dev Only the funder can cancel. Only open bounties can be cancelled.
     */
    function cancelBounty(bytes32 bountyId_) external nonReentrant {
        Bounty storage bounty = bounties[bountyId_];

        // Validate
        if (bounty.funder == address(0)) {
            revert BountyNotFound(bountyId_);
        }
        if (bounty.status != BountyStatus.OPEN) {
            revert BountyNotOpen(bountyId_, bounty.status);
        }
        if (msg.sender != bounty.funder) {
            revert NotFunder(bountyId_, msg.sender, bounty.funder);
        }

        // Update status before transfer
        uint256 refundAmount = bounty.amount;
        bounty.status = BountyStatus.CANCELLED;

        // Return funds
        _transferFunds(bounty.funder, refundAmount, bounty.paymentAsset);

        emit BountyCancelled(bountyId_, refundAmount);
    }

    /**
     * @notice Claim an expired bounty (returns funds to funder).
     * @param bountyId_ The expired bounty to claim
     * @dev Anyone can call this after expiry. Funds go to original funder.
     */
    function claimExpired(bytes32 bountyId_) external nonReentrant {
        Bounty storage bounty = bounties[bountyId_];

        // Validate
        if (bounty.funder == address(0)) {
            revert BountyNotFound(bountyId_);
        }
        if (bounty.status != BountyStatus.OPEN) {
            revert BountyNotOpen(bountyId_, bounty.status);
        }
        if (block.timestamp < bounty.expiresAt) {
            revert BountyNotExpired(bountyId_, bounty.expiresAt, block.timestamp);
        }

        // Update status before transfer
        uint256 refundAmount = bounty.amount;
        bounty.status = BountyStatus.EXPIRED;

        // Return funds to funder
        _transferFunds(bounty.funder, refundAmount, bounty.paymentAsset);

        emit BountyExpired(bountyId_, refundAmount);
    }

    // =========================================================================
    // View Functions
    // =========================================================================

    /**
     * @notice Get bounty details.
     */
    function getBounty(bytes32 bountyId_) external view returns (Bounty memory) {
        return bounties[bountyId_];
    }

    /**
     * @notice Check if a bounty exists.
     */
    function bountyExists(bytes32 bountyId_) external view returns (bool) {
        return bounties[bountyId_].funder != address(0);
    }

    /**
     * @notice Check if a bounty is expired.
     */
    function isExpired(bytes32 bountyId_) external view returns (bool) {
        Bounty storage bounty = bounties[bountyId_];
        return bounty.funder != address(0) &&
               bounty.status == BountyStatus.OPEN &&
               block.timestamp >= bounty.expiresAt;
    }

    // =========================================================================
    // Admin Functions
    // =========================================================================

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    // =========================================================================
    // Internal Functions
    // =========================================================================

    function _lockFunds(address asset_, uint256 amount_) private {
        if (asset_ == NATIVE_ASSET) {
            if (msg.value != amount_) {
                revert InvalidNativeAmount(msg.value, amount_);
            }
        } else {
            if (msg.value != 0) {
                revert NativeNotAccepted();
            }
            IERC20(asset_).safeTransferFrom(msg.sender, address(this), amount_);
        }
    }

    function _transferFunds(address to_, uint256 amount_, address asset_) private {
        if (asset_ == NATIVE_ASSET) {
            (bool success, ) = payable(to_).call{value: amount_}("");
            if (!success) {
                revert TransferFailed(to_, amount_);
            }
        } else {
            IERC20(asset_).safeTransfer(to_, amount_);
        }
    }

    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}
}
