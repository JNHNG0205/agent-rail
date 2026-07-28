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

    error ZeroAddress();
    error ZeroAmount();
    error InvalidState(uint256 jobId, JobState current, JobState expected);
    error Unauthorized(address caller);

    event JobCreated(uint256 indexed jobId, address indexed client, address indexed provider, address evaluator, uint256 amount);
    event JobFunded(uint256 indexed jobId, uint256 amount);
    event DeliverableSubmitted(uint256 indexed jobId, bytes32 deliverableHash);
    event JobCompleted(uint256 indexed jobId, address indexed provider, uint256 amount);
    event JobCancelled(uint256 indexed jobId, address indexed client, uint256 refund);

    modifier inState(uint256 jobId, JobState expectedState) {
        if (jobs[jobId].state != expectedState) {
            revert InvalidState(jobId, jobs[jobId].state, expectedState);
        }
        _;
    }

    modifier onlyClient(uint256 jobId) {
        if (msg.sender != jobs[jobId].client) {
            revert Unauthorized(msg.sender);
        }
        _;
    }

    modifier onlyProvider(uint256 jobId) {
        if (msg.sender != jobs[jobId].provider) {
            revert Unauthorized(msg.sender);
        }
        _;
    }

    modifier onlyEvaluator(uint256 jobId) {
        if (msg.sender != jobs[jobId].evaluator) {
            revert Unauthorized(msg.sender);
        }
        _;
    }

    constructor(address usdc_) {
        if (usdc_ == address(0)) revert ZeroAddress();
        usdc = IERC20(usdc_);
    }

    /// @notice Client opens a job targeting a specific provider and evaluator.
    function createJob(address provider, address evaluator, uint256 amount) external returns (uint256 jobId) {
        if (provider == address(0) || evaluator == address(0)) revert ZeroAddress();
        if (amount == 0) revert ZeroAmount();

        jobId = nextJobId++;
        jobs[jobId] = Job({
            client: msg.sender,
            provider: provider,
            evaluator: evaluator,
            amount: amount,
            state: JobState.Open,
            deliverableHash: bytes32(0)
        });

        emit JobCreated(jobId, msg.sender, provider, evaluator, amount);
    }

    /// @notice Client escrows `amount` USDC for an open job (requires prior approve).
    function fundJob(uint256 jobId) external inState(jobId, JobState.Open) onlyClient(jobId) {
        Job storage job = jobs[jobId];
        job.state = JobState.Funded;

        bool success = usdc.transferFrom(msg.sender, address(this), job.amount);
        require(success, "USDC transfer failed");

        emit JobFunded(jobId, job.amount);
    }

    /// @notice Provider submits the keccak256 hash of the deliverable.
    function submitDeliverable(uint256 jobId, bytes32 deliverableHash) external inState(jobId, JobState.Funded) onlyProvider(jobId) {
        require(deliverableHash != bytes32(0), "Invalid deliverable hash");

        Job storage job = jobs[jobId];
        job.deliverableHash = deliverableHash;
        job.state = JobState.Submitted;

        emit DeliverableSubmitted(jobId, deliverableHash);
    }

    /// @notice Release escrow to the provider once an approval is verified.
    /// @dev Called after EvaluatorModule verifies the client's signed approval.
    function settle(uint256 jobId) external inState(jobId, JobState.Submitted) onlyEvaluator(jobId) {
        Job storage job = jobs[jobId];
        job.state = JobState.Terminal;

        bool success = usdc.transfer(job.provider, job.amount);
        require(success, "USDC transfer failed");

        emit JobCompleted(jobId, job.provider, job.amount);
    }

    /// @notice Refund the client for a job that never completed.
    function cancel(uint256 jobId) external {
        Job storage job = jobs[jobId];
        JobState oldState = job.state;

        if (oldState != JobState.Open && oldState != JobState.Funded) {
            revert InvalidState(jobId, oldState, JobState.Open);
        }

        if (msg.sender != job.client && msg.sender != job.evaluator) {
            revert Unauthorized(msg.sender);
        }

        job.state = JobState.Terminal;
        uint256 refundAmount = 0;

        if (oldState == JobState.Funded) {
            refundAmount = job.amount;
            bool success = usdc.transfer(job.client, refundAmount);
            require(success, "USDC transfer failed");
        }

        emit JobCancelled(jobId, job.client, refundAmount);
    }

    function getJob(uint256 jobId) external view returns (Job memory) {
        return jobs[jobId];
    }
}
