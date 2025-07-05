// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Votes.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title LeafToken
 * @dev Leaf DAO governance token with voting capabilities
 * Users earn LEAF tokens for participating in donations, governance, and community activities
 */
contract LeafToken is ERC20, ERC20Permit, ERC20Votes, Ownable {
    // Events
    event TokensMinted(address indexed to, uint256 amount, string reason);
    event TokensBurned(address indexed from, uint256 amount, string reason);

    // Constants
    uint256 public constant INITIAL_SUPPLY = 1000000 * 10**18; // 1 million tokens
    uint256 public constant MAX_SUPPLY = 10000000 * 10**18; // 10 million tokens

    // Minter roles
    mapping(address => bool) public minters;

    constructor(address initialOwner) 
        ERC20("Leaf DAO Token", "LEAF") 
        ERC20Permit("Leaf DAO Token")
        Ownable()
    {
        _mint(initialOwner, INITIAL_SUPPLY);
        minters[initialOwner] = true;
    }

    modifier onlyMinter() {
        require(minters[msg.sender] || msg.sender == owner(), "LeafToken: caller is not a minter");
        _;
    }

    /**
     * @dev Mint tokens to a user for participation rewards
     * @param to Address to mint tokens to
     * @param amount Amount of tokens to mint
     * @param reason Reason for minting (e.g., "donation", "governance", "community")
     */
    function mint(address to, uint256 amount, string memory reason) external onlyMinter {
        require(totalSupply() + amount <= MAX_SUPPLY, "LeafToken: would exceed max supply");
        _mint(to, amount);
        emit TokensMinted(to, amount, reason);
    }

    /**
     * @dev Burn tokens from a user
     * @param from Address to burn tokens from
     * @param amount Amount of tokens to burn
     * @param reason Reason for burning
     */
    function burn(address from, uint256 amount, string memory reason) external onlyMinter {
        _burn(from, amount);
        emit TokensBurned(from, amount, reason);
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

    // Override required functions for ERC20Votes (OpenZeppelin v4 pattern)
    function _afterTokenTransfer(address from, address to, uint256 amount)
        internal
        override(ERC20, ERC20Votes)
    {
        super._afterTokenTransfer(from, to, amount);
    }

    function _mint(address to, uint256 amount)
        internal
        override(ERC20, ERC20Votes)
    {
        super._mint(to, amount);
    }

    function _burn(address from, uint256 amount)
        internal
        override(ERC20, ERC20Votes)
    {
        super._burn(from, amount);
    }
} 