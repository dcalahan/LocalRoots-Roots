// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";

/**
 * @title SeedsAirdrop
 * @notice Merkle-based airdrop contract for distributing ROOTS tokens to Phase 1 Seeds earners
 * @dev At Phase 2 launch:
 *      1. Snapshot all Seeds balances from TheGraph subgraph
 *      2. Calculate ROOTS per Seed ratio: 100M ROOTS / totalSeeds
 *      3. Generate Merkle tree of (address, rootsAmount) pairs
 *      4. Deploy this contract and fund with 100M ROOTS
 *      5. Set Merkle root and open claims
 *
 *      Claim window: 365 days (1 year) per Doug's feedback
 *      Unclaimed tokens return to treasury after deadline
 */
contract SeedsAirdrop {
    using SafeERC20 for IERC20;

    // ============ State Variables ============

    IERC20 public immutable rootsToken;
    bytes32 public merkleRoot;
    address public admin;
    uint256 public claimDeadline;

    mapping(address => bool) public hasClaimed;

    // ============ Events ============

    event Claimed(address indexed user, uint256 amount);
    event MerkleRootSet(bytes32 root);
    event AdminTransferred(address indexed previousAdmin, address indexed newAdmin);
    event UnclaimedRecovered(address indexed to, uint256 amount);

    // ============ Constructor ============

    /**
     * @notice Deploy SeedsAirdrop contract
     * @param _rootsToken The ROOTS token contract address
     * @param _admin Admin address who can set Merkle root and recover unclaimed
     * @param _claimPeriodDays Number of days users have to claim (365 recommended)
     */
    constructor(address _rootsToken, address _admin, uint256 _claimPeriodDays) {
        require(_rootsToken != address(0), "Invalid token address");
        require(_admin != address(0), "Invalid admin address");
        require(_claimPeriodDays > 0, "Claim period must be > 0");

        rootsToken = IERC20(_rootsToken);
        admin = _admin;
        claimDeadline = block.timestamp + (_claimPeriodDays * 1 days);
    }

    // ============ Modifiers ============

    modifier onlyAdmin() {
        require(msg.sender == admin, "Not admin");
        _;
    }

    // ============ Claim Functions ============

    /**
     * @notice Claim ROOTS tokens based on Seeds earned during Phase 1
     * @param _amount Amount of ROOTS to claim (calculated off-chain from Seeds)
     * @param _proof Merkle proof verifying the claim
     */
    function claim(uint256 _amount, bytes32[] calldata _proof) external {
        require(!hasClaimed[msg.sender], "Already claimed");
        require(block.timestamp < claimDeadline, "Claim period ended");
        require(merkleRoot != bytes32(0), "Merkle root not set");
        require(_amount > 0, "Amount must be > 0");

        // Verify Merkle proof
        bytes32 leaf = keccak256(abi.encodePacked(msg.sender, _amount));
        require(MerkleProof.verify(_proof, merkleRoot, leaf), "Invalid proof");

        // Mark as claimed and transfer tokens
        hasClaimed[msg.sender] = true;
        rootsToken.safeTransfer(msg.sender, _amount);

        emit Claimed(msg.sender, _amount);
    }

    /**
     * @notice Check if an address can claim and verify their proof
     * @param _user Address to check
     * @param _amount Expected claim amount
     * @param _proof Merkle proof
     * @return canClaim Whether the claim is valid and not yet claimed
     */
    function canClaim(address _user, uint256 _amount, bytes32[] calldata _proof) external view returns (bool) {
        if (hasClaimed[_user]) return false;
        if (block.timestamp >= claimDeadline) return false;
        if (merkleRoot == bytes32(0)) return false;

        bytes32 leaf = keccak256(abi.encodePacked(_user, _amount));
        return MerkleProof.verify(_proof, merkleRoot, leaf);
    }

    // ============ Admin Functions ============

    /**
     * @notice Set the Merkle root for claims
     * @dev Should be set after generating the Merkle tree from Seeds snapshot
     * @param _root The Merkle root hash
     */
    function setMerkleRoot(bytes32 _root) external onlyAdmin {
        require(_root != bytes32(0), "Invalid root");
        merkleRoot = _root;
        emit MerkleRootSet(_root);
    }

    /**
     * @notice Transfer admin role to a new address
     * @param _newAdmin New admin address
     */
    function transferAdmin(address _newAdmin) external onlyAdmin {
        require(_newAdmin != address(0), "Invalid admin address");
        address oldAdmin = admin;
        admin = _newAdmin;
        emit AdminTransferred(oldAdmin, _newAdmin);
    }

    /**
     * @notice Recover unclaimed tokens after deadline
     * @dev Returns remaining ROOTS to admin (treasury) after 365-day claim window
     */
    function recoverUnclaimed() external onlyAdmin {
        require(block.timestamp >= claimDeadline, "Claim period not ended");

        uint256 balance = rootsToken.balanceOf(address(this));
        require(balance > 0, "No tokens to recover");

        rootsToken.safeTransfer(admin, balance);

        emit UnclaimedRecovered(admin, balance);
    }

    // ============ View Functions ============

    /**
     * @notice Get time remaining until claim deadline
     * @return seconds Seconds until deadline (0 if passed)
     */
    function timeUntilDeadline() external view returns (uint256) {
        if (block.timestamp >= claimDeadline) return 0;
        return claimDeadline - block.timestamp;
    }

    /**
     * @notice Check if claim period has ended
     * @return ended Whether the claim period has ended
     */
    function claimPeriodEnded() external view returns (bool) {
        return block.timestamp >= claimDeadline;
    }

    /**
     * @notice Get the contract's ROOTS balance available for claims
     * @return balance ROOTS balance
     */
    function availableBalance() external view returns (uint256) {
        return rootsToken.balanceOf(address(this));
    }
}
