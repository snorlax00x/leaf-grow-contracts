# Leaf - Web3-Powered Plant Donation Platform

A decentralized platform that addresses environmental issues through transparent plant donations, community engagement, and reward systems.

## Deployed Smart Contracts Overview

This repository contains the smart contracts for the Leaf Web3 Plant Donation Platform, deployed on the Morph Holesky Testnet. The platform enables transparent, community-driven environmental impact through donations, NFT rewards, and DAO governance.

### Deployed Contracts and Roles

- **LeafToken**  
  ERC20 governance and reward token (symbol: LEAF). Users earn LEAF for donations and participation. Used for DAO voting and platform rewards.

- **PlantNFT**  
  ERC721 NFT contract. Each NFT represents a unique plant donation or achievement. Donors receive NFTs for significant contributions, and project milestones are tracked as NFTs.

- **ProjectRegistry**  
  Registry and management contract for environmental projects. Handles project creation, funding, milestone tracking, and verification. All donations are transparently recorded.

- **TimelockController**  
  Security and governance contract. Enforces a time delay on DAO-approved actions, ensuring transparency and giving the community time to react to proposals before execution.

- **LeafDAO**  
  On-chain DAO governance contract. LEAF token holders can propose, vote, and execute decisions about new projects, platform upgrades, and fund allocation.

- **LeafCore**  
  The main integration contract. Orchestrates donations, reward distribution (LEAF and NFTs), recurring donations, and coordinates between all other contracts.

### Deployed Addresses (Morph Holesky Testnet)

```
LeafToken:          0xBc30AA123a06523a51B3434839B98080a3481936
PlantNFT:           0x297A99C2910B0736BB5D1E798250752396fB209c
ProjectRegistry:    0xf50d4A8D06b0793652f40FAF53002a728Ec2a295
TimelockController: 0xAc6D61c0880D92B69F9cb166C6e96b91599C3695
LeafDAO:            0xF9A1521814860d1F4a2c4E7fEE1c215C3377bB3a
LeafCore:           0x184b85aE47CceC6D7286071ABaF098161F46dB08
```

### Example Projects Created at Deployment

- **Amazon Rainforest Restoration**  
  Plant 1000 native trees in the Amazon rainforest to restore biodiversity and combat climate change.

- **Community Solar Farm**  
  Install solar panels in rural communities to provide clean energy and reduce carbon emissions.

- **Coral Reef Protection**  
  Protect and restore coral reefs in the Great Barrier Reef through monitoring and restoration efforts.

---

**How it works:**

1. Users donate ETH to verified projects via LeafCore.
2. Donors receive LEAF tokens and PlantNFTs as rewards.
3. Projects and milestones are transparently tracked in ProjectRegistry.
4. The DAO (LeafDAO) governs platform upgrades and new project approvals, with all actions subject to TimelockController security.

---

## Overview

Leaf is a comprehensive Web3 ecosystem that combines:

- **Transparent Donations**: Track every donation with blockchain transparency
- **Community Governance**: DAO-based decision making for environmental projects
- **NFT Rewards**: Plant and achievement NFTs for contributors
- **Recurring Donations**: Automated monthly contributions
- **AI Recommendations**: Smart project suggestions based on user preferences

## Smart Contracts Architecture

### 1. LeafToken (LEAF)

- **Role**: DAO governance token, contribution/donation rewards
- **Key Functions**:
  - `balanceOf(address)`: Check balance
  - `mint(address, amount, reason)`: Mint tokens (used by LeafCore, etc.)
  - `burn(address, amount, reason)`: Burn tokens
  - `delegate(address)`: Delegate voting power
  - `getVotes(address)`: Check voting power
- **Frontend Usage Examples**: My balance, voting power, token transfer, voting delegation, etc.
- **ABI Location**: `abi/LeafToken.json`

### 2. PlantNFT

- **Role**: Donation/achievement NFT
- **Key Functions**:
  - `mintPlantNFT(address, plantType, amount, location, tokenURI)`: Mint plant NFT
  - `mintAchievementNFT(address, type, desc, tokenURI)`: Mint achievement NFT
  - `getPlantData(tokenId)`: Plant NFT metadata
  - `getAchievementData(tokenId)`: Achievement NFT metadata
