// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity ^0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/**
 * @title MockERC20
 * @notice Simple ERC20 token for testing purposes.
 * @dev Allows anyone to mint tokens for testing.
 *      NOT FOR PRODUCTION USE.
 */
contract MockERC20 is ERC20 {
    uint8 private immutable _DECIMALS;

    /**
     * @notice Creates a new mock ERC20 token.
     * @param name_ Token name
     * @param symbol_ Token symbol
     * @param decimals_ Token decimals (typically 6 for stablecoins, 18 for ETH-like)
     */
    constructor(
        string memory name_,
        string memory symbol_,
        uint8 decimals_
    ) ERC20(name_, symbol_) {
        _DECIMALS = decimals_;
    }

    /**
     * @notice Returns the number of decimals.
     */
    function decimals() public view virtual override returns (uint8) {
        return _DECIMALS;
    }

    /**
     * @notice Mints tokens to a specified address.
     * @dev Anyone can call this - only for testing!
     * @param to Address to receive tokens
     * @param amount Amount to mint
     */
    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }

    /**
     * @notice Burns tokens from the caller's balance.
     * @param amount Amount to burn
     */
    function burn(uint256 amount) external {
        _burn(msg.sender, amount);
    }
}
