// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Counters.sol";

/**
 * @title ProjectRegistry
 * @dev Registry for environmental restoration projects
 * Manages project creation, funding, and milestone tracking
 */
contract ProjectRegistry is Ownable {
    using Counters for Counters.Counter;

    Counters.Counter private _projectIds;

    // Events
    event ProjectCreated(uint256 indexed projectId, address indexed creator, string name, uint256 targetAmount);
    event ProjectFunded(uint256 indexed projectId, address indexed donor, uint256 amount);
    event MilestoneCompleted(uint256 indexed projectId, uint256 milestoneId, uint256 amountReleased);
    event ProjectCompleted(uint256 indexed projectId);
    event ProjectCancelled(uint256 indexed projectId);

    // Structs
    struct Project {
        uint256 id;
        address creator;
        string name;
        string description;
        string location;
        string projectType; // "tree_planting", "solar_development", "conservation", etc.
        uint256 targetAmount;
        uint256 currentAmount;
        uint256 startDate;
        uint256 endDate;
        ProjectStatus status;
        bool isVerified;
        string imageURI;
    }

    struct Milestone {
        uint256 id;
        string description;
        uint256 targetAmount;
        uint256 releasedAmount;
        bool isCompleted;
        uint256 completionDate;
    }

    struct Donation {
        address donor;
        uint256 amount;
        uint256 timestamp;
        string message;
    }

    enum ProjectStatus { Active, Completed, Cancelled, Paused }

    // Mappings
    mapping(uint256 => Project) public projects;
    mapping(uint256 => Milestone[]) public projectMilestones;
    mapping(uint256 => Donation[]) public projectDonations;
    mapping(address => uint256[]) public userDonations;
    mapping(address => bool) public verifiers;
    mapping(string => bool) public validProjectTypes;

    // Constants
    uint256 public constant MIN_PROJECT_AMOUNT = 0.01 ether;
    uint256 public constant MAX_PROJECT_AMOUNT = 1000 ether;
    uint256 public constant VERIFIER_THRESHOLD = 3; // Number of verifiers needed to approve

    constructor(address initialOwner) Ownable() {
        verifiers[initialOwner] = true;
        
        // Initialize valid project types
        validProjectTypes["tree_planting"] = true;
        validProjectTypes["solar_development"] = true;
        validProjectTypes["conservation"] = true;
        validProjectTypes["water_restoration"] = true;
        validProjectTypes["wildlife_protection"] = true;
        validProjectTypes["agricultural_tools"] = true;
    }

    modifier onlyVerifier() {
        require(verifiers[msg.sender] || msg.sender == owner(), "ProjectRegistry: caller is not a verifier");
        _;
    }

    modifier validProjectType(string memory projectType) {
        require(validProjectTypes[projectType], "ProjectRegistry: invalid project type");
        _;
    }

    modifier projectExists(uint256 projectId) {
        require(projects[projectId].creator != address(0), "ProjectRegistry: project does not exist");
        _;
    }

    modifier projectActive(uint256 projectId) {
        require(projects[projectId].status == ProjectStatus.Active, "ProjectRegistry: project is not active");
        _;
    }

    /**
     * @dev Create a new environmental project
     * @param name Project name
     * @param description Project description
     * @param location Project location
     * @param projectType Type of project
     * @param targetAmount Target funding amount in wei
     * @param endDate Project end date
     * @param imageURI Project image URI
     */
    function createProject(
        string memory name,
        string memory description,
        string memory location,
        string memory projectType,
        uint256 targetAmount,
        uint256 endDate,
        string memory imageURI
    ) external validProjectType(projectType) returns (uint256) {
        require(targetAmount >= MIN_PROJECT_AMOUNT && targetAmount <= MAX_PROJECT_AMOUNT, 
                "ProjectRegistry: invalid target amount");
        require(endDate > block.timestamp, "ProjectRegistry: end date must be in the future");

        _projectIds.increment();
        uint256 newProjectId = _projectIds.current();

        projects[newProjectId] = Project({
            id: newProjectId,
            creator: msg.sender,
            name: name,
            description: description,
            location: location,
            projectType: projectType,
            targetAmount: targetAmount,
            currentAmount: 0,
            startDate: block.timestamp,
            endDate: endDate,
            status: ProjectStatus.Active,
            isVerified: false,
            imageURI: imageURI
        });

        emit ProjectCreated(newProjectId, msg.sender, name, targetAmount);
        return newProjectId;
    }

    /**
     * @dev Donate to a project
     * @param projectId Project ID to donate to
     * @param message Optional donation message
     */
    function donateToProject(uint256 projectId, string memory message) 
        external 
        payable 
        projectExists(projectId) 
        projectActive(projectId) 
    {
        require(msg.value > 0, "ProjectRegistry: donation amount must be greater than 0");
        require(projects[projectId].currentAmount + msg.value <= projects[projectId].targetAmount,
                "ProjectRegistry: would exceed target amount");

        projects[projectId].currentAmount += msg.value;

        Donation memory newDonation = Donation({
            donor: msg.sender,
            amount: msg.value,
            timestamp: block.timestamp,
            message: message
        });

        projectDonations[projectId].push(newDonation);
        userDonations[msg.sender].push(projectId);

        emit ProjectFunded(projectId, msg.sender, msg.value);
    }

    /**
     * @dev Add milestone to a project
     * @param projectId Project ID
     * @param description Milestone description
     * @param targetAmount Amount to release for this milestone
     */
    function addMilestone(
        uint256 projectId,
        string memory description,
        uint256 targetAmount
    ) external projectExists(projectId) {
        require(msg.sender == projects[projectId].creator || verifiers[msg.sender], 
                "ProjectRegistry: only creator or verifier can add milestones");
        require(targetAmount <= projects[projectId].targetAmount, 
                "ProjectRegistry: milestone amount exceeds project target");

        Milestone memory newMilestone = Milestone({
            id: projectMilestones[projectId].length,
            description: description,
            targetAmount: targetAmount,
            releasedAmount: 0,
            isCompleted: false,
            completionDate: 0
        });

        projectMilestones[projectId].push(newMilestone);
    }

    /**
     * @dev Complete a milestone and release funds
     * @param projectId Project ID
     * @param milestoneId Milestone ID
     */
    function completeMilestone(uint256 projectId, uint256 milestoneId) 
        external 
        onlyVerifier 
        projectExists(projectId) 
    {
        require(milestoneId < projectMilestones[projectId].length, 
                "ProjectRegistry: milestone does not exist");
        
        Milestone storage milestone = projectMilestones[projectId][milestoneId];
        require(!milestone.isCompleted, "ProjectRegistry: milestone already completed");

        milestone.isCompleted = true;
        milestone.completionDate = block.timestamp;
        milestone.releasedAmount = milestone.targetAmount;

        // Transfer funds to project creator
        payable(projects[projectId].creator).transfer(milestone.targetAmount);

        emit MilestoneCompleted(projectId, milestoneId, milestone.targetAmount);
    }

    /**
     * @dev Verify a project
     * @param projectId Project ID to verify
     */
    function verifyProject(uint256 projectId) external onlyVerifier projectExists(projectId) {
        projects[projectId].isVerified = true;
    }

    /**
     * @dev Complete a project
     * @param projectId Project ID to complete
     */
    function completeProject(uint256 projectId) external onlyVerifier projectExists(projectId) {
        require(projects[projectId].currentAmount >= projects[projectId].targetAmount,
                "ProjectRegistry: project target not reached");
        
        projects[projectId].status = ProjectStatus.Completed;
        emit ProjectCompleted(projectId);
    }

    /**
     * @dev Cancel a project
     * @param projectId Project ID to cancel
     */
    function cancelProject(uint256 projectId) external projectExists(projectId) {
        require(msg.sender == projects[projectId].creator || verifiers[msg.sender],
                "ProjectRegistry: only creator or verifier can cancel project");
        
        projects[projectId].status = ProjectStatus.Cancelled;
        emit ProjectCancelled(projectId);
    }

    /**
     * @dev Add a verifier
     * @param verifier Address to add as verifier
     */
    function addVerifier(address verifier) external onlyOwner {
        verifiers[verifier] = true;
    }

    /**
     * @dev Remove a verifier
     * @param verifier Address to remove as verifier
     */
    function removeVerifier(address verifier) external onlyOwner {
        verifiers[verifier] = false;
    }

    /**
     * @dev Add a valid project type
     * @param projectType Project type to add
     */
    function addValidProjectType(string memory projectType) external onlyOwner {
        validProjectTypes[projectType] = true;
    }

    /**
     * @dev Get project details
     * @param projectId Project ID
     */
    function getProject(uint256 projectId) external view returns (Project memory) {
        require(projects[projectId].creator != address(0), "ProjectRegistry: project does not exist");
        return projects[projectId];
    }

    /**
     * @dev Get project milestones
     * @param projectId Project ID
     */
    function getProjectMilestones(uint256 projectId) external view returns (Milestone[] memory) {
        return projectMilestones[projectId];
    }

    /**
     * @dev Get project donations
     * @param projectId Project ID
     */
    function getProjectDonations(uint256 projectId) external view returns (Donation[] memory) {
        return projectDonations[projectId];
    }

    /**
     * @dev Get user donations
     * @param user User address
     */
    function getUserDonations(address user) external view returns (uint256[] memory) {
        return userDonations[user];
    }

    /**
     * @dev Get total number of projects
     */
    function totalProjects() external view returns (uint256) {
        return _projectIds.current();
    }

    /**
     * @dev Get projects by type
     * @param projectType Project type to filter by
     */
    function getProjectsByType(string memory projectType) external view returns (uint256[] memory) {
        uint256[] memory projectIds = new uint256[](_projectIds.current());
        uint256 count = 0;
        
        for (uint256 i = 1; i <= _projectIds.current(); i++) {
            if (keccak256(bytes(projects[i].projectType)) == keccak256(bytes(projectType))) {
                projectIds[count] = i;
                count++;
            }
        }
        
        // Resize array to actual count
        uint256[] memory result = new uint256[](count);
        for (uint256 i = 0; i < count; i++) {
            result[i] = projectIds[i];
        }
        
        return result;
    }
} 