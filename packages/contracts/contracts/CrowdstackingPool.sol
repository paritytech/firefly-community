// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity ^0.8.24;

import {ReentrancyGuardUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import {PausableUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import {Ownable2StepUpgradeable} from "@openzeppelin/contracts-upgradeable/access/Ownable2StepUpgradeable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * @title CrowdstackingPool
 * @notice Share-based pooled capital for funding news outlets.
 * @dev Contributors deposit pUSD and receive shares at the current share price.
 *      Share price appreciates as yield is received and depreciates on losses.
 *      Withdrawals require a 30-day cooldown period for stability.
 *
 * Lifecycle:
 *   1. Contributor calls contribute() — receives shares at current price
 *   2. Yield is distributed via receiveYield() — share price increases
 *   3. Contributor calls requestWithdrawal() — shares locked, cooldown starts
 *   4. After cooldown, contributor calls completeWithdrawal() — receives assets
 *   OR
 *   4. Contributor calls cancelWithdrawal() — shares unlocked
 */
contract CrowdstackingPool is
    ReentrancyGuardUpgradeable,
    PausableUpgradeable,
    Ownable2StepUpgradeable,
    UUPSUpgradeable
{
    using SafeERC20 for IERC20;

    // =========================================================================
    // Types
    // =========================================================================

    struct Position {
        uint256 shares;
        uint256 cumulativeContributed;
        uint256 createdAt;
        uint256 updatedAt;
    }

    enum WithdrawalStatus {
        PENDING,
        COMPLETED,
        CANCELLED
    }

    struct WithdrawalRequest {
        address requester;
        uint256 shares;
        uint256 requestedAt;
        uint256 availableAt;
        WithdrawalStatus status;
    }

    // =========================================================================
    // Constants
    // =========================================================================

    /// @notice Share price precision (18 decimals)
    uint256 public constant SHARE_PRECISION = 1e18;

    /// @notice Withdrawal cooldown period (30 days)
    uint256 public constant WITHDRAWAL_COOLDOWN = 30 days;

    /// @notice Minimum contribution amount ($5 pUSD with 6 decimals)
    uint256 public constant MIN_CONTRIBUTION = 5 * 1e6;

    // =========================================================================
    // State
    // =========================================================================

    /// @notice Payment token (pUSD)
    IERC20 public paymentToken;

    /// @notice Total shares outstanding
    uint256 public totalShares;

    /// @notice Total assets (pUSD) in the pool
    uint256 public totalAssets;

    /// @notice Contributor positions
    mapping(address => Position) public positions;

    /// @notice Withdrawal requests by ID
    mapping(uint256 => WithdrawalRequest) public withdrawalRequests;

    /// @notice Next withdrawal request ID
    uint256 public nextWithdrawalId;

    /// @notice Number of unique contributors
    uint256 public contributorCount;

    /// @notice Yield source (authorized to call receiveYield)
    address public yieldSource;

    /// @notice OutletRegistry for distributions
    address public outletRegistry;

    // =========================================================================
    // Events
    // =========================================================================

    event Contributed(
        address indexed contributor,
        uint256 assets,
        uint256 shares,
        uint256 sharePrice
    );

    event WithdrawalRequested(
        uint256 indexed requestId,
        address indexed requester,
        uint256 shares,
        uint256 availableAt
    );

    event WithdrawalCompleted(
        uint256 indexed requestId,
        address indexed requester,
        uint256 shares,
        uint256 assets
    );

    event WithdrawalCancelled(
        uint256 indexed requestId,
        address indexed requester,
        uint256 shares
    );

    event YieldReceived(
        uint256 amount,
        uint256 newSharePrice,
        uint256 newTotalAssets
    );

    event LossRecorded(
        uint256 amount,
        uint256 newSharePrice,
        uint256 newTotalAssets
    );

    event YieldSourceUpdated(address indexed oldSource, address indexed newSource);

    event OutletRegistryUpdated(address indexed oldRegistry, address indexed newRegistry);

    // =========================================================================
    // Errors
    // =========================================================================

    error BelowMinimumContribution(uint256 amount, uint256 minimum);
    error InsufficientShares(uint256 available, uint256 requested);
    error WithdrawalNotFound(uint256 requestId);
    error WithdrawalNotPending(uint256 requestId, WithdrawalStatus status);
    error WithdrawalNotReady(uint256 requestId, uint256 availableAt, uint256 currentTime);
    error NotRequester(uint256 requestId, address caller, address requester);
    error UnauthorizedYieldSource(address caller);
    error ZeroAmount();
    error ZeroAddress();

    // =========================================================================
    // Initialization
    // =========================================================================

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /**
     * @notice Initialize the pool.
     * @param owner_ Contract owner
     * @param paymentToken_ pUSD token address
     * @param yieldSource_ Address authorized to send yield
     */
    function initialize(
        address owner_,
        address paymentToken_,
        address yieldSource_
    ) public initializer {
        if (paymentToken_ == address(0)) revert ZeroAddress();

        __ReentrancyGuard_init();
        __Pausable_init();
        __Ownable_init(owner_);
        __Ownable2Step_init();
        __UUPSUpgradeable_init();

        paymentToken = IERC20(paymentToken_);
        yieldSource = yieldSource_;
        nextWithdrawalId = 1;
    }

    // =========================================================================
    // Core Functions
    // =========================================================================

    /**
     * @notice Contribute pUSD to the pool and receive shares.
     * @param assets Amount of pUSD to contribute
     * @return shares Number of shares received
     */
    function contribute(uint256 assets) external nonReentrant whenNotPaused returns (uint256 shares) {
        if (assets == 0) revert ZeroAmount();
        if (assets < MIN_CONTRIBUTION) revert BelowMinimumContribution(assets, MIN_CONTRIBUTION);

        // Calculate shares at current price
        uint256 price = sharePrice();
        shares = (assets * SHARE_PRECISION) / price;

        // Transfer tokens from contributor
        paymentToken.safeTransferFrom(msg.sender, address(this), assets);

        // Update position
        Position storage position = positions[msg.sender];
        if (position.createdAt == 0) {
            position.createdAt = block.timestamp;
            contributorCount++;
        }
        position.shares += shares;
        position.cumulativeContributed += assets;
        position.updatedAt = block.timestamp;

        // Update pool state
        totalShares += shares;
        totalAssets += assets;

        emit Contributed(msg.sender, assets, shares, price);
    }

    /**
     * @notice Request to withdraw shares from the pool.
     * @param sharesToWithdraw Number of shares to withdraw
     * @return requestId Withdrawal request ID
     */
    function requestWithdrawal(uint256 sharesToWithdraw) external nonReentrant returns (uint256 requestId) {
        if (sharesToWithdraw == 0) revert ZeroAmount();

        Position storage position = positions[msg.sender];
        if (position.shares < sharesToWithdraw) {
            revert InsufficientShares(position.shares, sharesToWithdraw);
        }

        // Lock shares (remove from position, will be returned on cancel)
        position.shares -= sharesToWithdraw;
        position.updatedAt = block.timestamp;

        // Create withdrawal request
        requestId = nextWithdrawalId++;
        uint256 availableAt = block.timestamp + WITHDRAWAL_COOLDOWN;

        withdrawalRequests[requestId] = WithdrawalRequest({
            requester: msg.sender,
            shares: sharesToWithdraw,
            requestedAt: block.timestamp,
            availableAt: availableAt,
            status: WithdrawalStatus.PENDING
        });

        emit WithdrawalRequested(requestId, msg.sender, sharesToWithdraw, availableAt);
    }

    /**
     * @notice Complete a withdrawal after the cooldown period.
     * @param requestId Withdrawal request ID
     * @return assets Amount of pUSD received
     */
    function completeWithdrawal(uint256 requestId) external nonReentrant returns (uint256 assets) {
        WithdrawalRequest storage request = withdrawalRequests[requestId];

        // Validate
        if (request.requester == address(0)) {
            revert WithdrawalNotFound(requestId);
        }
        if (request.status != WithdrawalStatus.PENDING) {
            revert WithdrawalNotPending(requestId, request.status);
        }
        if (msg.sender != request.requester) {
            revert NotRequester(requestId, msg.sender, request.requester);
        }
        if (block.timestamp < request.availableAt) {
            revert WithdrawalNotReady(requestId, request.availableAt, block.timestamp);
        }

        // Calculate assets at current price
        uint256 price = sharePrice();
        assets = (request.shares * price) / SHARE_PRECISION;

        // Update request status (CEI pattern)
        request.status = WithdrawalStatus.COMPLETED;

        // Update pool state
        totalShares -= request.shares;
        totalAssets -= assets;

        // Check if contributor has no more shares
        Position storage position = positions[msg.sender];
        if (position.shares == 0) {
            contributorCount--;
        }

        // Transfer assets
        paymentToken.safeTransfer(msg.sender, assets);

        emit WithdrawalCompleted(requestId, msg.sender, request.shares, assets);
    }

    /**
     * @notice Cancel a pending withdrawal and return shares to position.
     * @param requestId Withdrawal request ID
     */
    function cancelWithdrawal(uint256 requestId) external nonReentrant {
        WithdrawalRequest storage request = withdrawalRequests[requestId];

        // Validate
        if (request.requester == address(0)) {
            revert WithdrawalNotFound(requestId);
        }
        if (request.status != WithdrawalStatus.PENDING) {
            revert WithdrawalNotPending(requestId, request.status);
        }
        if (msg.sender != request.requester) {
            revert NotRequester(requestId, msg.sender, request.requester);
        }

        // Update request status
        request.status = WithdrawalStatus.CANCELLED;

        // Return shares to position
        Position storage position = positions[msg.sender];
        position.shares += request.shares;
        position.updatedAt = block.timestamp;

        emit WithdrawalCancelled(requestId, msg.sender, request.shares);
    }

    // =========================================================================
    // Yield Management (Restricted)
    // =========================================================================

    /**
     * @notice Receive yield into the pool, increasing share price.
     * @param amount Amount of yield received
     * @dev Only callable by authorized yield source.
     */
    function receiveYield(uint256 amount) external nonReentrant {
        if (msg.sender != yieldSource && msg.sender != owner()) {
            revert UnauthorizedYieldSource(msg.sender);
        }
        if (amount == 0) revert ZeroAmount();

        // Transfer yield tokens
        paymentToken.safeTransferFrom(msg.sender, address(this), amount);

        // Update total assets (share price automatically increases)
        totalAssets += amount;

        emit YieldReceived(amount, sharePrice(), totalAssets);
    }

    /**
     * @notice Record a loss (e.g., from bad debt), decreasing share price.
     * @param amount Amount of loss
     * @dev Only callable by owner. Does not transfer tokens.
     */
    function recordLoss(uint256 amount) external onlyOwner {
        if (amount == 0) revert ZeroAmount();
        if (amount > totalAssets) {
            amount = totalAssets; // Cap at total assets
        }

        totalAssets -= amount;

        emit LossRecorded(amount, sharePrice(), totalAssets);
    }

    // =========================================================================
    // View Functions
    // =========================================================================

    /**
     * @notice Get the current share price.
     * @return Current share price (scaled by SHARE_PRECISION)
     */
    function sharePrice() public view returns (uint256) {
        if (totalShares == 0) {
            return SHARE_PRECISION; // Initial price is 1:1
        }
        return (totalAssets * SHARE_PRECISION) / totalShares;
    }

    /**
     * @notice Convert assets to shares at current price.
     * @param assets Amount of assets
     * @return shares Number of shares
     */
    function convertToShares(uint256 assets) external view returns (uint256) {
        return (assets * SHARE_PRECISION) / sharePrice();
    }

    /**
     * @notice Convert shares to assets at current price.
     * @param shares Number of shares
     * @return assets Amount of assets
     */
    function convertToAssets(uint256 shares) external view returns (uint256) {
        return (shares * sharePrice()) / SHARE_PRECISION;
    }

    /**
     * @notice Get a contributor's position.
     * @param contributor Address to check
     * @return shares Number of shares held
     * @return cumulativeContributed Total amount ever contributed
     */
    function getPosition(address contributor) external view returns (
        uint256 shares,
        uint256 cumulativeContributed
    ) {
        Position storage position = positions[contributor];
        return (position.shares, position.cumulativeContributed);
    }

    /**
     * @notice Get withdrawal request details.
     * @param requestId Request ID
     * @return request The withdrawal request
     */
    function getWithdrawalRequest(uint256 requestId) external view returns (WithdrawalRequest memory) {
        return withdrawalRequests[requestId];
    }

    /**
     * @notice Check if a withdrawal is ready to complete.
     * @param requestId Request ID
     * @return ready True if the withdrawal can be completed
     */
    function isWithdrawalReady(uint256 requestId) external view returns (bool) {
        WithdrawalRequest storage request = withdrawalRequests[requestId];
        return request.status == WithdrawalStatus.PENDING &&
               block.timestamp >= request.availableAt;
    }

    // =========================================================================
    // Admin Functions
    // =========================================================================

    /**
     * @notice Update the yield source address.
     * @param newYieldSource New yield source address
     */
    function setYieldSource(address newYieldSource) external onlyOwner {
        address oldSource = yieldSource;
        yieldSource = newYieldSource;
        emit YieldSourceUpdated(oldSource, newYieldSource);
    }

    /**
     * @notice Update the outlet registry address.
     * @param newOutletRegistry New outlet registry address
     */
    function setOutletRegistry(address newOutletRegistry) external onlyOwner {
        address oldRegistry = outletRegistry;
        outletRegistry = newOutletRegistry;
        emit OutletRegistryUpdated(oldRegistry, newOutletRegistry);
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
