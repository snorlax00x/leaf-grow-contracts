// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Counters.sol";
import "./LeafToken.sol";
import "./PlantNFT.sol";
import "./ProjectRegistry.sol";
import "./LeafDAO.sol";

/**
 * @title LeafCore
 * @dev Main contract that integrates all Leaf platform components
 * Manages donations, rewards, and coordinates between different contracts
 */
contract LeafCore is Ownable, ReentrancyGuard {
    using Counters for Counters.Counter;

    Counters.Counter private _donationIds;

    // Contract references
    LeafToken public leafToken;
    PlantNFT public plantNFT;
    ProjectRegistry public projectRegistry;
    address public leafDAO;

    // Events
    event DonationMade(
        uint256 indexed donationId,
        address indexed donor,
        uint256 indexed projectId,
        uint256 amount,
        string plantType,
        string message
    );
    event RewardsDistributed(
        address indexed user,
        uint256 leafTokens,
        uint256 nftId,
        string reason
    );
    event RecurringDonationSet(
        address indexed donor,
        uint256 indexed projectId,
        uint256 amount,
        uint256 frequency
    );
    event RecurringDonationCancelled(
        address indexed donor,
        uint256 indexed projectId
    );

    // Structs
    struct Donation {
        uint256 id;
        address donor;
        uint256 projectId;
        uint256 amount;
        string plantType;
        string message;
        uint256 timestamp;
        bool rewardsClaimed;
    }

    struct RecurringDonation {
        address donor;
        uint256 projectId;
        uint256 amount;
        uint256 frequency; // in seconds
        uint256 nextDonation;
        bool active;
    }

    struct UserStats {
        uint256 totalDonations;
        uint256 totalAmount;
        uint256 leafTokensEarned;
        uint256 nftsEarned;
        uint256 lastDonation;
    }

    // Mappings
    mapping(uint256 => Donation) public donations;
    mapping(address => uint256[]) public userDonations;
    mapping(address => RecurringDonation[]) public userRecurringDonations;
    mapping(address => UserStats) public userStats;
    mapping(address => bool) public operators;

    // Constants
    uint256 public constant MIN_DONATION = 0.001 ether;
    uint256 public constant LEAF_REWARD_RATE = 100; // 100 LEAF tokens per 0.01 ETH
    uint256 public constant NFT_THRESHOLD = 0.01 ether; // Donation threshold for NFT
    uint256 public constant MAX_RECURRING_DONATIONS = 10;

    // Platform fees
    uint256 public platformFee = 250; // 2.5% (250 basis points)
    uint256 public constant MAX_PLATFORM_FEE = 500; // 5% max

    constructor(
        address _leafToken,
        address _plantNFT,
        address _projectRegistry,
        address _leafDAO,
        address initialOwner
    ) Ownable() {
        leafToken = LeafToken(_leafToken);
        plantNFT = PlantNFT(_plantNFT);
        projectRegistry = ProjectRegistry(_projectRegistry);
        leafDAO = _leafDAO;
        operators[initialOwner] = true;
    }

    modifier onlyOperator() {
        require(operators[msg.sender] || msg.sender == owner(), "LeafCore: caller is not an operator");
        _;
    }

    modifier validDonation(uint256 amount) {
        require(amount >= MIN_DONATION, "LeafCore: donation too small");
        _;
    }

    /**
     * @dev Make a donation to a project
     * @param projectId Project ID to donate to
     * @param plantType Type of plant to donate
     * @param message Optional donation message
     */
    function donateToProject(
        uint256 projectId,
        string memory plantType,
        string memory message
    ) external payable nonReentrant validDonation(msg.value) {
        // Calculate platform fee
        uint256 feeAmount = (msg.value * platformFee) / 10000;
        uint256 donationAmount = msg.value - feeAmount;

        // Create donation record
        _donationIds.increment();
        uint256 donationId = _donationIds.current();

        donations[donationId] = Donation({
            id: donationId,
            donor: msg.sender,
            projectId: projectId,
            amount: donationAmount,
            plantType: plantType,
            message: message,
            timestamp: block.timestamp,
            rewardsClaimed: false
        });

        userDonations[msg.sender].push(donationId);

        // Update user stats
        UserStats storage stats = userStats[msg.sender];
        stats.totalDonations++;
        stats.totalAmount += donationAmount;
        stats.lastDonation = block.timestamp;

        // Donate to project
        projectRegistry.donateToProject{value: donationAmount}(projectId, message);

        // Distribute rewards
        _distributeRewards(msg.sender, donationAmount, plantType, projectId);

        emit DonationMade(donationId, msg.sender, projectId, donationAmount, plantType, message);
    }

    /**
     * @dev Set up a recurring donation
     * @param projectId Project ID to donate to
     * @param amount Amount to donate each time
     * @param frequency Frequency in seconds (e.g., 30 days = 2592000)
     * @param plantType Type of plant to donate
     */
    function setRecurringDonation(
        uint256 projectId,
        uint256 amount,
        uint256 frequency,
        string memory plantType
    ) external validDonation(amount) {
        require(frequency >= 1 days, "LeafCore: frequency too short");
        require(userRecurringDonations[msg.sender].length < MAX_RECURRING_DONATIONS,
                "LeafCore: too many recurring donations");

        RecurringDonation memory newRecurring = RecurringDonation({
            donor: msg.sender,
            projectId: projectId,
            amount: amount,
            frequency: frequency,
            nextDonation: block.timestamp + frequency,
            active: true
        });

        userRecurringDonations[msg.sender].push(newRecurring);

        emit RecurringDonationSet(msg.sender, projectId, amount, frequency);
    }

    /**
     * @dev Cancel a recurring donation
     * @param index Index of the recurring donation to cancel
     */
    function cancelRecurringDonation(uint256 index) external {
        require(index < userRecurringDonations[msg.sender].length,
                "LeafCore: invalid recurring donation index");

        userRecurringDonations[msg.sender][index].active = false;

        emit RecurringDonationCancelled(msg.sender, userRecurringDonations[msg.sender][index].projectId);
    }

    /**
     * @dev Process recurring donations (called by operators)
     * @param users Array of users to process
     */
    function processRecurringDonations(address[] memory users) external onlyOperator {
        for (uint256 i = 0; i < users.length; i++) {
            address user = users[i];
            RecurringDonation[] storage recurring = userRecurringDonations[user];

            for (uint256 j = 0; j < recurring.length; j++) {
                if (recurring[j].active && block.timestamp >= recurring[j].nextDonation) {
                    // Process the donation
                    uint256 feeAmount = (recurring[j].amount * platformFee) / 10000;
                    uint256 donationAmount = recurring[j].amount - feeAmount;

                    // Update next donation time
                    recurring[j].nextDonation = block.timestamp + recurring[j].frequency;

                    // Create donation record
                    _donationIds.increment();
                    uint256 donationId = _donationIds.current();

                    donations[donationId] = Donation({
                        id: donationId,
                        donor: user,
                        projectId: recurring[j].projectId,
                        amount: donationAmount,
                        plantType: "Recurring",
                        message: "Recurring donation",
                        timestamp: block.timestamp,
                        rewardsClaimed: false
                    });

                    userDonations[user].push(donationId);

                    // Update user stats
                    UserStats storage stats = userStats[user];
                    stats.totalDonations++;
                    stats.totalAmount += donationAmount;
                    stats.lastDonation = block.timestamp;

                    // Donate to project
                    projectRegistry.donateToProject{value: donationAmount}(recurring[j].projectId, "Recurring donation");

                    // Distribute rewards
                    _distributeRewards(user, donationAmount, "Recurring", recurring[j].projectId);

                    emit DonationMade(donationId, user, recurring[j].projectId, donationAmount, "Recurring", "Recurring donation");
                }
            }
        }
    }

    /**
     * @dev Distribute rewards to a user
     * @param user User address
     * @param amount Donation amount
     * @param plantType Type of plant
     * @param projectId Project ID
     */
    function _distributeRewards(
        address user,
        uint256 amount,
        string memory plantType,
        uint256 projectId
    ) internal {
        // Calculate LEAF token rewards
        uint256 leafRewards = (amount * LEAF_REWARD_RATE) / 0.01 ether;
        
        if (leafRewards > 0) {
            leafToken.mint(user, leafRewards, "donation_reward");
            userStats[user].leafTokensEarned += leafRewards;
        }

        // Mint NFT if threshold is met
        if (amount >= NFT_THRESHOLD) {
            string memory tokenURI = _generateNFTURI(plantType, amount, projectId);
            uint256 nftId = plantNFT.mintPlantNFT(user, plantType, amount, "Global", tokenURI);
            userStats[user].nftsEarned++;

            emit RewardsDistributed(user, leafRewards, nftId, "donation_nft");
        } else {
            emit RewardsDistributed(user, leafRewards, 0, "donation_reward");
        }
    }

    /**
     * @dev Generate NFT metadata URI
     * @param plantType Type of plant
     * @param amount Donation amount
     * @param projectId Project ID
     */
    function _generateNFTURI(
        string memory plantType,
        uint256 amount,
        uint256 projectId
    ) internal pure returns (string memory) {
        // This would typically generate a proper metadata URI
        // For now, return a placeholder
        return string(abi.encodePacked(
            "https://leaf.morphl2.io/api/nft/",
            _uint2str(projectId),
            "/",
            plantType,
            "/",
            _uint2str(amount)
        ));
    }

    /**
     * @dev Convert uint to string
     * @param _i Number to convert
     */
    function _uint2str(uint256 _i) internal pure returns (string memory) {
        if (_i == 0) {
            return "0";
        }
        uint256 j = _i;
        uint256 length;
        while (j != 0) {
            length++;
            j /= 10;
        }
        bytes memory bstr = new bytes(length);
        uint256 k = length;
        while (_i != 0) {
            k -= 1;
            uint8 temp = (48 + uint8(_i - _i / 10 * 10));
            bytes1 b1 = bytes1(temp);
            bstr[k] = b1;
            _i /= 10;
        }
        return string(bstr);
    }

    /**
     * @dev Get user donation history
     * @param user User address
     */
    function getUserDonations(address user) external view returns (uint256[] memory) {
        return userDonations[user];
    }

    /**
     * @dev Get user recurring donations
     * @param user User address
     */
    function getUserRecurringDonations(address user) external view returns (RecurringDonation[] memory) {
        return userRecurringDonations[user];
    }

    /**
     * @dev Get user stats
     * @param user User address
     */
    function getUserStats(address user) external view returns (UserStats memory) {
        return userStats[user];
    }

    /**
     * @dev Get donation details
     * @param donationId Donation ID
     */
    function getDonation(uint256 donationId) external view returns (Donation memory) {
        require(donations[donationId].donor != address(0), "LeafCore: donation does not exist");
        return donations[donationId];
    }

    /**
     * @dev Set platform fee
     * @param newFee New fee in basis points (100 = 1%)
     */
    function setPlatformFee(uint256 newFee) external onlyOwner {
        require(newFee <= MAX_PLATFORM_FEE, "LeafCore: fee too high");
        platformFee = newFee;
    }

    /**
     * @dev Add operator
     * @param operator Address to add as operator
     */
    function addOperator(address operator) external onlyOwner {
        operators[operator] = true;
    }

    /**
     * @dev Remove operator
     * @param operator Address to remove as operator
     */
    function removeOperator(address operator) external onlyOwner {
        operators[operator] = false;
    }

    /**
     * @dev Withdraw platform fees
     * @param amount Amount to withdraw
     */
    function withdrawFees(uint256 amount) external onlyOwner {
        require(amount <= address(this).balance, "LeafCore: insufficient balance");
        payable(owner()).transfer(amount);
    }

    /**
     * @dev Get total donations
     */
    function totalDonations() external view returns (uint256) {
        return _donationIds.current();
    }

    /**
     * @dev Emergency pause (only owner)
     */
    function emergencyPause() external onlyOwner {
        // This would pause all critical functions
        // Implementation depends on specific requirements
    }
} 