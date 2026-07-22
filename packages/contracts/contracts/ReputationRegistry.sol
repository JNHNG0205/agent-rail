// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title ReputationRegistry — ERC-8004 reputation counter.
/// @notice Tracks a simple completed-job reputation score per agent. Bumped on
///         settlement so the frontend can rank providers. Member 2.
contract ReputationRegistry {
    // agent address => reputation score
    mapping(address => uint256) public reputation;

    event ReputationUpdated(address indexed agent, uint256 newScore);

    /// @notice Increment `agent`'s reputation by `delta`.
    /// @dev Restrict the caller to the JobContract/EvaluatorModule in the real impl.
    function increment(address agent, uint256 delta) external {
        // TODO(M2): access-control the caller, add delta, emit ReputationUpdated.
        revert("TODO(M2): increment");
    }
}
