// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {MessageHashUtils} from "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";
import {IJobContract} from "./interfaces/IJobContract.sol";

/// @title EvaluatorModule — Off-chain signature verification module for job evaluation.
/// @notice Verifies an EIP-191 signed approval/rejection from an evaluator agent and forwards to JobContract.
contract EvaluatorModule {
    using ECDSA for bytes32;

    IJobContract public immutable jobContract;

    /// @notice Custom error thrown when the contract address is zero.
    error ZeroAddress();

    /// @notice Custom error thrown when the recovered signer does not match the job's evaluator.
    /// @param recovered The address recovered from the signature.
    /// @param expected The expected evaluator address from the job struct.
    error NotAuthorizedEvaluator(address recovered, address expected);

    /// @notice Custom error thrown when the deliverable hash being approved does not match the on-chain submission.
    /// @param provided The deliverable hash provided in the submission.
    /// @param expected The deliverable hash recorded on JobContract.
    error DeliverableMismatch(bytes32 provided, bytes32 expected);

    /// @notice Emitted after an approval or rejection signature has been processed.
    /// @param jobId The ID of the job evaluated.
    /// @param signer The address of the evaluator who signed the decision.
    /// @param approved True if approved (settled), false if rejected (cancelled).
    event ApprovalProcessed(uint256 indexed jobId, address indexed signer, bool approved);

    /// @notice Initializes the EvaluatorModule with the JobContract address.
    /// @param _jobContract The deployed JobContract address.
    constructor(address _jobContract) {
        if (_jobContract == address(0)) revert ZeroAddress();
        jobContract = IJobContract(_jobContract);
    }

    /// @notice Verifies an evaluator's signature over a job decision and triggers settlement or cancellation.
    /// @param jobId The job ID to evaluate.
    /// @param deliverableHash The keccak256 hash of the deliverable being evaluated.
    /// @param approved True to approve and settle, false to reject and cancel.
    /// @param signature The EIP-191 ECDSA signature from the evaluator agent.
    function submitApproval(
        uint256 jobId,
        bytes32 deliverableHash,
        bool approved,
        bytes calldata signature
    ) external {
        IJobContract.Job memory job = jobContract.getJob(jobId);

        if (deliverableHash != job.deliverableHash) {
            revert DeliverableMismatch(deliverableHash, job.deliverableHash);
        }

        bytes32 messageHash = keccak256(abi.encodePacked(jobId, deliverableHash, approved));
        bytes32 ethSignedMessageHash = MessageHashUtils.toEthSignedMessageHash(messageHash);
        address signer = ECDSA.recover(ethSignedMessageHash, signature);

        if (signer != job.evaluator) {
            revert NotAuthorizedEvaluator(signer, job.evaluator);
        }

        if (approved) {
            jobContract.settle(jobId);
        } else {
            jobContract.cancel(jobId);
        }

        emit ApprovalProcessed(jobId, signer, approved);
    }
}
