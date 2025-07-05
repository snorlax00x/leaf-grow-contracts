// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/governance/Governor.sol";
import "@openzeppelin/contracts/governance/extensions/GovernorSettings.sol";
import "@openzeppelin/contracts/governance/extensions/GovernorCountingSimple.sol";
import "@openzeppelin/contracts/governance/extensions/GovernorVotes.sol";
import "@openzeppelin/contracts/governance/extensions/GovernorVotesQuorumFraction.sol";
import "@openzeppelin/contracts/governance/extensions/GovernorTimelockControl.sol";
import "@openzeppelin/contracts/governance/TimelockController.sol";
import "./LeafToken.sol";

/**
 * @title LeafDAO
 * @dev DAO governance contract for Leaf community decision-making
 * Allows token holders to propose and vote on community projects and initiatives
 */
contract LeafDAO is 
    Governor, 
    GovernorSettings, 
    GovernorCountingSimple, 
    GovernorVotes, 
    GovernorVotesQuorumFraction, 
    GovernorTimelockControl 
{
    // Events
    event ProposalCreated(uint256 indexed proposalId, address indexed proposer, string description);
    event ProposalCancelled(uint256 indexed proposalId);

    // Structs
    struct Proposal {
        uint256 id;
        address proposer;
        string title;
        string description;
        uint256 targetAmount;
        string projectType;
        string location;
        uint256 startTime;
        uint256 endTime;
        bool executed;
        bool cancelled;
    }

    // Mappings
    mapping(uint256 => Proposal) public proposals;
    mapping(address => uint256[]) public userProposals;

    // Constants
    uint256 public constant MIN_PROPOSAL_AMOUNT = 0.1 ether;
    uint256 public constant MAX_PROPOSAL_AMOUNT = 100 ether;
    uint256 public constant PROPOSAL_DURATION = 7 days;

    constructor(
        LeafToken _token,
        TimelockController _timelock,
        uint256 _quorumPercentage
    )
        Governor("Leaf DAO")
        GovernorSettings(1, 50400, 0) // 1 block voting delay, 1 week voting period, 0 proposal threshold
        GovernorVotes(_token)
        GovernorVotesQuorumFraction(_quorumPercentage)
        GovernorTimelockControl(_timelock)
    {}

    // The following functions are overrides required by Solidity.

    function votingDelay() public view override(IGovernor, GovernorSettings) returns (uint256) {
        return super.votingDelay();
    }

    function votingPeriod() public view override(IGovernor, GovernorSettings) returns (uint256) {
        return super.votingPeriod();
    }

    function quorum(uint256 blockNumber) public view override(IGovernor, GovernorVotesQuorumFraction) returns (uint256) {
        return super.quorum(blockNumber);
    }

    function state(uint256 proposalId) public view override(Governor, GovernorTimelockControl) returns (ProposalState) {
        return super.state(proposalId);
    }

    function propose(
        address[] memory targets,
        uint256[] memory values,
        bytes[] memory calldatas,
        string memory description
    ) public override(Governor, IGovernor) returns (uint256) {
        return super.propose(targets, values, calldatas, description);
    }

    function proposalThreshold() public view override(Governor, GovernorSettings) returns (uint256) {
        return super.proposalThreshold();
    }

    function _execute(
        uint256 proposalId,
        address[] memory targets,
        uint256[] memory values,
        bytes[] memory calldatas,
        bytes32 descriptionHash
    ) internal override(Governor, GovernorTimelockControl) {
        super._execute(proposalId, targets, values, calldatas, descriptionHash);
    }

    function _cancel(
        address[] memory targets,
        uint256[] memory values,
        bytes[] memory calldatas,
        bytes32 descriptionHash
    ) internal override(Governor, GovernorTimelockControl) returns (uint256) {
        return super._cancel(targets, values, calldatas, descriptionHash);
    }

    function _executor() internal view override(Governor, GovernorTimelockControl) returns (address) {
        return super._executor();
    }

    function supportsInterface(bytes4 interfaceId) public view override(Governor, GovernorTimelockControl) returns (bool) {
        return super.supportsInterface(interfaceId);
    }

    /**
     * @dev Create a new community proposal
     * @param title Proposal title
     * @param description Proposal description
     * @param targetAmount Target funding amount
     * @param projectType Type of project
     * @param location Project location
     */
    function createCommunityProposal(
        string memory title,
        string memory description,
        uint256 targetAmount,
        string memory projectType,
        string memory location
    ) external returns (uint256) {
        require(targetAmount >= MIN_PROPOSAL_AMOUNT && targetAmount <= MAX_PROPOSAL_AMOUNT,
                "LeafDAO: invalid target amount");
        require(bytes(title).length > 0, "LeafDAO: title cannot be empty");
        require(bytes(description).length > 0, "LeafDAO: description cannot be empty");

        // Create proposal targets for project creation
        address[] memory targets = new address[](1);
        uint256[] memory values = new uint256[](1);
        bytes[] memory calldatas = new bytes[](1);

        // This would typically call the ProjectRegistry contract
        // For now, we'll create a placeholder proposal
        targets[0] = address(this);
        values[0] = 0;
        calldatas[0] = abi.encodeWithSignature("executeProposal(string,uint256,string,string)", 
                                             title, targetAmount, projectType, location);

        uint256 proposalId = propose(targets, values, calldatas, description);

        proposals[proposalId] = Proposal({
            id: proposalId,
            proposer: msg.sender,
            title: title,
            description: description,
            targetAmount: targetAmount,
            projectType: projectType,
            location: location,
            startTime: block.timestamp,
            endTime: block.timestamp + PROPOSAL_DURATION,
            executed: false,
            cancelled: false
        });

        userProposals[msg.sender].push(proposalId);

        emit ProposalCreated(proposalId, msg.sender, description);
        return proposalId;
    }

    /**
     * @dev Execute a proposal (placeholder function)
     * @param title Project title
     * @param targetAmount Target amount
     * @param projectType Project type
     * @param location Project location
     */
    function executeProposal(
        string memory title,
        uint256 targetAmount,
        string memory projectType,
        string memory location
    ) external {
        // This would typically create a project in the ProjectRegistry
        // For now, it's a placeholder
    }

    /**
     * @dev Cancel a proposal
     * @param proposalId Proposal ID to cancel
     */
    function cancelProposal(uint256 proposalId) external {
        require(proposals[proposalId].proposer == msg.sender, "LeafDAO: only proposer can cancel");
        require(!proposals[proposalId].executed, "LeafDAO: proposal already executed");
        require(!proposals[proposalId].cancelled, "LeafDAO: proposal already cancelled");

        proposals[proposalId].cancelled = true;
        emit ProposalCancelled(proposalId);
    }

    /**
     * @dev Get proposal details
     * @param proposalId Proposal ID
     */
    function getProposal(uint256 proposalId) external view returns (Proposal memory) {
        require(proposals[proposalId].proposer != address(0), "LeafDAO: proposal does not exist");
        return proposals[proposalId];
    }

    /**
     * @dev Get user proposals
     * @param user User address
     */
    function getUserProposals(address user) external view returns (uint256[] memory) {
        return userProposals[user];
    }

    /**
     * @dev Get active proposals
     */
    function getActiveProposals() external view returns (uint256[] memory) {
        uint256[] memory activeProposals = new uint256[](100); // Max 100 active proposals
        uint256 count = 0;

        for (uint256 i = 1; i <= 100; i++) {
            if (proposals[i].proposer != address(0) && 
                !proposals[i].executed && 
                !proposals[i].cancelled &&
                proposals[i].endTime > block.timestamp) {
                activeProposals[count] = i;
                count++;
            }
        }

        // Resize array to actual count
        uint256[] memory result = new uint256[](count);
        for (uint256 i = 0; i < count; i++) {
            result[i] = activeProposals[i];
        }

        return result;
    }

    /**
     * @dev Check if user can propose
     * @param user User address
     */
    function canPropose(address user) external view returns (bool) {
        return token.getPastVotes(user, block.number - 1) >= proposalThreshold();
    }
} 