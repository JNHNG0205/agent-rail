// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface IReputationRegistry {
    function recordCompletion(address agent) external;
}

/// @title JobContract — ERC-8183 job lifecycle + USDC escrow.
/// @notice Client creates a job, funds it into escrow, provider submits a
///         deliverable hash, and settlement releases (or refunds) the escrow.
///         The chain is the source of truth for job state. Member 1.
contract JobContract {
    uint256 public constant DEFAULT_TIMEOUT_BLOCKS = 100;

    /// @dev Terminal covers both Completed (paid), Cancelled (refunded), and TimeoutClaimed;
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
        uint256 timeoutBlocks;
        uint256 deadline;
    }

    IERC20 public immutable usdc;
    address public owner;
    address public evaluatorModule;
    address public reputationRegistry;

    // jobId => Job
    mapping(uint256 => Job) public jobs;
    uint256 public nextJobId;

    error ZeroAddress();
    error ZeroAmount();
    error InvalidState(uint256 jobId, JobState current, JobState expected);
    error Unauthorized(address caller);
    error TimeoutNotReached(uint256 currentBlock, uint256 deadline);

    event JobCreated(uint256 indexed jobId, address indexed client, address indexed provider, address evaluator, uint256 amount);
    event JobFunded(uint256 indexed jobId, uint256 amount);
    event DeliverableSubmitted(uint256 indexed jobId, bytes32 deliverableHash);
    event JobCompleted(uint256 indexed jobId, address indexed provider, uint256 amount);
    event JobCancelled(uint256 indexed jobId, address indexed client, uint256 refund);
    event JobTimeoutClaimed(uint256 indexed jobId, address indexed provider, uint256 amount);
    event EvaluatorModuleUpdated(address indexed newEvaluatorModule);
    event ReputationRegistryUpdated(address indexed newReputationRegistry);

    modifier onlyOwner() {
        if (msg.sender != owner) revert Unauthorized(msg.sender);
        _;
    }

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

    modifier onlyEvaluatorModule() {
        if (evaluatorModule == address(0) || msg.sender != evaluatorModule) {
            revert Unauthorized(msg.sender);
        }
        _;
    }

    constructor(address usdc_) {
        if (usdc_ == address(0)) revert ZeroAddress();
        usdc = IERC20(usdc_);
        owner = msg.sender;
    }

    /// @notice Set or update the authorized EvaluatorModule address.
    function setEvaluatorModule(address _evaluatorModule) external onlyOwner {
        if (_evaluatorModule == address(0)) revert ZeroAddress();
        evaluatorModule = _evaluatorModule;
        emit EvaluatorModuleUpdated(_evaluatorModule);
    }

    /// @notice Set or update the ReputationRegistry address.
    function setReputationRegistry(address _reputationRegistry) external onlyOwner {
        if (_reputationRegistry == address(0)) revert ZeroAddress();
        reputationRegistry = _reputationRegistry;
        emit ReputationRegistryUpdated(_reputationRegistry);
    }

    /// @notice Client opens a job targeting a specific provider and evaluator with default timeout.
    function createJob(address provider, address evaluator, uint256 amount) external returns (uint256 jobId) {
        return createJob(provider, evaluator, amount, DEFAULT_TIMEOUT_BLOCKS);
    }

    /// @notice Client opens a job with a custom timeout (in blocks).
    function createJob(address provider, address evaluator, uint256 amount, uint256 timeoutBlocks) public returns (uint256 jobId) {
        if (provider == address(0) || evaluator == address(0)) revert ZeroAddress();
        if (amount == 0) revert ZeroAmount();

        uint256 effectiveTimeout = timeoutBlocks == 0 ? DEFAULT_TIMEOUT_BLOCKS : timeoutBlocks;

        jobId = nextJobId++;
        jobs[jobId] = Job({
            client: msg.sender,
            provider: provider,
            evaluator: evaluator,
            amount: amount,
            state: JobState.Open,
            deliverableHash: bytes32(0),
            timeoutBlocks: effectiveTimeout,
            deadline: 0
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

    /// @notice Provider submits the keccak256 hash of the deliverable and starts the timeout clock.
    function submitDeliverable(uint256 jobId, bytes32 deliverableHash) external inState(jobId, JobState.Funded) onlyProvider(jobId) {
        require(deliverableHash != bytes32(0), "Invalid deliverable hash");

        Job storage job = jobs[jobId];
        job.deliverableHash = deliverableHash;
        job.deadline = block.number + job.timeoutBlocks;
        job.state = JobState.Submitted;

        emit DeliverableSubmitted(jobId, deliverableHash);
    }

    /// @notice Release escrow to the provider once an approval is verified.
    /// @dev Called exclusively by EvaluatorModule after signature verification.
    function settle(uint256 jobId) external inState(jobId, JobState.Submitted) onlyEvaluatorModule {
        Job storage job = jobs[jobId];
        job.state = JobState.Terminal;

        bool success = usdc.transfer(job.provider, job.amount);
        require(success, "USDC transfer failed");

        if (reputationRegistry != address(0)) {
            IReputationRegistry(reputationRegistry).recordCompletion(job.provider);
        }

        emit JobCompleted(jobId, job.provider, job.amount);
    }

    /// @notice Automatic fallback: Provider claims escrowed funds if evaluator fails to settle before deadline.
    function claimTimeout(uint256 jobId) external inState(jobId, JobState.Submitted) onlyProvider(jobId) {
        Job storage job = jobs[jobId];

        if (block.number <= job.deadline) {
            revert TimeoutNotReached(block.number, job.deadline);
        }

        job.state = JobState.Terminal;

        bool success = usdc.transfer(job.provider, job.amount);
        require(success, "USDC transfer failed");

        if (reputationRegistry != address(0)) {
            IReputationRegistry(reputationRegistry).recordCompletion(job.provider);
        }

        emit JobTimeoutClaimed(jobId, job.provider, job.amount);
        emit JobCompleted(jobId, job.provider, job.amount);
    }

    /// @notice Refund the client for a job that never completed or was rejected by evaluator.
    function cancel(uint256 jobId) external {
        Job storage job = jobs[jobId];
        JobState oldState = job.state;

        if (oldState != JobState.Open && oldState != JobState.Funded && oldState != JobState.Submitted) {
            revert InvalidState(jobId, oldState, JobState.Open);
        }

        if (msg.sender != job.client && msg.sender != job.evaluator && msg.sender != evaluatorModule) {
            revert Unauthorized(msg.sender);
        }

        job.state = JobState.Terminal;
        uint256 refundAmount = 0;

        if (oldState == JobState.Funded || oldState == JobState.Submitted) {
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
