// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";

/// @title IdentityRegistry — ERC-8004 on-chain agent identity as ERC-721.
/// @notice Each registered agent mints one soulbound-style identity token that
///         carries its display name. Member 2.
contract IdentityRegistry is ERC721 {
    uint256 public nextTokenId;

    // tokenId => agent display name
    mapping(uint256 => string) public agentName;
    // agent address => tokenId (0 == unregistered)
    mapping(address => uint256) public tokenOf;

    event AgentRegistered(address indexed agent, uint256 indexed tokenId, string name);

    constructor() ERC721("AgentRail Identity", "ARID") {}

    /// @notice Register `agent` with a display name, minting its identity token.
    function register(address agent, string calldata name) external returns (uint256 tokenId) {
        // TODO(M2): guard against double-registration, mint token, store name,
        //           emit AgentRegistered.
        revert("TODO(M2): register");
    }

    function isRegistered(address agent) external view returns (bool) {
        return tokenOf[agent] != 0;
    }
}
