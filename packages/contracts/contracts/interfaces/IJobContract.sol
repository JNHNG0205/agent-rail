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
        uint256 amount;
        JobState state;
        bytes32 deliverableHash;
    }

    function createJob(address provider, uint256 amount) external returns (uint256 jobId);
    function fundJob(uint256 jobId) external;
    function submitDeliverable(uint256 jobId, bytes32 deliverableHash) external;
    function settle(uint256 jobId) external;
    function cancel(uint256 jobId) external;
    function getJob(uint256 jobId) external view returns (Job memory);
}
