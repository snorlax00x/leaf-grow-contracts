// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Counters.sol";

/**
 * @title PlantNFT
 * @dev NFT contract for representing donated plants and achievements
 * Each NFT represents a specific plant donation or achievement milestone
 */
contract PlantNFT is ERC721, ERC721URIStorage, Ownable {
    using Counters for Counters.Counter;

    Counters.Counter private _tokenIds;

    // Events
    event PlantNFTMinted(address indexed to, uint256 tokenId, string plantType, uint256 donationAmount);
    event AchievementNFTMinted(address indexed to, uint256 tokenId, string achievementType);
    event NFTMetadataUpdated(uint256 tokenId, string newURI);

    // Structs
    struct PlantData {
        string plantType;
        uint256 donationAmount;
        uint256 plantedDate;
        string location;
        bool isPlanted;
        bool isMaintained;
    }

    struct AchievementData {
        string achievementType;
        uint256 earnedDate;
        string description;
    }

    // Mappings
    mapping(uint256 => PlantData) public plantData;
    mapping(uint256 => AchievementData) public achievementData;
    mapping(address => bool) public minters;
    mapping(string => bool) public validPlantTypes;

    // Constants
    uint256 public constant MAX_SUPPLY = 1000000; // 1 million NFTs max

    constructor(address initialOwner) 
        ERC721("Leaf Plant NFT", "LEAFPLANT") 
        Ownable()
    {
        minters[initialOwner] = true;
        
        // Initialize valid plant types
        validPlantTypes["Tree"] = true;
        validPlantTypes["Shrub"] = true;
        validPlantTypes["Flower"] = true;
        validPlantTypes["Herb"] = true;
        validPlantTypes["Grass"] = true;
    }

    modifier onlyMinter() {
        require(minters[msg.sender] || msg.sender == owner(), "PlantNFT: caller is not a minter");
        _;
    }

    modifier validPlantType(string memory plantType) {
        require(validPlantTypes[plantType], "PlantNFT: invalid plant type");
        _;
    }

    /**
     * @dev Mint a plant NFT for a donation
     * @param to Address to mint NFT to
     * @param plantType Type of plant (e.g., "Tree", "Shrub")
     * @param donationAmount Amount donated in wei
     * @param location Location where plant will be planted
     * @param _tokenURI Metadata URI for the NFT
     */
    function mintPlantNFT(
        address to,
        string memory plantType,
        uint256 donationAmount,
        string memory location,
        string memory _tokenURI
    ) external onlyMinter validPlantType(plantType) returns (uint256) {
        require(_tokenIds.current() < MAX_SUPPLY, "PlantNFT: max supply reached");
        
        _tokenIds.increment();
        uint256 newTokenId = _tokenIds.current();
        
        _safeMint(to, newTokenId);
        _setTokenURI(newTokenId, _tokenURI);
        
        plantData[newTokenId] = PlantData({
            plantType: plantType,
            donationAmount: donationAmount,
            plantedDate: 0,
            location: location,
            isPlanted: false,
            isMaintained: false
        });
        
        emit PlantNFTMinted(to, newTokenId, plantType, donationAmount);
        return newTokenId;
    }

    /**
     * @dev Mint an achievement NFT
     * @param to Address to mint NFT to
     * @param achievementType Type of achievement
     * @param description Achievement description
     * @param _tokenURI Metadata URI for the NFT
     */
    function mintAchievementNFT(
        address to,
        string memory achievementType,
        string memory description,
        string memory _tokenURI
    ) external onlyMinter returns (uint256) {
        require(_tokenIds.current() < MAX_SUPPLY, "PlantNFT: max supply reached");
        
        _tokenIds.increment();
        uint256 newTokenId = _tokenIds.current();
        
        _safeMint(to, newTokenId);
        _setTokenURI(newTokenId, _tokenURI);
        
        achievementData[newTokenId] = AchievementData({
            achievementType: achievementType,
            earnedDate: block.timestamp,
            description: description
        });
        
        emit AchievementNFTMinted(to, newTokenId, achievementType);
        return newTokenId;
    }

    /**
     * @dev Update plant status to planted
     * @param tokenId NFT token ID
     */
    function markAsPlanted(uint256 tokenId) external onlyMinter {
        require(_exists(tokenId), "PlantNFT: token does not exist");
        require(plantData[tokenId].donationAmount > 0, "PlantNFT: not a plant NFT");
        
        plantData[tokenId].isPlanted = true;
        plantData[tokenId].plantedDate = block.timestamp;
    }

    /**
     * @dev Update plant status to maintained
     * @param tokenId NFT token ID
     */
    function markAsMaintained(uint256 tokenId) external onlyMinter {
        require(_exists(tokenId), "PlantNFT: token does not exist");
        require(plantData[tokenId].donationAmount > 0, "PlantNFT: not a plant NFT");
        
        plantData[tokenId].isMaintained = true;
    }

    /**
     * @dev Update NFT metadata URI
     * @param tokenId NFT token ID
     * @param newURI New metadata URI
     */
    function updateTokenURI(uint256 tokenId, string memory newURI) external onlyMinter {
        require(_exists(tokenId), "PlantNFT: token does not exist");
        _setTokenURI(tokenId, newURI);
        emit NFTMetadataUpdated(tokenId, newURI);
    }

    /**
     * @dev Add a minter role
     * @param minter Address to grant minter role
     */
    function addMinter(address minter) external onlyOwner {
        minters[minter] = true;
    }

    /**
     * @dev Remove a minter role
     * @param minter Address to revoke minter role
     */
    function removeMinter(address minter) external onlyOwner {
        minters[minter] = false;
    }

    /**
     * @dev Add a valid plant type
     * @param plantType Plant type to add
     */
    function addValidPlantType(string memory plantType) external onlyOwner {
        validPlantTypes[plantType] = true;
    }

    /**
     * @dev Get plant data for a token
     * @param tokenId NFT token ID
     */
    function getPlantData(uint256 tokenId) external view returns (PlantData memory) {
        require(_exists(tokenId), "PlantNFT: token does not exist");
        return plantData[tokenId];
    }

    /**
     * @dev Get achievement data for a token
     * @param tokenId NFT token ID
     */
    function getAchievementData(uint256 tokenId) external view returns (AchievementData memory) {
        require(_exists(tokenId), "PlantNFT: token does not exist");
        return achievementData[tokenId];
    }

    /**
     * @dev Get total number of NFTs minted
     */
    function totalSupply() external view returns (uint256) {
        return _tokenIds.current();
    }

    // Override required functions
    function tokenURI(uint256 tokenId) public view override(ERC721, ERC721URIStorage) returns (string memory) {
        return super.tokenURI(tokenId);
    }

    function supportsInterface(bytes4 interfaceId) public view override(ERC721, ERC721URIStorage) returns (bool) {
        return super.supportsInterface(interfaceId);
    }

    // ERC721, ERC721URIStorage multiple inheritance _burn override
    function _burn(uint256 tokenId) internal override(ERC721, ERC721URIStorage) {
        super._burn(tokenId);
    }
} 