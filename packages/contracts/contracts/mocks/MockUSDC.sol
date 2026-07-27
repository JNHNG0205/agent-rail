// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @title MockUSDC — 6-decimal ERC-20 test token for local demos.
/// @notice Not for any real network. `mint` is open on purpose so seed.ts can
///         fund the demo agents. Member 1.
contract MockUSDC is ERC20 {
    constructor() ERC20("Mock USD Coin", "USDC") {}

    /// @dev USDC uses 6 decimals, not the ERC-20 default of 18.
    function decimals() public pure override returns (uint8) {
        return 6;
    }

    /// @notice Open faucet for local seeding only.
    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}