- **Frontend Usage Examples**: My NFT list, achievement badges, NFT details, etc.
- **ABI Location**: `abi/PlantNFT.json`

### 3. ProjectRegistry

- **Role**: Project registration/donation/milestone management
- **Key Functions**:
  - `createProject(name, desc, location, type, target, end, imageURI)`: Create project
  - `donateToProject(projectId, message)`: Donate to project
  - `getProject(projectId)`: Project details
  - `getProjectMilestones(projectId)`: Milestone list
- **Frontend Usage Examples**: Project list, details, donations, milestone progress, etc.
- **ABI Location**: `abi/ProjectRegistry.json`

### 4. LeafCore

- **Role**: Donation, rewards, recurring donations, statistics - platform core
- **Key Functions**:
  - `donateToProject(projectId, plantType, message)`: Actual donation transaction
  - `setRecurringDonation(projectId, amount, freq, plantType)`: Set recurring donation
  - `getUserStats(address)`: My donation/reward statistics
  - `getUserDonations(address)`: My donation history
- **Frontend Usage Examples**: Actual donations, my donation history/statistics, recurring donation management, etc.
- **ABI Location**: `abi/LeafCore.json`

### 5. LeafDAO

- **Role**: Community governance (proposals, voting)
- **Key Functions**:
  - `createCommunityProposal(title, desc, target, type, location)`: Create proposal
  - `castVote(proposalId, support)`: Vote
  - `getProposal(proposalId)`: Proposal details
- **Frontend Usage Examples**: Create proposals, vote, view results, etc.
- **ABI Location**: `abi/LeafDAO.json`

## Quick Start

### Prerequisites

- Node.js 16+
- npm or yarn
- Hardhat

### Installation

```bash
git clone <repository-url>
cd leaf-grow-contracts
npm install --legacy-peer-deps
```

### Compile Contracts

```bash
npx hardhat compile
```

### Deploy to Morph Holesky Testnet

1. Set your private key in `.env` file:

```bash
PRIVATE_KEY=your_private_key_here
```

2. Deploy contracts:

```bash
npx hardhat run scripts/deploy.js --network morphHolesky
```

### Run Tests

```bash
npx hardhat test
```

## Network Configuration

### Morph Holesky Testnet

- **RPC URL**: https://rpc-quicknode-holesky.morphl2.io
- **Chain ID**: 2810
- **Explorer**: https://explorer-holesky.morphl2.io
- **Currency**: ETH

## Frontend Integration Guide

### ABI Usage

- Extract only the "abi" field from each contract's ABI in the `abi/` folder for use
- Refer to `deployment-<network>.json` file for deployment addresses

### Key Contracts for Frontend

- **Donations/Rewards/Statistics**: `LeafCore`
- **Projects/Milestones**: `ProjectRegistry`
- **NFTs**: `PlantNFT`
- **Tokens/Voting**: `LeafToken`
- **Governance**: `LeafDAO`

### Example Integration

```javascript
// Example: Connect to LeafCore contract
const leafCoreABI = require("./abi/LeafCore.json").abi;
const leafCore = new ethers.Contract(leafCoreAddress, leafCoreABI, signer);

// Donate to a project
const tx = await leafCore.donateToProject(
  projectId,
  "Tree",
  "Supporting reforestation",
  { value: ethers.parseEther("0.1") }
);
```

## Project Structure

```
leaf-grow-contracts/
├── contracts/           # Smart contracts
│   ├── LeafToken.sol
│   ├── PlantNFT.sol
│   ├── ProjectRegistry.sol
│   ├── LeafCore.sol
│   └── LeafDAO.sol
├── scripts/             # Deployment scripts
│   └── deploy.js
├── test/                # Test files
├── abi/                 # Contract ABIs
├── docs/                # Documentation
└── deployment-*.json    # Deployment addresses
```

## Features

### 🌱 Plant Donations

- Transparent tracking of every donation
- NFT rewards for contributors
- Real-time project updates

### 🏛️ Community Governance

- DAO-based decision making
- Proposal creation and voting
- Transparent governance process

### 🔄 Recurring Donations

- Automated monthly contributions
- Flexible donation schedules
- Easy management interface

### 🎯 AI Recommendations

- Smart project suggestions
- Personalized donation recommendations
- Impact optimization
