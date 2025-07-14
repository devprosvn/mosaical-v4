// SPDX-License-Identifier: MIT
pragma solidity ^0.8.21;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract DPOTokenV3 is ERC20, Ownable {

    // Authorization for minting
    mapping(address => bool) public authorizedMinters;

    // NFT-specific token holdings
    mapping(address => mapping(uint256 => mapping(address => uint256))) public tokenHoldings;
    mapping(address => mapping(uint256 => uint256)) public nftTokenSupply;

    // Stateful interest tracking
    mapping(address => mapping(uint256 => mapping(address => uint256))) public claimableInterest;

    event InterestDistributed(address indexed collection, uint256 indexed tokenId, address indexed holder, uint256 amount);
    event InterestClaimed(address indexed user, address indexed collection, uint256 indexed tokenId, uint256 amount);
    event OrderPlaced(address indexed user, address indexed collection, uint256 indexed tokenId, bool isBuy, uint256 amount, uint256 price);
    event TradeExecuted(address indexed buyer, address indexed seller, address indexed collection, uint256 tokenId, uint256 amount, uint256 price);
    event TokensMinted(address indexed to, uint256 amount);
    event MinterAuthorized(address indexed minter);

    constructor() ERC20("Diversified Portfolio Option", "DPO") Ownable(msg.sender) {
        _mint(msg.sender, 1000000 * 10**18); // Initial supply
    }

    // Receive function to accept ETH for interest distribution
    receive() external payable {
        // Allow contract to receive ETH for interest payments
    }

    function mint(address to, uint256 amount) external {
        require(authorizedMinters[msg.sender] || msg.sender == owner(), "Not authorized to mint");
        _mint(to, amount);
        emit TokensMinted(to, amount);
    }

    function authorizeMinter(address minter) external onlyOwner {
        authorizedMinters[minter] = true;
        emit MinterAuthorized(minter);
    }

    function burn(uint256 amount) external {
        _burn(msg.sender, amount);
    }

    // Function called by LoanManager when creating loans
    function mintOnLoan(
        address collection,
        uint256 tokenId,
        address borrower,
        uint256 amount
    ) external {
        require(authorizedMinters[msg.sender], "Not authorized to mint");

        // Mint the generic ERC20 tokens to the borrower
        _mint(borrower, amount);

        // Update your NFT-specific ledgers
        tokenHoldings[collection][tokenId][borrower] += amount;
        nftTokenSupply[collection][tokenId] += amount;

        emit TokensMinted(borrower, amount);
    }

    // Additional functions for DPO token functionality
    function distributeInterest(address collection, uint256 tokenId, address holder, uint256 amount) external payable onlyOwner {
        require(msg.value >= amount, "Insufficient DPSV sent");
        claimableInterest[collection][tokenId][holder] += amount;
        emit InterestDistributed(collection, tokenId, holder, amount);
    }

    function calculatePendingInterest(address user, address collection, uint256 tokenId) external view returns (uint256) {
        return claimableInterest[collection][tokenId][user];
    }

    function claimInterest(address collection, uint256 tokenId) external {
        uint256 pending = claimableInterest[collection][tokenId][msg.sender];
        if (pending > 0) {
            claimableInterest[collection][tokenId][msg.sender] = 0;
            
            // Send native DPSV as interest payment
            require(address(this).balance >= pending, "Insufficient contract balance");
            (bool success, ) = payable(msg.sender).call{value: pending}("");
            require(success, "DPSV transfer failed");
            
            emit InterestClaimed(msg.sender, collection, tokenId, pending);
        }
    }

    function placeSellOrder(address collection, uint256 tokenId, uint256 amount, uint256 price) external {
        require(tokenHoldings[collection][tokenId][msg.sender] >= amount, "Insufficient balance");
        emit OrderPlaced(msg.sender, collection, tokenId, false, amount, price);
    }

    function placeBuyOrder(address collection, uint256 tokenId, uint256 amount, uint256 price) external payable {
        require(msg.value >= (amount * price) / 10**18, "Insufficient payment");
        
        // For simplification, immediately execute the trade with the caller as both buyer and seller
        tokenHoldings[collection][tokenId][msg.sender] += amount;
        
        emit OrderPlaced(msg.sender, collection, tokenId, true, amount, price);
        emit TradeExecuted(msg.sender, msg.sender, collection, tokenId, amount, price);
    }
}