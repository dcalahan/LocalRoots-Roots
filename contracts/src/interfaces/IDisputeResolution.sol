// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title IDisputeResolution
 * @notice Interface for the DisputeResolution contract
 * @dev Called by marketplace when disputes are raised
 */
interface IDisputeResolution {
    struct Dispute {
        uint256 orderId;
        address buyer;
        uint256 sellerId;
        string buyerReason;
        string buyerEvidenceIpfs;
        string sellerResponse;
        string sellerEvidenceIpfs;
        uint256 createdAt;
        uint256 votingEndsAt;
        uint256 votesForBuyer;
        uint256 votesForSeller;
        bool resolved;
        bool buyerWon;
        bool extended;
        bool adminResolved;
        string adminReason;
    }

    struct UserStrikes {
        uint256 sellerStrikes;
        uint256 buyerStrikes;
        uint256 lastStrikeAt;
    }

    /**
     * @notice Open a dispute for an order
     * @param orderId The order ID being disputed
     * @param buyer The buyer's address
     * @param sellerId The seller ID
     * @param reason The buyer's reason for dispute
     * @param evidenceIpfs IPFS hash for buyer's evidence
     * @return disputeId The ID of the created dispute
     */
    function openDispute(
        uint256 orderId,
        address buyer,
        uint256 sellerId,
        string calldata reason,
        string calldata evidenceIpfs
    ) external returns (uint256 disputeId);

    /**
     * @notice Submit seller's response to a dispute
     * @param disputeId The dispute ID
     * @param response The seller's response
     * @param evidenceIpfs IPFS hash for seller's evidence
     */
    function submitSellerResponse(
        uint256 disputeId,
        string calldata response,
        string calldata evidenceIpfs
    ) external;

    /**
     * @notice Ambassador votes on a dispute
     * @param disputeId The dispute ID
     * @param voteForBuyer True to vote for buyer, false for seller
     */
    function vote(uint256 disputeId, bool voteForBuyer) external;

    /**
     * @notice Resolve a dispute after voting ends
     * @param disputeId The dispute ID
     */
    function resolveDispute(uint256 disputeId) external;

    /**
     * @notice Admin resolves a dispute directly
     * @param disputeId The dispute ID
     * @param buyerWins True if buyer wins, false if seller wins
     * @param reason Reason for admin resolution
     */
    function adminResolveDispute(
        uint256 disputeId,
        bool buyerWins,
        string calldata reason
    ) external;

    /**
     * @notice Get dispute details
     * @param disputeId The dispute ID
     * @return The dispute struct
     */
    function getDispute(uint256 disputeId) external view returns (Dispute memory);

    /**
     * @notice Check if an ambassador has voted on a dispute
     * @param disputeId The dispute ID
     * @param ambassadorId The ambassador ID
     * @return True if the ambassador has voted
     */
    function hasVoted(uint256 disputeId, uint256 ambassadorId) external view returns (bool);

    /**
     * @notice Get a user's strike counts
     * @param user The user's address
     * @return The user's strikes
     */
    function getUserStrikes(address user) external view returns (UserStrikes memory);

    /**
     * @notice Get the count of qualified voters
     * @return The number of ambassadors who can vote
     */
    function getQualifiedVoterCount() external view returns (uint256);
}
