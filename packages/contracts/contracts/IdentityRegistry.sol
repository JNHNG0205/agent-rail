// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";

/// @title IdentityRegistry — ERC-8004 inspired identity registry for AI agents.
/// @notice Mints soulbound/identity NFTs to represent autonomous agents on-chain.
///         Used by the frontend and indexer to track agent identities.
contract IdentityRegistry is ERC721 {
    uint256 private _nextTokenId;

    // agent address => registered status
    mapping(address => bool) private _registered;

    // agent address => token ID
    mapping(address => uint256) private _agentTokenId;

    /// @notice Emitted when a new agent identity NFT is registered.
    /// @param agent The address of the registered AI agent.
    /// @param tokenId The unique ERC-721 token ID assigned to the agent.
    event AgentRegistered(address indexed agent, uint256 indexed tokenId);

    /// @notice Thrown on any attempt to move or destroy an identity token.
    error Soulbound();

    constructor() ERC721("AgentIdentity", "AID") {}

    /// @notice Registers a new AI agent by minting an identity NFT.
    /// @dev Reverts if the agent address is already registered.
    /// @param agent The address of the AI agent to register.
    /// @return tokenId The assigned ERC-721 token ID.
    function registerAgent(address agent) external returns (uint256 tokenId) {
        require(agent != address(0), "IdentityRegistry: invalid agent address");
        require(!_registered[agent], "IdentityRegistry: agent already registered");

        tokenId = _nextTokenId;
        _nextTokenId++;

        _registered[agent] = true;
        _agentTokenId[agent] = tokenId;

        _safeMint(agent, tokenId);

        emit AgentRegistered(agent, tokenId);
    }

    /// @notice Checks if an address is a registered AI agent.
    /// @param agent The address to check.
    /// @return Whether the address is registered.
    function isRegistered(address agent) external view returns (bool) {
        return _registered[agent];
    }

    /// @notice Gets the identity token ID assigned to a registered agent.
    /// @param agent The address of the AI agent.
    /// @return tokenId The assigned token ID.
    function getAgentId(address agent) external view returns (uint256 tokenId) {
        require(_registered[agent], "IdentityRegistry: agent not registered");
        return _agentTokenId[agent];
    }

    /// @notice Gets the owner address of a given identity token ID.
    /// @param tokenId The identity token ID to query.
    /// @return The owner address of the token ID.
    function getAgentAddress(uint256 tokenId) external view returns (address) {
        return ownerOf(tokenId);
    }

    /// @dev Enforces soulbinding. Every mint, transfer and burn in OpenZeppelin
    ///      v5 routes through this hook, so permitting only the mint case
    ///      (`from == address(0)`) blocks transfers and burns alike.
    ///
    ///      This is not cosmetic. `_registered` and `_agentTokenId` are keyed by
    ///      address and never updated after minting, so a transfer would leave
    ///      isRegistered() and getAgentId() describing the old holder while
    ///      getAgentAddress() reported the new one — two views of the same fact
    ///      permanently disagreeing. Burning would strand the same mappings
    ///      pointing at a token that no longer exists.
    function _update(address to, uint256 tokenId, address auth)
        internal
        override
        returns (address)
    {
        if (_ownerOf(tokenId) != address(0)) revert Soulbound();
        return super._update(to, tokenId, auth);
    }

    /// @dev Approvals are blocked too. A token that cannot move makes an
    ///      approval unusable by construction, and letting approve() succeed
    ///      would advertise a capability that never works.
    function approve(address, uint256) public pure override {
        revert Soulbound();
    }

    function setApprovalForAll(address, bool) public pure override {
        revert Soulbound();
    }
}
