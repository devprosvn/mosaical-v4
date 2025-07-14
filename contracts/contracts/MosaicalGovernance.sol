
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.21;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
contract MosaicalGovernance is Ownable, ReentrancyGuard {
    
    IERC20 public governanceToken;
    
    struct Proposal {
        uint256 id;
        address proposer;
        string title;
        string description;
        uint256 startTime;
        uint256 endTime;
        uint256 forVotes;
        uint256 againstVotes;
        uint256 abstainVotes;
        bool executed;
        bool cancelled;
        ProposalType proposalType;
        bytes proposalData;
    }
    
    enum ProposalType {
        PARAMETER_CHANGE,
        COLLECTION_ADDITION,
        ORACLE_UPDATE,
        EMERGENCY_ACTION,
        TREASURY_ACTION
    }
    
    enum VoteChoice {
        AGAINST,
        FOR,
        ABSTAIN
    }
    
    struct Vote {
        bool hasVoted;
        VoteChoice choice;
        uint256 weight;
    }
    
    // State variables
    mapping(uint256 => Proposal) public proposals;
    mapping(uint256 => mapping(address => Vote)) public votes;
    mapping(address => uint256) public delegatedVotes;
    mapping(address => address) public delegates;
    
    uint256 public proposalCount;
    uint256 public constant VOTING_DURATION = 3 days;
    uint256 public constant MIN_PROPOSAL_THRESHOLD = 100000 * 10**18; // 100k tokens
    uint256 public constant QUORUM_PERCENTAGE = 10; // 10%
    uint256 public constant APPROVAL_THRESHOLD = 51; // 51%
    
    // Events
    event ProposalCreated(
        uint256 indexed proposalId,
        address indexed proposer,
        string title,
        uint256 startTime,
        uint256 endTime
    );
    event VoteCast(
        uint256 indexed proposalId,
        address indexed voter,
        VoteChoice choice,
        uint256 weight
    );
    event ProposalExecuted(uint256 indexed proposalId);
    event ProposalCancelled(uint256 indexed proposalId);
    event DelegateChanged(address indexed delegator, address indexed newDelegate);
    
    constructor(address _governanceToken) Ownable(msg.sender) {
        governanceToken = IERC20(_governanceToken);
    }
    
    // Delegation functions
    function delegate(address delegatee) external {
        address currentDelegate = delegates[msg.sender];
        uint256 delegatorBalance = governanceToken.balanceOf(msg.sender);
        
        // Remove votes from current delegate
        if (currentDelegate != address(0)) {
            delegatedVotes[currentDelegate] = delegatedVotes[currentDelegate] - delegatorBalance;
        }
        
        // Add votes to new delegate
        delegates[msg.sender] = delegatee;
        if (delegatee != address(0)) {
            delegatedVotes[delegatee] = delegatedVotes[delegatee] + delegatorBalance;
        }
        
        emit DelegateChanged(msg.sender, delegatee);
    }
    
    function getVotingPower(address account) public view returns (uint256) {
        return governanceToken.balanceOf(account) + delegatedVotes[account];
    }
    
    // Proposal functions
    function createProposal(
        string memory title,
        string memory description,
        ProposalType proposalType,
        bytes memory proposalData
    ) external returns (uint256) {
        require(getVotingPower(msg.sender) >= MIN_PROPOSAL_THRESHOLD, "Insufficient voting power");
        require(bytes(title).length > 0, "Empty title");
        require(bytes(description).length > 0, "Empty description");
        
        proposalCount++;
        uint256 proposalId = proposalCount;
        
        proposals[proposalId] = Proposal({
            id: proposalId,
            proposer: msg.sender,
            title: title,
            description: description,
            startTime: block.timestamp,
            endTime: block.timestamp + VOTING_DURATION,
            forVotes: 0,
            againstVotes: 0,
            abstainVotes: 0,
            executed: false,
            cancelled: false,
            proposalType: proposalType,
            proposalData: proposalData
        });
        
        emit ProposalCreated(
            proposalId,
            msg.sender,
            title,
            block.timestamp,
            block.timestamp + VOTING_DURATION
        );
        
        return proposalId;
    }
    
    function vote(uint256 proposalId, VoteChoice choice) external nonReentrant {
        Proposal storage proposal = proposals[proposalId];
        require(proposal.id != 0, "Proposal does not exist");
        require(block.timestamp >= proposal.startTime, "Voting not started");
        require(block.timestamp <= proposal.endTime, "Voting ended");
        require(!proposal.executed, "Proposal already executed");
        require(!proposal.cancelled, "Proposal cancelled");
        
        Vote storage userVote = votes[proposalId][msg.sender];
        require(!userVote.hasVoted, "Already voted");
        
        uint256 weight = getVotingPower(msg.sender);
        require(weight > 0, "No voting power");
        
        userVote.hasVoted = true;
        userVote.choice = choice;
        userVote.weight = weight;
        
        if (choice == VoteChoice.FOR) {
            proposal.forVotes = proposal.forVotes + weight;
        } else if (choice == VoteChoice.AGAINST) {
            proposal.againstVotes = proposal.againstVotes + weight;
        } else {
            proposal.abstainVotes = proposal.abstainVotes + weight;
        }
        
        emit VoteCast(proposalId, msg.sender, choice, weight);
    }
    
    function executeProposal(uint256 proposalId) external nonReentrant {
        Proposal storage proposal = proposals[proposalId];
        require(proposal.id != 0, "Proposal does not exist");
        require(block.timestamp > proposal.endTime, "Voting still active");
        require(!proposal.executed, "Already executed");
        require(!proposal.cancelled, "Proposal cancelled");
        
        // Check quorum
        uint256 totalVotes = proposal.forVotes + proposal.againstVotes + proposal.abstainVotes;
        uint256 totalSupply = governanceToken.totalSupply();
        uint256 quorumRequired = totalSupply * QUORUM_PERCENTAGE / 100;
        require(totalVotes >= quorumRequired, "Quorum not reached");
        
        // Check approval
        uint256 approvalVotes = proposal.forVotes;
        uint256 totalVotesForApproval = proposal.forVotes + proposal.againstVotes;
        require(
            approvalVotes * 100 / totalVotesForApproval >= APPROVAL_THRESHOLD,
            "Proposal not approved"
        );
        
        proposal.executed = true;
        
        // Execute proposal based on type
        _executeProposalAction(proposal);
        
        emit ProposalExecuted(proposalId);
    }
    
    function cancelProposal(uint256 proposalId) external {
        Proposal storage proposal = proposals[proposalId];
        require(proposal.id != 0, "Proposal does not exist");
        require(
            msg.sender == proposal.proposer || msg.sender == owner(),
            "Not authorized to cancel"
        );
        require(!proposal.executed, "Already executed");
        require(!proposal.cancelled, "Already cancelled");
        
        proposal.cancelled = true;
        emit ProposalCancelled(proposalId);
    }
    
    // View functions
    function getProposal(uint256 proposalId) external view returns (
        uint256 id,
        address proposer,
        string memory title,
        string memory description,
        uint256 startTime,
        uint256 endTime,
        uint256 forVotes,
        uint256 againstVotes,
        uint256 abstainVotes,
        bool executed,
        bool cancelled,
        ProposalType proposalType
    ) {
        Proposal memory proposal = proposals[proposalId];
        return (
            proposal.id,
            proposal.proposer,
            proposal.title,
            proposal.description,
            proposal.startTime,
            proposal.endTime,
            proposal.forVotes,
            proposal.againstVotes,
            proposal.abstainVotes,
            proposal.executed,
            proposal.cancelled,
            proposal.proposalType
        );
    }
    
    function getProposalState(uint256 proposalId) external view returns (string memory) {
        Proposal memory proposal = proposals[proposalId];
        
        if (proposal.id == 0) return "NonExistent";
        if (proposal.cancelled) return "Cancelled";
        if (proposal.executed) return "Executed";
        if (block.timestamp <= proposal.endTime) return "Active";
        
        // Check if proposal can be executed
        uint256 totalVotes = proposal.forVotes + proposal.againstVotes + proposal.abstainVotes;
        uint256 totalSupply = governanceToken.totalSupply();
        uint256 quorumRequired = totalSupply * QUORUM_PERCENTAGE / 100;
        
        if (totalVotes < quorumRequired) return "Failed";
        
        uint256 approvalVotes = proposal.forVotes;
        uint256 totalVotesForApproval = proposal.forVotes + proposal.againstVotes;
        
        if (totalVotesForApproval == 0 || approvalVotes * 100 / totalVotesForApproval < APPROVAL_THRESHOLD) {
            return "Failed";
        }
        
        return "Succeeded";
    }
    
    function getUserVote(uint256 proposalId, address user) external view returns (
        bool hasVoted,
        VoteChoice choice,
        uint256 weight
    ) {
        Vote memory userVote = votes[proposalId][user];
        return (userVote.hasVoted, userVote.choice, userVote.weight);
    }
    
    // Internal functions
    function _executeProposalAction(Proposal memory proposal) internal {
        // Simplified execution logic - in production, this would handle different proposal types
        if (proposal.proposalType == ProposalType.PARAMETER_CHANGE) {
            // Handle parameter changes
        } else if (proposal.proposalType == ProposalType.COLLECTION_ADDITION) {
            // Handle collection additions
        } else if (proposal.proposalType == ProposalType.ORACLE_UPDATE) {
            // Handle oracle updates
        } else if (proposal.proposalType == ProposalType.EMERGENCY_ACTION) {
            // Handle emergency actions
        } else if (proposal.proposalType == ProposalType.TREASURY_ACTION) {
            // Handle treasury actions
        }
        
        // For MVP, we just emit events and store the decision
        // Production implementation would include actual execution logic
    }
    
    // Emergency functions
    function emergencyPause() external onlyOwner {
        // Emergency pause functionality
    }
    
    function updateVotingParameters(
        uint256 newVotingDuration,
        uint256 newMinProposalThreshold,
        uint256 newQuorumPercentage,
        uint256 newApprovalThreshold
    ) external onlyOwner {
        // Allow owner to update parameters in emergency
        // In production, these should be governed by proposals
    }
}
