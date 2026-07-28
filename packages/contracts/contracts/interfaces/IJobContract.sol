// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IJobContract {
    enum JobState {
        Open,
        Funded,
        Submitted,
        Terminal
    }

    struct Job {
        address client;
        address provider;
        address evaluator;
        uint256 amount;
        JobState state;
        bytes32 deliverableHash;
        uint256 timeoutBlocks;
        uint256 deadline;
    }

    event JobCreated(uint256 indexed jobId, address indexed client, address indexed provider, address evaluator, uint256 amount);
    event JobFunded(uint256 indexed jobId, uint256 amount);
    event DeliverableSubmitted(uint256 indexed jobId, bytes32 deliverableHash);
    event JobCompleted(uint256 indexed jobId, address indexed provider, uint256 amount);
    event JobCancelled(uint256 indexed jobId, address indexed client, uint256 refund);
    event JobTimeoutClaimed(uint256 indexed jobId, address indexed provider, uint256 amount);

    function createJob(address provider, address evaluator, uint256 amount) external returns (uint256 jobId);
    function createJob(address provider, address evaluator, uint256 amount, uint256 timeoutBlocks) external returns (uint256 jobId);
    function fundJob(uint256 jobId) external;
    function submitDeliverable(uint256 jobId, bytes32 deliverableHash) external;
    function settle(uint256 jobId) external;
    function claimTimeout(uint256 jobId) external;
    function cancel(uint256 jobId) external;
    function getJob(uint256 jobId) external view returns (Job memory);
}
