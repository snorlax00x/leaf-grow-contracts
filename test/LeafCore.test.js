const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("LeafCore", function () {
  let LeafToken, PlantNFT, ProjectRegistry, LeafDAO, LeafCore;
  let leafToken, plantNFT, projectRegistry, leafDAO, leafCore;
  let owner, user1, user2, operator;

  beforeEach(async function () {
    [owner, user1, user2, operator] = await ethers.getSigners();

    // Deploy all contracts
    LeafToken = await ethers.getContractFactory("LeafToken");
    leafToken = await LeafToken.deploy(owner.address);
    await leafToken.deployed();

    PlantNFT = await ethers.getContractFactory("PlantNFT");
    plantNFT = await PlantNFT.deploy(owner.address);
    await plantNFT.deployed();

    ProjectRegistry = await ethers.getContractFactory("ProjectRegistry");
    projectRegistry = await ProjectRegistry.deploy(owner.address);
    await projectRegistry.deployed();

    // Deploy TimelockController for DAO
    const TimelockController = await ethers.getContractFactory(
      "TimelockController"
    );
    const timelock = await TimelockController.deploy(
      60, // minimum delay in seconds
      [owner.address], // proposers
      [owner.address], // executors
      owner.address // admin
    );
    await timelock.deployed();

    LeafDAO = await ethers.getContractFactory("LeafDAO");
    leafDAO = await LeafDAO.deploy(
      leafToken.address,
      timelock.address,
      4 // 4% quorum
    );
    await leafDAO.deployed();

    LeafCore = await ethers.getContractFactory("LeafCore");
    leafCore = await LeafCore.deploy(
      leafToken.address,
      plantNFT.address,
      projectRegistry.address,
      leafDAO.address,
      owner.address
    );
    await leafCore.deployed();

    // Setup permissions
    await leafToken.addMinter(leafCore.address);
    await plantNFT.addMinter(leafCore.address);
    await projectRegistry.addVerifier(leafCore.address);
    await leafCore.addOperator(leafCore.address);
  });

  describe("Deployment", function () {
    it("Should set the right owner", async function () {
      expect(await leafCore.owner()).to.equal(owner.address);
    });

    it("Should set correct contract references", async function () {
      expect(await leafCore.leafToken()).to.equal(leafToken.address);
      expect(await leafCore.plantNFT()).to.equal(plantNFT.address);
      expect(await leafCore.projectRegistry()).to.equal(
        projectRegistry.address
      );
      expect(await leafCore.leafDAO()).to.equal(leafDAO.address);
    });

    it("Should set owner as operator", async function () {
      expect(await leafCore.operators(owner.address)).to.be.true;
    });

    it("Should have correct platform fee", async function () {
      expect(await leafCore.platformFee()).to.equal(250); // 2.5%
    });
  });

  describe("Project Donations", function () {
    let projectId;

    beforeEach(async function () {
      // Create a test project
      const targetAmount = ethers.utils.parseEther("10");
      const endDate = Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60;

      const tx = await projectRegistry
        .connect(user1)
        .createProject(
          "Test Project",
          "Test project description",
          "Test Location",
          "tree_planting",
          targetAmount,
          endDate,
          "https://leaf.morphl2.io/images/test.jpg"
        );

      const receipt = await tx.wait();
      const event = receipt.events.find((e) => e.event === "ProjectCreated");
      projectId = event.args.projectId;
    });

    it("Should allow donations to projects", async function () {
      const donationAmount = ethers.utils.parseEther("1");

      const tx = await leafCore
        .connect(user2)
        .donateToProject(projectId, "Tree", "Great cause!");

      const receipt = await tx.wait();
      const event = receipt.events.find((e) => e.event === "DonationMade");

      expect(event.args.donationId).to.equal(1);
      expect(event.args.donor).to.equal(user2.address);
      expect(event.args.projectId).to.equal(projectId);
      expect(event.args.plantType).to.equal("Tree");
      expect(event.args.message).to.equal("Great cause!");
    });

    it("Should not allow donations below minimum", async function () {
      const smallDonation = ethers.utils.parseEther("0.0005"); // Below 0.001 ETH minimum

      await expect(
        leafCore
          .connect(user2)
          .donateToProject(projectId, "Tree", "Small donation")
      ).to.be.revertedWith("LeafCore: donation too small");
    });

    it("Should calculate platform fee correctly", async function () {
      const donationAmount = ethers.utils.parseEther("1");
      const platformFee = await leafCore.platformFee();
      const expectedFee = donationAmount.mul(platformFee).div(10000);
      const expectedDonation = donationAmount.sub(expectedFee);

      await leafCore
        .connect(user2)
        .donateToProject(projectId, "Tree", "Test donation");

      const project = await projectRegistry.getProject(projectId);
      expect(project.currentAmount).to.equal(expectedDonation);
    });

    it("Should update user stats correctly", async function () {
      const donationAmount = ethers.utils.parseEther("1");

      await leafCore
        .connect(user2)
        .donateToProject(projectId, "Tree", "Test donation");

      const userStats = await leafCore.getUserStats(user2.address);
      expect(userStats.totalDonations).to.equal(1);
      expect(userStats.totalAmount).to.be.gt(0);
      expect(userStats.lastDonation).to.be.gt(0);
    });

    it("Should distribute rewards correctly", async function () {
      const donationAmount = ethers.utils.parseEther("0.02"); // Above NFT threshold

      await leafCore
        .connect(user2)
        .donateToProject(projectId, "Tree", "Test donation");

      const userStats = await leafCore.getUserStats(user2.address);
      expect(userStats.leafTokensEarned).to.be.gt(0);
      expect(userStats.nftsEarned).to.equal(1);

      // Check that LEAF tokens were minted
      const leafBalance = await leafToken.balanceOf(user2.address);
      expect(leafBalance).to.be.gt(0);

      // Check that NFT was minted
      const nftBalance = await plantNFT.balanceOf(user2.address);
      expect(nftBalance).to.equal(1);
    });

    it("Should not distribute NFT for small donations", async function () {
      const donationAmount = ethers.utils.parseEther("0.005"); // Below NFT threshold

      await leafCore
        .connect(user2)
        .donateToProject(projectId, "Tree", "Small donation");

      const userStats = await leafCore.getUserStats(user2.address);
      expect(userStats.nftsEarned).to.equal(0);

      // Check that no NFT was minted
      const nftBalance = await plantNFT.balanceOf(user2.address);
      expect(nftBalance).to.equal(0);
    });

    it("Should emit RewardsDistributed event", async function () {
      const donationAmount = ethers.utils.parseEther("0.02");

      await expect(
        leafCore
          .connect(user2)
          .donateToProject(projectId, "Tree", "Test donation")
      )
        .to.emit(leafCore, "RewardsDistributed")
        .withArgs(
          user2.address,
          ethers.BigNumber.from(0),
          ethers.BigNumber.from(0),
          "donation_nft"
        );
    });
  });

  describe("Recurring Donations", function () {
    let projectId;

    beforeEach(async function () {
      // Create a test project
      const targetAmount = ethers.utils.parseEther("10");
      const endDate = Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60;

      const tx = await projectRegistry
        .connect(user1)
        .createProject(
          "Test Project",
          "Test project description",
          "Test Location",
          "tree_planting",
          targetAmount,
          endDate,
          "https://leaf.morphl2.io/images/test.jpg"
        );

      const receipt = await tx.wait();
      const event = receipt.events.find((e) => e.event === "ProjectCreated");
      projectId = event.args.projectId;
    });

    it("Should allow setting up recurring donations", async function () {
      const amount = ethers.utils.parseEther("0.1");
      const frequency = 30 * 24 * 60 * 60; // 30 days

      await leafCore
        .connect(user2)
        .setRecurringDonation(projectId, amount, frequency, "Tree");

      const recurringDonations = await leafCore.getUserRecurringDonations(
        user2.address
      );
      expect(recurringDonations.length).to.equal(1);
      expect(recurringDonations[0].donor).to.equal(user2.address);
      expect(recurringDonations[0].projectId).to.equal(projectId);
      expect(recurringDonations[0].amount).to.equal(amount);
      expect(recurringDonations[0].frequency).to.equal(frequency);
      expect(recurringDonations[0].active).to.be.true;
    });

    it("Should not allow frequency below minimum", async function () {
      const amount = ethers.utils.parseEther("0.1");
      const frequency = 12 * 60 * 60; // 12 hours (below 1 day minimum)

      await expect(
        leafCore
          .connect(user2)
          .setRecurringDonation(projectId, amount, frequency, "Tree")
      ).to.be.revertedWith("LeafCore: frequency too short");
    });

    it("Should not allow too many recurring donations", async function () {
      const amount = ethers.utils.parseEther("0.1");
      const frequency = 30 * 24 * 60 * 60;

      // Set up maximum allowed recurring donations
      for (let i = 0; i < 10; i++) {
        await leafCore
          .connect(user2)
          .setRecurringDonation(projectId, amount, frequency, "Tree");
      }

      await expect(
        leafCore
          .connect(user2)
          .setRecurringDonation(projectId, amount, frequency, "Tree")
      ).to.be.revertedWith("LeafCore: too many recurring donations");
    });

    it("Should allow cancelling recurring donations", async function () {
      const amount = ethers.utils.parseEther("0.1");
      const frequency = 30 * 24 * 60 * 60;

      await leafCore
        .connect(user2)
        .setRecurringDonation(projectId, amount, frequency, "Tree");

      await leafCore.connect(user2).cancelRecurringDonation(0);

      const recurringDonations = await leafCore.getUserRecurringDonations(
        user2.address
      );
      expect(recurringDonations[0].active).to.be.false;
    });

    it("Should not allow cancelling non-existent recurring donation", async function () {
      await expect(
        leafCore.connect(user2).cancelRecurringDonation(0)
      ).to.be.revertedWith("LeafCore: invalid recurring donation index");
    });

    it("Should emit RecurringDonationSet event", async function () {
      const amount = ethers.utils.parseEther("0.1");
      const frequency = 30 * 24 * 60 * 60;

      await expect(
        leafCore
          .connect(user2)
          .setRecurringDonation(projectId, amount, frequency, "Tree")
      )
        .to.emit(leafCore, "RecurringDonationSet")
        .withArgs(user2.address, projectId, amount, frequency);
    });

    it("Should emit RecurringDonationCancelled event", async function () {
      const amount = ethers.utils.parseEther("0.1");
      const frequency = 30 * 24 * 60 * 60;

      await leafCore
        .connect(user2)
        .setRecurringDonation(projectId, amount, frequency, "Tree");

      await expect(leafCore.connect(user2).cancelRecurringDonation(0))
        .to.emit(leafCore, "RecurringDonationCancelled")
        .withArgs(user2.address, projectId);
    });
  });

  describe("Recurring Donation Processing", function () {
    let projectId;

    beforeEach(async function () {
      // Create a test project
      const targetAmount = ethers.utils.parseEther("10");
      const endDate = Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60;

      const tx = await projectRegistry
        .connect(user1)
        .createProject(
          "Test Project",
          "Test project description",
          "Test Location",
          "tree_planting",
          targetAmount,
          endDate,
          "https://leaf.morphl2.io/images/test.jpg"
        );

      const receipt = await tx.wait();
      const event = receipt.events.find((e) => e.event === "ProjectCreated");
      projectId = event.args.projectId;
    });

    it("Should allow operator to process recurring donations", async function () {
      const amount = ethers.utils.parseEther("0.1");
      const frequency = 1; // 1 second for testing

      await leafCore
        .connect(user2)
        .setRecurringDonation(projectId, amount, frequency, "Tree");

      // Wait for the next donation time
      await ethers.provider.send("evm_increaseTime", [2]);
      await ethers.provider.send("evm_mine");

      await leafCore.connect(owner).processRecurringDonations([user2.address]);

      const userStats = await leafCore.getUserStats(user2.address);
      expect(userStats.totalDonations).to.equal(1);
    });

    it("Should not allow non-operator to process recurring donations", async function () {
      await expect(
        leafCore.connect(user1).processRecurringDonations([user2.address])
      ).to.be.revertedWith("LeafCore: caller is not an operator");
    });

    it("Should not process inactive recurring donations", async function () {
      const amount = ethers.utils.parseEther("0.1");
      const frequency = 1;

      await leafCore
        .connect(user2)
        .setRecurringDonation(projectId, amount, frequency, "Tree");

      await leafCore.connect(user2).cancelRecurringDonation(0);

      await ethers.provider.send("evm_increaseTime", [2]);
      await ethers.provider.send("evm_mine");

      await leafCore.connect(owner).processRecurringDonations([user2.address]);

      const userStats = await leafCore.getUserStats(user2.address);
      expect(userStats.totalDonations).to.equal(0);
    });
  });

  describe("View Functions", function () {
    let projectId;

    beforeEach(async function () {
      // Create a test project
      const targetAmount = ethers.utils.parseEther("10");
      const endDate = Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60;

      const tx = await projectRegistry
        .connect(user1)
        .createProject(
          "Test Project",
          "Test project description",
          "Test Location",
          "tree_planting",
          targetAmount,
          endDate,
          "https://leaf.morphl2.io/images/test.jpg"
        );

      const receipt = await tx.wait();
      const event = receipt.events.find((e) => e.event === "ProjectCreated");
      projectId = event.args.projectId;
    });

    it("Should return correct user donations", async function () {
      await leafCore
        .connect(user2)
        .donateToProject(projectId, "Tree", "Test donation");

      const userDonations = await leafCore.getUserDonations(user2.address);
      expect(userDonations.length).to.equal(1);
      expect(userDonations[0]).to.equal(1); // donation ID
    });

    it("Should return correct user stats", async function () {
      await leafCore
        .connect(user2)
        .donateToProject(projectId, "Tree", "Test donation");

      const userStats = await leafCore.getUserStats(user2.address);
      expect(userStats.totalDonations).to.equal(1);
      expect(userStats.totalAmount).to.be.gt(0);
      expect(userStats.leafTokensEarned).to.be.gt(0);
      expect(userStats.lastDonation).to.be.gt(0);
    });

    it("Should return correct donation details", async function () {
      await leafCore
        .connect(user2)
        .donateToProject(projectId, "Tree", "Test donation");

      const donation = await leafCore.getDonation(1);
      expect(donation.id).to.equal(1);
      expect(donation.donor).to.equal(user2.address);
      expect(donation.projectId).to.equal(projectId);
      expect(donation.plantType).to.equal("Tree");
      expect(donation.message).to.equal("Test donation");
      expect(donation.rewardsClaimed).to.be.false;
    });

    it("Should return correct total donations", async function () {
      expect(await leafCore.totalDonations()).to.equal(0);

      await leafCore
        .connect(user2)
        .donateToProject(projectId, "Tree", "Test donation");

      expect(await leafCore.totalDonations()).to.equal(1);
    });

    it("Should revert for non-existent donation", async function () {
      await expect(leafCore.getDonation(999)).to.be.revertedWith(
        "LeafCore: donation does not exist"
      );
    });
  });

  describe("Platform Fee Management", function () {
    it("Should allow owner to set platform fee", async function () {
      await leafCore.setPlatformFee(300); // 3%
      expect(await leafCore.platformFee()).to.equal(300);
    });

    it("Should not allow fee above maximum", async function () {
      await expect(
        leafCore.setPlatformFee(600) // 6% (above 5% max)
      ).to.be.revertedWith("LeafCore: fee too high");
    });

    it("Should not allow non-owner to set platform fee", async function () {
      await expect(
        leafCore.connect(user1).setPlatformFee(300)
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });
  });

  describe("Operator Management", function () {
    it("Should allow owner to add operator", async function () {
      await leafCore.addOperator(operator.address);
      expect(await leafCore.operators(operator.address)).to.be.true;
    });

    it("Should allow owner to remove operator", async function () {
      await leafCore.addOperator(operator.address);
      await leafCore.removeOperator(operator.address);
      expect(await leafCore.operators(operator.address)).to.be.false;
    });

    it("Should not allow non-owner to add operator", async function () {
      await expect(
        leafCore.connect(user1).addOperator(operator.address)
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });

    it("Should not allow non-owner to remove operator", async function () {
      await expect(
        leafCore.connect(user1).removeOperator(operator.address)
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });
  });

  describe("Fee Withdrawal", function () {
    it("Should allow owner to withdraw fees", async function () {
      // First, make a donation to generate fees
      const targetAmount = ethers.utils.parseEther("10");
      const endDate = Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60;

      const tx = await projectRegistry
        .connect(user1)
        .createProject(
          "Test Project",
          "Test project description",
          "Test Location",
          "tree_planting",
          targetAmount,
          endDate,
          "https://leaf.morphl2.io/images/test.jpg"
        );

      const receipt = await tx.wait();
      const event = receipt.events.find((e) => e.event === "ProjectCreated");
      const projectId = event.args.projectId;

      await leafCore
        .connect(user2)
        .donateToProject(projectId, "Tree", "Test donation");

      const initialBalance = await ethers.provider.getBalance(owner.address);
      const contractBalance = await ethers.provider.getBalance(
        leafCore.address
      );

      await leafCore.withdrawFees(contractBalance);

      const finalBalance = await ethers.provider.getBalance(owner.address);
      expect(finalBalance).to.be.gt(initialBalance);
    });

    it("Should not allow withdrawing more than available", async function () {
      const contractBalance = await ethers.provider.getBalance(
        leafCore.address
      );
      const excessAmount = contractBalance.add(ethers.utils.parseEther("1"));

      await expect(leafCore.withdrawFees(excessAmount)).to.be.revertedWith(
        "LeafCore: insufficient balance"
      );
    });

    it("Should not allow non-owner to withdraw fees", async function () {
      await expect(
        leafCore.connect(user1).withdrawFees(ethers.utils.parseEther("1"))
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });
  });
});
