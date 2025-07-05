const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("PlantNFT", function () {
  let PlantNFT;
  let plantNFT;
  let owner;
  let user1;
  let user2;
  let minter;

  beforeEach(async function () {
    [owner, user1, user2, minter] = await ethers.getSigners();

    PlantNFT = await ethers.getContractFactory("PlantNFT");
    plantNFT = await PlantNFT.deploy(owner.address);
    await plantNFT.deployed();
  });

  describe("Deployment", function () {
    it("Should set the right owner", async function () {
      expect(await plantNFT.owner()).to.equal(owner.address);
    });

    it("Should set owner as minter", async function () {
      expect(await plantNFT.minters(owner.address)).to.be.true;
    });

    it("Should have correct name and symbol", async function () {
      expect(await plantNFT.name()).to.equal("Leaf Plant NFT");
      expect(await plantNFT.symbol()).to.equal("LEAFPLANT");
    });

    it("Should initialize valid plant types", async function () {
      expect(await plantNFT.validPlantTypes("Tree")).to.be.true;
      expect(await plantNFT.validPlantTypes("Shrub")).to.be.true;
      expect(await plantNFT.validPlantTypes("Flower")).to.be.true;
      expect(await plantNFT.validPlantTypes("Herb")).to.be.true;
      expect(await plantNFT.validPlantTypes("Grass")).to.be.true;
    });
  });

  describe("Plant NFT Minting", function () {
    it("Should allow minter to mint plant NFT", async function () {
      const donationAmount = ethers.utils.parseEther("0.1");
      const tokenURI = "https://leaf.morphl2.io/api/nft/1/Tree/0.1";

      const tx = await plantNFT.mintPlantNFT(
        user1.address,
        "Tree",
        donationAmount,
        "Amazon Rainforest",
        tokenURI
      );

      const receipt = await tx.wait();
      const event = receipt.events.find((e) => e.event === "PlantNFTMinted");

      expect(event.args.to).to.equal(user1.address);
      expect(event.args.plantType).to.equal("Tree");
      expect(event.args.donationAmount).to.equal(donationAmount);

      expect(await plantNFT.ownerOf(1)).to.equal(user1.address);
      expect(await plantNFT.tokenURI(1)).to.equal(tokenURI);
    });

    it("Should not allow non-minter to mint plant NFT", async function () {
      const donationAmount = ethers.utils.parseEther("0.1");
      const tokenURI = "https://leaf.morphl2.io/api/nft/1/Tree/0.1";

      await expect(
        plantNFT
          .connect(user1)
          .mintPlantNFT(
            user2.address,
            "Tree",
            donationAmount,
            "Amazon Rainforest",
            tokenURI
          )
      ).to.be.revertedWith("PlantNFT: caller is not a minter");
    });

    it("Should not allow invalid plant type", async function () {
      const donationAmount = ethers.utils.parseEther("0.1");
      const tokenURI = "https://leaf.morphl2.io/api/nft/1/Invalid/0.1";

      await expect(
        plantNFT.mintPlantNFT(
          user1.address,
          "Invalid",
          donationAmount,
          "Amazon Rainforest",
          tokenURI
        )
      ).to.be.revertedWith("PlantNFT: invalid plant type");
    });

    it("Should store plant data correctly", async function () {
      const donationAmount = ethers.utils.parseEther("0.1");
      const tokenURI = "https://leaf.morphl2.io/api/nft/1/Tree/0.1";

      await plantNFT.mintPlantNFT(
        user1.address,
        "Tree",
        donationAmount,
        "Amazon Rainforest",
        tokenURI
      );

      const plantData = await plantNFT.getPlantData(1);
      expect(plantData.plantType).to.equal("Tree");
      expect(plantData.donationAmount).to.equal(donationAmount);
      expect(plantData.location).to.equal("Amazon Rainforest");
      expect(plantData.isPlanted).to.be.false;
      expect(plantData.isMaintained).to.be.false;
    });

    it("Should emit PlantNFTMinted event", async function () {
      const donationAmount = ethers.utils.parseEther("0.1");
      const tokenURI = "https://leaf.morphl2.io/api/nft/1/Tree/0.1";

      await expect(
        plantNFT.mintPlantNFT(
          user1.address,
          "Tree",
          donationAmount,
          "Amazon Rainforest",
          tokenURI
        )
      )
        .to.emit(plantNFT, "PlantNFTMinted")
        .withArgs(user1.address, 1, "Tree", donationAmount);
    });
  });

  describe("Achievement NFT Minting", function () {
    it("Should allow minter to mint achievement NFT", async function () {
      const tokenURI = "https://leaf.morphl2.io/api/achievement/1";

      const tx = await plantNFT.mintAchievementNFT(
        user1.address,
        "First Donation",
        "Completed first environmental donation",
        tokenURI
      );

      const receipt = await tx.wait();
      const event = receipt.events.find(
        (e) => e.event === "AchievementNFTMinted"
      );

      expect(event.args.to).to.equal(user1.address);
      expect(event.args.achievementType).to.equal("First Donation");

      expect(await plantNFT.ownerOf(1)).to.equal(user1.address);
      expect(await plantNFT.tokenURI(1)).to.equal(tokenURI);
    });

    it("Should not allow non-minter to mint achievement NFT", async function () {
      const tokenURI = "https://leaf.morphl2.io/api/achievement/1";

      await expect(
        plantNFT
          .connect(user1)
          .mintAchievementNFT(
            user2.address,
            "First Donation",
            "Completed first environmental donation",
            tokenURI
          )
      ).to.be.revertedWith("PlantNFT: caller is not a minter");
    });

    it("Should store achievement data correctly", async function () {
      const tokenURI = "https://leaf.morphl2.io/api/achievement/1";

      await plantNFT.mintAchievementNFT(
        user1.address,
        "First Donation",
        "Completed first environmental donation",
        tokenURI
      );

      const achievementData = await plantNFT.getAchievementData(1);
      expect(achievementData.achievementType).to.equal("First Donation");
      expect(achievementData.description).to.equal(
        "Completed first environmental donation"
      );
      expect(achievementData.earnedDate).to.be.gt(0);
    });

    it("Should emit AchievementNFTMinted event", async function () {
      const tokenURI = "https://leaf.morphl2.io/api/achievement/1";

      await expect(
        plantNFT.mintAchievementNFT(
          user1.address,
          "First Donation",
          "Completed first environmental donation",
          tokenURI
        )
      )
        .to.emit(plantNFT, "AchievementNFTMinted")
        .withArgs(user1.address, 1, "First Donation");
    });
  });

  describe("Plant Status Updates", function () {
    let tokenId;

    beforeEach(async function () {
      const donationAmount = ethers.utils.parseEther("0.1");
      const tokenURI = "https://leaf.morphl2.io/api/nft/1/Tree/0.1";

      await plantNFT.mintPlantNFT(
        user1.address,
        "Tree",
        donationAmount,
        "Amazon Rainforest",
        tokenURI
      );
      tokenId = 1;
    });

    it("Should allow minter to mark plant as planted", async function () {
      await plantNFT.markAsPlanted(tokenId);

      const plantData = await plantNFT.getPlantData(tokenId);
      expect(plantData.isPlanted).to.be.true;
      expect(plantData.plantedDate).to.be.gt(0);
    });

    it("Should not allow non-minter to mark plant as planted", async function () {
      await expect(
        plantNFT.connect(user1).markAsPlanted(tokenId)
      ).to.be.revertedWith("PlantNFT: caller is not a minter");
    });

    it("Should not allow marking non-existent token as planted", async function () {
      await expect(plantNFT.markAsPlanted(999)).to.be.revertedWith(
        "PlantNFT: token does not exist"
      );
    });

    it("Should not allow marking achievement NFT as planted", async function () {
      // Mint an achievement NFT
      const tokenURI = "https://leaf.morphl2.io/api/achievement/2";
      await plantNFT.mintAchievementNFT(
        user1.address,
        "First Donation",
        "Completed first environmental donation",
        tokenURI
      );

      await expect(plantNFT.markAsPlanted(2)).to.be.revertedWith(
        "PlantNFT: not a plant NFT"
      );
    });

    it("Should allow minter to mark plant as maintained", async function () {
      await plantNFT.markAsMaintained(tokenId);

      const plantData = await plantNFT.getPlantData(tokenId);
      expect(plantData.isMaintained).to.be.true;
    });

    it("Should not allow non-minter to mark plant as maintained", async function () {
      await expect(
        plantNFT.connect(user1).markAsMaintained(tokenId)
      ).to.be.revertedWith("PlantNFT: caller is not a minter");
    });
  });

  describe("Token URI Management", function () {
    let tokenId;

    beforeEach(async function () {
      const donationAmount = ethers.utils.parseEther("0.1");
      const tokenURI = "https://leaf.morphl2.io/api/nft/1/Tree/0.1";

      await plantNFT.mintPlantNFT(
        user1.address,
        "Tree",
        donationAmount,
        "Amazon Rainforest",
        tokenURI
      );
      tokenId = 1;
    });

    it("Should allow minter to update token URI", async function () {
      const newURI = "https://leaf.morphl2.io/api/nft/1/Tree/0.1/updated";

      await plantNFT.updateTokenURI(tokenId, newURI);
      expect(await plantNFT.tokenURI(tokenId)).to.equal(newURI);
    });

    it("Should not allow non-minter to update token URI", async function () {
      const newURI = "https://leaf.morphl2.io/api/nft/1/Tree/0.1/updated";

      await expect(
        plantNFT.connect(user1).updateTokenURI(tokenId, newURI)
      ).to.be.revertedWith("PlantNFT: caller is not a minter");
    });

    it("Should emit NFTMetadataUpdated event", async function () {
      const newURI = "https://leaf.morphl2.io/api/nft/1/Tree/0.1/updated";

      await expect(plantNFT.updateTokenURI(tokenId, newURI))
        .to.emit(plantNFT, "NFTMetadataUpdated")
        .withArgs(tokenId, newURI);
    });
  });

  describe("Minter Management", function () {
    it("Should allow owner to add minter", async function () {
      await plantNFT.addMinter(minter.address);
      expect(await plantNFT.minters(minter.address)).to.be.true;
    });

    it("Should allow owner to remove minter", async function () {
      await plantNFT.addMinter(minter.address);
      await plantNFT.removeMinter(minter.address);
      expect(await plantNFT.minters(minter.address)).to.be.false;
    });

    it("Should not allow non-owner to add minter", async function () {
      await expect(
        plantNFT.connect(user1).addMinter(minter.address)
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });

    it("Should not allow non-owner to remove minter", async function () {
      await expect(
        plantNFT.connect(user1).removeMinter(minter.address)
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });
  });

  describe("Plant Type Management", function () {
    it("Should allow owner to add valid plant type", async function () {
      await plantNFT.addValidPlantType("Bamboo");
      expect(await plantNFT.validPlantTypes("Bamboo")).to.be.true;
    });

    it("Should not allow non-owner to add valid plant type", async function () {
      await expect(
        plantNFT.connect(user1).addValidPlantType("Bamboo")
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });
  });

  describe("View Functions", function () {
    beforeEach(async function () {
      // Mint a plant NFT
      const donationAmount = ethers.utils.parseEther("0.1");
      const tokenURI = "https://leaf.morphl2.io/api/nft/1/Tree/0.1";

      await plantNFT.mintPlantNFT(
        user1.address,
        "Tree",
        donationAmount,
        "Amazon Rainforest",
        tokenURI
      );

      // Mint an achievement NFT
      const achievementURI = "https://leaf.morphl2.io/api/achievement/2";
      await plantNFT.mintAchievementNFT(
        user1.address,
        "First Donation",
        "Completed first environmental donation",
        achievementURI
      );
    });

    it("Should return correct total supply", async function () {
      expect(await plantNFT.totalSupply()).to.equal(2);
    });

    it("Should return correct plant data", async function () {
      const plantData = await plantNFT.getPlantData(1);
      expect(plantData.plantType).to.equal("Tree");
      expect(plantData.donationAmount).to.equal(ethers.utils.parseEther("0.1"));
    });

    it("Should return correct achievement data", async function () {
      const achievementData = await plantNFT.getAchievementData(2);
      expect(achievementData.achievementType).to.equal("First Donation");
      expect(achievementData.description).to.equal(
        "Completed first environmental donation"
      );
    });

    it("Should revert for non-existent token", async function () {
      await expect(plantNFT.getPlantData(999)).to.be.revertedWith(
        "PlantNFT: token does not exist"
      );
    });
  });

  describe("ERC721 Standard", function () {
    beforeEach(async function () {
      const donationAmount = ethers.utils.parseEther("0.1");
      const tokenURI = "https://leaf.morphl2.io/api/nft/1/Tree/0.1";

      await plantNFT.mintPlantNFT(
        user1.address,
        "Tree",
        donationAmount,
        "Amazon Rainforest",
        tokenURI
      );
    });

    it("Should support ERC721 interface", async function () {
      const erc721InterfaceId = "0x80ac58cd";
      expect(await plantNFT.supportsInterface(erc721InterfaceId)).to.be.true;
    });

    it("Should support ERC721Metadata interface", async function () {
      const erc721MetadataInterfaceId = "0x5b5e139f";
      expect(await plantNFT.supportsInterface(erc721MetadataInterfaceId)).to.be
        .true;
    });
  });
});
