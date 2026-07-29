// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/// @title ReputationRegistry — ERC-8004 inspired reputation score registry for AI agents.
/// @notice Tracks completed job scores per agent address, updated exclusively by the authorized JobContract.
contract ReputationRegistry is Ownable {
    // agent address => reputation score
    mapping(address => uint256) private _reputationScore;

    // Authorized JobContract allowed to record completions
    address public jobContract;

    /// @notice Emitted when an agent's reputation score is incremented.
    /// @param agent The address of the agent receiving reputation.
    /// @param newScore The updated reputation score of the agent.
    event ReputationUpdated(address indexed agent, uint256 newScore);

    /// @notice Emitted when the authorized JobContract address is updated.
    /// @param newJobContract The new authorized JobContract address.
    event JobContractUpdated(address indexed newJobContract);

    modifier onlyJobContract() {
        require(jobContract != address(0), "ReputationRegistry: JobContract not set");
        require(msg.sender == jobContract, "ReputationRegistry: caller is not authorized JobContract");
        _;
    }

    /// @notice Initializes the ReputationRegistry contract.
    /// @param initialOwner The address that will own the contract.
    constructor(address initialOwner) Ownable(initialOwner) {}

    /// @notice Sets or updates the authorized JobContract address.
    /// @dev Can only be called by the contract owner.
    /// @param _jobContract The address of the JobContract.
    function setJobContract(address _jobContract) external onlyOwner {
        require(_jobContract != address(0), "ReputationRegistry: invalid JobContract address");
        jobContract = _jobContract;
        emit JobContractUpdated(_jobContract);
    }

    /// @notice Increments the reputation score of an agent by 1 upon job completion.
    /// @dev Can only be called by the authorized JobContract.
    /// @param agent The address of the agent whose score is being incremented.
    function recordCompletion(address agent) external onlyJobContract {
        require(agent != address(0), "ReputationRegistry: invalid agent address");
        _reputationScore[agent] += 1;
        emit ReputationUpdated(agent, _reputationScore[agent]);
    }

    /// @notice Returns the current reputation score of an agent.
    /// @param agent The address of the agent to query.
    /// @return The current reputation score of the agent.
    function getReputation(address agent) external view returns (uint256) {
        return _reputationScore[agent];
    }
}
