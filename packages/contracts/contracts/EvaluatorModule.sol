// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title EvaluatorModule — ERC-7579 module that verifies a client's signed
///        approval before settlement is allowed. Member 2.
/// @notice The client signs an approval over (jobId, deliverableHash). This
///         module recovers the signer via ECDSA and, if valid, triggers
///         settlement on the JobContract.
contract EvaluatorModule {
    address public immutable jobContract;

    event ApprovalVerified(uint256 indexed jobId, address indexed signer);

    constructor(address jobContract_) {
        jobContract = jobContract_;
    }

    /// @notice Verify an approval signature and settle the job on success.
    /// @param jobId            the job being approved
    /// @param deliverableHash  hash the client is approving
    /// @param signature        client's ECDSA signature over the approval digest
    function approveAndSettle(uint256 jobId, bytes32 deliverableHash, bytes calldata signature) external {
        // TODO(M2): build the EIP-191/EIP-712 digest, ECDSA-recover the signer,
        //           require signer == job.client, then call JobContract.settle.
        revert("TODO(M2): approveAndSettle");
    }

    /// @notice Pure signature check exposed for the frontend / tests.
    function verifyApproval(uint256 jobId, bytes32 deliverableHash, bytes calldata signature)
        external
        pure
        returns (address signer)
    {
        // TODO(M2): recover and return the signer without side effects.
        revert("TODO(M2): verifyApproval");
    }
}
