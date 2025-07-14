
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.21;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/math/Math.sol";

contract GameFiOracleV3 is Ownable, ReentrancyGuard {
    using Math for uint256;
    
    struct PriceData {
        uint256 floorPrice;
        uint256 lastUpdate;
        bool isActive;
    }
    
    struct UtilityData {
        uint256 score; // 0-100 scale
        uint256 lastUpdate;
        bool isActive;
    }
    
    struct CollectionMetrics {
        uint256 volume24h;
        uint256 holders;
        uint256 listingCount;
        uint256 avgHoldTime;
        bool isGameFi;
    }
    
    // Core mappings
    mapping(address => PriceData) public priceData;
    mapping(address => mapping(uint256 => UtilityData)) public utilityData;
    mapping(address => CollectionMetrics) public collectionMetrics;
    mapping(address => bool) public authorizedUpdaters;
    
    // Constants
    uint256 public constant PRICE_STALENESS_THRESHOLD = 1 hours;
    uint256 public constant UTILITY_STALENESS_THRESHOLD = 6 hours;
    uint256 public constant MIN_UTILITY_SCORE = 1;
    uint256 public constant MAX_UTILITY_SCORE = 100;
    
    // Events
    event PriceUpdated(address indexed collection, uint256 newPrice, uint256 timestamp);
    event UtilityUpdated(address indexed collection, uint256 indexed tokenId, uint256 score);
    event CollectionMetricsUpdated(address indexed collection, uint256 volume, uint256 holders);
    event UpdaterAuthorized(address indexed updater, bool authorized);
    
    modifier onlyAuthorized() {
        require(authorizedUpdaters[msg.sender] || msg.sender == owner(), "Not authorized");
        _;
    }
    
    constructor() Ownable(msg.sender) {
        authorizedUpdaters[msg.sender] = true;
    }
    
    // Admin functions
    function authorizeUpdater(address updater, bool authorized) external onlyOwner {
        authorizedUpdaters[updater] = authorized;
        emit UpdaterAuthorized(updater, authorized);
    }
    
    // Price management
    function updateFloorPrice(address collection, uint256 price) external onlyAuthorized {
        require(price > 0, "Invalid price");
        
        priceData[collection] = PriceData({
            floorPrice: price,
            lastUpdate: block.timestamp,
            isActive: true
        });
        
        emit PriceUpdated(collection, price, block.timestamp);
    }
    
    function batchUpdatePrices(
        address[] calldata collections,
        uint256[] calldata prices
    ) external onlyAuthorized {
        require(collections.length == prices.length, "Array length mismatch");
        
        for (uint256 i = 0; i < collections.length; i++) {
            if (prices[i] > 0) {
                priceData[collections[i]] = PriceData({
                    floorPrice: prices[i],
                    lastUpdate: block.timestamp,
                    isActive: true
                });
                
                emit PriceUpdated(collections[i], prices[i], block.timestamp);
            }
        }
    }
    
    // Utility scoring
    function updateUtilityScore(
        address collection,
        uint256 tokenId,
        uint256 score
    ) external onlyAuthorized {
        require(score >= MIN_UTILITY_SCORE && score <= MAX_UTILITY_SCORE, "Invalid score");
        
        utilityData[collection][tokenId] = UtilityData({
            score: score,
            lastUpdate: block.timestamp,
            isActive: true
        });
        
        emit UtilityUpdated(collection, tokenId, score);
    }
    
    function batchUpdateUtilityScores(
        address[] calldata collections,
        uint256[] calldata tokenIds,
        uint256[] calldata scores
    ) external onlyAuthorized {
        require(
            collections.length == tokenIds.length && 
            collections.length == scores.length,
            "Array length mismatch"
        );
        
        for (uint256 i = 0; i < collections.length; i++) {
            if (scores[i] >= MIN_UTILITY_SCORE && scores[i] <= MAX_UTILITY_SCORE) {
                utilityData[collections[i]][tokenIds[i]] = UtilityData({
                    score: scores[i],
                    lastUpdate: block.timestamp,
                    isActive: true
                });
                
                emit UtilityUpdated(collections[i], tokenIds[i], scores[i]);
            }
        }
    }
    
    // Collection metrics
    function updateCollectionMetrics(
        address collection,
        uint256 volume24h,
        uint256 holders,
        uint256 listingCount,
        uint256 avgHoldTime,
        bool isGameFi
    ) external onlyAuthorized {
        collectionMetrics[collection] = CollectionMetrics({
            volume24h: volume24h,
            holders: holders,
            listingCount: listingCount,
            avgHoldTime: avgHoldTime,
            isGameFi: isGameFi
        });
        
        emit CollectionMetricsUpdated(collection, volume24h, holders);
    }
    
    // View functions
    function getFloorPrice(address collection) external view returns (uint256) {
        PriceData memory data = priceData[collection];
        
        if (!data.isActive) return 0;
        if (block.timestamp - data.lastUpdate > PRICE_STALENESS_THRESHOLD) return 0;
        
        return data.floorPrice;
    }
    
    function getUtilityScore(address collection, uint256 tokenId) external view returns (uint256) {
        UtilityData memory data = utilityData[collection][tokenId];
        
        if (!data.isActive) {
            // Return default score based on collection if no specific data
            CollectionMetrics memory metrics = collectionMetrics[collection];
            if (metrics.isGameFi) {
                return _calculateDefaultUtilityScore(collection);
            }
            return MIN_UTILITY_SCORE;
        }
        
        if (block.timestamp - data.lastUpdate > UTILITY_STALENESS_THRESHOLD) {
            return MIN_UTILITY_SCORE;
        }
        
        return data.score;
    }
    
    function isActiveAsset(address collection, uint256 tokenId) external view returns (bool) {
        // Check if we have recent price data
        PriceData memory price = priceData[collection];
        if (!price.isActive || block.timestamp - price.lastUpdate > PRICE_STALENESS_THRESHOLD) {
            return false;
        }
        
        // Check if collection is GameFi
        CollectionMetrics memory metrics = collectionMetrics[collection];
        if (!metrics.isGameFi) return false;
        
        // Check utility score (optional - asset is active even without specific utility data)
        UtilityData memory utility = utilityData[collection][tokenId];
        
        return true;
    }
    
    function getPriceInfo(address collection) external view returns (
        uint256 floorPrice,
        uint256 lastUpdate,
        bool isActive,
        bool isStale
    ) {
        PriceData memory data = priceData[collection];
        floorPrice = data.floorPrice;
        lastUpdate = data.lastUpdate;
        isActive = data.isActive;
        isStale = block.timestamp - data.lastUpdate > PRICE_STALENESS_THRESHOLD;
    }
    
    function getUtilityInfo(address collection, uint256 tokenId) external view returns (
        uint256 score,
        uint256 lastUpdate,
        bool isActive,
        bool isStale
    ) {
        UtilityData memory data = utilityData[collection][tokenId];
        score = data.isActive ? data.score : _calculateDefaultUtilityScore(collection);
        lastUpdate = data.lastUpdate;
        isActive = data.isActive;
        isStale = data.isActive && block.timestamp - data.lastUpdate > UTILITY_STALENESS_THRESHOLD;
    }
    
    function getCollectionHealth(address collection) external view returns (
        uint256 healthScore, // 0-100
        bool isLiquid,
        bool hasRecentActivity
    ) {
        CollectionMetrics memory metrics = collectionMetrics[collection];
        PriceData memory price = priceData[collection];
        
        if (!metrics.isGameFi || !price.isActive) {
            return (0, false, false);
        }
        
        // Calculate health based on various factors
        uint256 volumeScore = metrics.volume24h > 1 ether ? 25 : (metrics.volume24h * 25 / 1 ether);
        uint256 holderScore = metrics.holders > 1000 ? 25 : (metrics.holders * 25 / 1000);
        uint256 liquidityScore = metrics.listingCount > 100 ? 25 : (metrics.listingCount * 25 / 100);
        uint256 holdScore = metrics.avgHoldTime > 30 days ? 25 : (metrics.avgHoldTime * 25 / 30 days);
        
        healthScore = volumeScore + holderScore + liquidityScore + holdScore;
        if (healthScore > 100) healthScore = 100;
        
        isLiquid = metrics.listingCount > 10 && metrics.volume24h > 0.1 ether;
        hasRecentActivity = block.timestamp - price.lastUpdate < 1 hours;
    }
    
    // Internal functions
    function _calculateDefaultUtilityScore(address collection) internal view returns (uint256) {
        CollectionMetrics memory metrics = collectionMetrics[collection];
        
        if (!metrics.isGameFi) return MIN_UTILITY_SCORE;
        
        // Base score for GameFi NFTs
        uint256 baseScore = 30;
        
        // Bonus for high holder count (indicates popularity)
        if (metrics.holders > 5000) baseScore = baseScore + 20;
        else if (metrics.holders > 1000) baseScore = baseScore + 10;
        
        // Bonus for trading activity
        if (metrics.volume24h > 10 ether) baseScore = baseScore + 15;
        else if (metrics.volume24h > 1 ether) baseScore = baseScore + 5;
        
        // Bonus for liquidity
        if (metrics.listingCount > 100) baseScore = baseScore + 10;
        
        return baseScore > MAX_UTILITY_SCORE ? MAX_UTILITY_SCORE : baseScore;
    }
    
    // Emergency functions
    function emergencyPause(address collection, bool paused) external onlyOwner {
        priceData[collection].isActive = !paused;
    }
    
    function emergencyUpdatePrice(address collection, uint256 price) external onlyOwner {
        priceData[collection] = PriceData({
            floorPrice: price,
            lastUpdate: block.timestamp,
            isActive: true
        });
        
        emit PriceUpdated(collection, price, block.timestamp);
    }
}
