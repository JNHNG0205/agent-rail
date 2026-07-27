// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/// @title JobContract — ERC-8183 job lifecycle + USDC escrow.
/// @notice Client creates a job, funds it into escrow, provider submits a
///         deliverable hash, and settlement releases (or refunds) the escrow.
///         The chain is the source of truth for job state. Member 1.
contract JobContract {
    /// @dev Terminal covers both Completed (paid) and Cancelled (refunded);
    ///      distinguish via the emitted event, not extra enum members.
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
        uint256 amount; // USDC, 6 decimals
        JobState state;
        bytes32 deliverableHash;
    }

    IERC20 public immutable usdc;

    // jobId => Job
    mapping(uint256 => Job) public jobs;
    uint256 public nextJobId;

    event JobCreated(uint256 indexed jobId, address indexed client, address indexed provider, address evaluator, uint256 amount);
    event JobFunded(uint256 indexed jobId, uint256 amount);
    event DeliverableSubmitted(uint256 indexed jobId, bytes32 deliverableHash);
    event JobCompleted(uint256 indexed jobId, address indexed provider, uint256 amount);
    event JobCancelled(uint256 indexed jobId, address indexed client, uint256 refund);

    constructor(address usdc_) {
        usdc = IERC20(usdc_);
    }

    /// @notice Client opens a job targeting a specific provider and evaluator.
    function createJob(address provider, address evaluator, uint256 amount) external returns (uint256 jobId) {
        // TODO(M1): allocate jobId, store Open job, emit JobCreated.
        revert("TODO(M1): createJob");
    }

    /// @notice Client escrows `amount` USDC for an open job (requires prior approve).
    function fundJob(uint256 jobId) external {
        // TODO(M1): pull USDC into escrow, move Open -> Funded, emit JobFunded.
        revert("TODO(M1): fundJob");
    }

    /// @notice Provider submits the keccak256 hash of the deliverable.
    function submitDeliverable(uint256 jobId, bytes32 deliverableHash) external {
        // TODO(M1): move Funded -> Submitted, store hash, emit DeliverableSubmitted.
        revert("TODO(M1): submitDeliverable");
    }

    /// @notice Release escrow to the provider once an approval is verified.
    /// @dev Called after EvaluatorModule verifies the client's signed approval.
    function settle(uint256 jobId) external {
        // TODO(M1/M2): move Submitted -> Terminal, transfer escrow, emit JobCompleted.
        revert("TODO(M1): settle");
    }

    /// @notice Refund the client for a job that never completed.
    function cancel(uint256 jobId) external {
        // TODO(M1): guard state, refund escrow, move -> Terminal, emit JobCancelled.
        revert("TODO(M1): cancel");
    }

    function getJob(uint256 jobId) external view returns (Job memory) {
        return jobs[jobId];
    }
}
