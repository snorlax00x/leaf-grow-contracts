const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("ProjectRegistry", function () {
  let ProjectRegistry;
  let projectRegistry;
  let owner;
  let user1;
  let user2;
  let verifier;

  beforeEach(async function () {
    [owner, user1, user2, verifier] = await ethers.getSigners();

    ProjectRegistry = await ethers.getContractFactory("ProjectRegistry");
    projectRegistry = await ProjectRegistry.deploy(owner.address);
    await projectRegistry.deployed();
  });

  describe("Deployment", function () {
    it("Should set the right owner", async function () {
      expect(await projectRegistry.owner()).to.equal(owner.address);
    });

    it("Should set owner as verifier", async function () {
      expect(await projectRegistry.verifiers(owner.address)).to.be.true;
    });

    it("Should initialize valid project types", async function () {
      expect(await projectRegistry.validProjectTypes("tree_planting")).to.be
        .true;
      expect(await projectRegistry.validProjectTypes("solar_development")).to.be
        .true;
      expect(await projectRegistry.validProjectTypes("conservation")).to.be
        .true;
      expect(await projectRegistry.validProjectTypes("water_restoration")).to.be
        .true;
      expect(await projectRegistry.validProjectTypes("wildlife_protection")).to
        .be.true;
      expect(await projectRegistry.validProjectTypes("agricultural_tools")).to
        .be.true;
    });
  });

  describe("Project Creation", function () {
    it("Should allow anyone to create a project", async function () {
      const targetAmount = ethers.utils.parseEther("10");
      const endDate = Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60; // 30 days from now

      const tx = await projectRegistry
        .connect(user1)
        .createProject(
          "Amazon Rainforest Restoration",
          "Plant 1000 native trees in the Amazon rainforest",
          "Amazon Rainforest, Brazil",
          "tree_planting",
          targetAmount,
          endDate,
          "https://leaf.morphl2.io/images/amazon-project.jpg"
        );

      const receipt = await tx.wait();
      const event = receipt.events.find((e) => e.event === "ProjectCreated");

      expect(event.args.projectId).to.equal(1);
      expect(event.args.creator).to.equal(user1.address);
      expect(event.args.name).to.equal("Amazon Rainforest Restoration");
      expect(event.args.targetAmount).to.equal(targetAmount);
    });

    it("Should not allow invalid project type", async function () {
      const targetAmount = ethers.utils.parseEther("10");
      const endDate = Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60;

      await expect(
        projectRegistry
          .connect(user1)
          .createProject(
            "Invalid Project",
            "Invalid project description",
            "Invalid Location",
            "invalid_type",
            targetAmount,
            endDate,
            "https://leaf.morphl2.io/images/invalid.jpg"
          )
      ).to.be.revertedWith("ProjectRegistry: invalid project type");
    });

    it("Should not allow target amount below minimum", async function () {
      const targetAmount = ethers.utils.parseEther("0.005"); // Below 0.01 ETH minimum
      const endDate = Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60;

      await expect(
        projectRegistry
          .connect(user1)
          .createProject(
            "Small Project",
            "Small project description",
            "Small Location",
            "tree_planting",
            targetAmount,
            endDate,
            "https://leaf.morphl2.io/images/small.jpg"
          )
      ).to.be.revertedWith("ProjectRegistry: invalid target amount");
    });

    it("Should not allow target amount above maximum", async function () {
      const targetAmount = ethers.utils.parseEther("1500"); // Above 1000 ETH maximum
      const endDate = Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60;

      await expect(
        projectRegistry
          .connect(user1)
          .createProject(
            "Large Project",
            "Large project description",
            "Large Location",
            "tree_planting",
            targetAmount,
            endDate,
            "https://leaf.morphl2.io/images/large.jpg"
          )
      ).to.be.revertedWith("ProjectRegistry: invalid target amount");
    });

    it("Should not allow end date in the past", async function () {
      const targetAmount = ethers.utils.parseEther("10");
      const endDate = Math.floor(Date.now() / 1000) - 24 * 60 * 60; // 1 day ago

      await expect(
        projectRegistry
          .connect(user1)
          .createProject(
            "Past Project",
            "Past project description",
            "Past Location",
            "tree_planting",
            targetAmount,
            endDate,
            "https://leaf.morphl2.io/images/past.jpg"
          )
      ).to.be.revertedWith("ProjectRegistry: end date must be in the future");
    });

    it("Should store project data correctly", async function () {
      const targetAmount = ethers.utils.parseEther("10");
      const endDate = Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60;

      await projectRegistry
        .connect(user1)
        .createProject(
          "Amazon Rainforest Restoration",
          "Plant 1000 native trees in the Amazon rainforest",
          "Amazon Rainforest, Brazil",
          "tree_planting",
          targetAmount,
          endDate,
          "https://leaf.morphl2.io/images/amazon-project.jpg"
        );

      const project = await projectRegistry.getProject(1);
      expect(project.id).to.equal(1);
      expect(project.creator).to.equal(user1.address);
      expect(project.name).to.equal("Amazon Rainforest Restoration");
      expect(project.description).to.equal(
        "Plant 1000 native trees in the Amazon rainforest"
      );
      expect(project.location).to.equal("Amazon Rainforest, Brazil");
      expect(project.projectType).to.equal("tree_planting");
      expect(project.targetAmount).to.equal(targetAmount);
      expect(project.currentAmount).to.equal(0);
      expect(project.status).to.equal(0); // Active
      expect(project.isVerified).to.be.false;
      expect(project.imageURI).to.equal(
        "https://leaf.morphl2.io/images/amazon-project.jpg"
      );
    });
  });

  describe("Project Donations", function () {
    let projectId;

    beforeEach(async function () {
      const targetAmount = ethers.utils.parseEther("10");
      const endDate = Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60;

      const tx = await projectRegistry
        .connect(user1)
        .createProject(
          "Amazon Rainforest Restoration",
          "Plant 1000 native trees in the Amazon rainforest",
          "Amazon Rainforest, Brazil",
          "tree_planting",
          targetAmount,
          endDate,
          "https://leaf.morphl2.io/images/amazon-project.jpg"
        );

      const receipt = await tx.wait();
      const event = receipt.events.find((e) => e.event === "ProjectCreated");
      projectId = event.args.projectId;
    });

    it("Should allow donations to active projects", async function () {
      const donationAmount = ethers.utils.parseEther("1");

      const tx = await projectRegistry
        .connect(user2)
        .donateToProject(projectId, "Great cause!");

      const receipt = await tx.wait();
      const event = receipt.events.find((e) => e.event === "ProjectFunded");

      expect(event.args.projectId).to.equal(projectId);
      expect(event.args.donor).to.equal(user2.address);
      expect(event.args.amount).to.equal(donationAmount);

      const project = await projectRegistry.getProject(projectId);
      expect(project.currentAmount).to.equal(donationAmount);
    });

    it("Should not allow zero donations", async function () {
      await expect(
        projectRegistry.connect(user2).donateToProject(projectId, "No money")
      ).to.be.revertedWith(
        "ProjectRegistry: donation amount must be greater than 0"
      );
    });

    it("Should not allow donations exceeding target amount", async function () {
      const largeDonation = ethers.utils.parseEther("15"); // Exceeds 10 ETH target

      await expect(
        projectRegistry.connect(user2).donateToProject(projectId, "Too much")
      ).to.be.revertedWith("ProjectRegistry: would exceed target amount");
    });

    it("Should not allow donations to non-existent projects", async function () {
      const donationAmount = ethers.utils.parseEther("1");

      await expect(
        projectRegistry.connect(user2).donateToProject(999, "Invalid project")
      ).to.be.revertedWith("ProjectRegistry: project does not exist");
    });

    it("Should not allow donations to cancelled projects", async function () {
      await projectRegistry.connect(user1).cancelProject(projectId);

      const donationAmount = ethers.utils.parseEther("1");
      await expect(
        projectRegistry
          .connect(user2)
          .donateToProject(projectId, "Cancelled project")
      ).to.be.revertedWith("ProjectRegistry: project is not active");
    });

    it("Should store donation data correctly", async function () {
      const donationAmount = ethers.utils.parseEther("1");

      await projectRegistry
        .connect(user2)
        .donateToProject(projectId, "Great cause!");

      const donations = await projectRegistry.getProjectDonations(projectId);
      expect(donations.length).to.equal(1);
      expect(donations[0].donor).to.equal(user2.address);
      expect(donations[0].amount).to.equal(donationAmount);
      expect(donations[0].message).to.equal("Great cause!");
      expect(donations[0].timestamp).to.be.gt(0);
    });

    it("Should track user donations", async function () {
      await projectRegistry
        .connect(user2)
        .donateToProject(projectId, "First donation");

      const userDonations = await projectRegistry.getUserDonations(
        user2.address
      );
      expect(userDonations.length).to.equal(1);
      expect(userDonations[0]).to.equal(projectId);
    });
  });

  describe("Milestone Management", function () {
    let projectId;

    beforeEach(async function () {
      const targetAmount = ethers.utils.parseEther("10");
      const endDate = Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60;

      const tx = await projectRegistry
        .connect(user1)
        .createProject(
          "Amazon Rainforest Restoration",
          "Plant 1000 native trees in the Amazon rainforest",
          "Amazon Rainforest, Brazil",
          "tree_planting",
          targetAmount,
          endDate,
          "https://leaf.morphl2.io/images/amazon-project.jpg"
        );

      const receipt = await tx.wait();
      const event = receipt.events.find((e) => e.event === "ProjectCreated");
      projectId = event.args.projectId;
    });

    it("Should allow project creator to add milestones", async function () {
      const milestoneAmount = ethers.utils.parseEther("5");

      await projectRegistry
        .connect(user1)
        .addMilestone(projectId, "Plant 500 trees", milestoneAmount);

      const milestones = await projectRegistry.getProjectMilestones(projectId);
      expect(milestones.length).to.equal(1);
      expect(milestones[0].description).to.equal("Plant 500 trees");
      expect(milestones[0].targetAmount).to.equal(milestoneAmount);
      expect(milestones[0].isCompleted).to.be.false;
    });

    it("Should allow verifier to add milestones", async function () {
      await projectRegistry.addVerifier(verifier.address);
      const milestoneAmount = ethers.utils.parseEther("5");

      await projectRegistry
        .connect(verifier)
        .addMilestone(projectId, "Plant 500 trees", milestoneAmount);

      const milestones = await projectRegistry.getProjectMilestones(projectId);
      expect(milestones.length).to.equal(1);
    });

    it("Should not allow non-creator/non-verifier to add milestones", async function () {
      const milestoneAmount = ethers.utils.parseEther("5");

      await expect(
        projectRegistry
          .connect(user2)
          .addMilestone(projectId, "Plant 500 trees", milestoneAmount)
      ).to.be.revertedWith(
        "ProjectRegistry: only creator or verifier can add milestones"
      );
    });

    it("Should not allow milestone amount exceeding project target", async function () {
      const milestoneAmount = ethers.utils.parseEther("15"); // Exceeds 10 ETH target

      await expect(
        projectRegistry
          .connect(user1)
          .addMilestone(projectId, "Invalid milestone", milestoneAmount)
      ).to.be.revertedWith(
        "ProjectRegistry: milestone amount exceeds project target"
      );
    });

    it("Should allow verifier to complete milestones", async function () {
      await projectRegistry.addVerifier(verifier.address);
      const milestoneAmount = ethers.utils.parseEther("5");

      await projectRegistry
        .connect(user1)
        .addMilestone(projectId, "Plant 500 trees", milestoneAmount);

      // Fund the project first
      await projectRegistry
        .connect(user2)
        .donateToProject(projectId, "Funding");

      const initialBalance = await ethers.provider.getBalance(user1.address);

      await projectRegistry.connect(verifier).completeMilestone(projectId, 0);

      const milestones = await projectRegistry.getProjectMilestones(projectId);
      expect(milestones[0].isCompleted).to.be.true;
      expect(milestones[0].completionDate).to.be.gt(0);
      expect(milestones[0].releasedAmount).to.equal(milestoneAmount);

      // Check that funds were transferred to project creator
      const finalBalance = await ethers.provider.getBalance(user1.address);
      expect(finalBalance).to.be.gt(initialBalance);
    });

    it("Should not allow non-verifier to complete milestones", async function () {
      const milestoneAmount = ethers.utils.parseEther("5");

      await projectRegistry
        .connect(user1)
        .addMilestone(projectId, "Plant 500 trees", milestoneAmount);

      await expect(
        projectRegistry.connect(user2).completeMilestone(projectId, 0)
      ).to.be.revertedWith("ProjectRegistry: caller is not a verifier");
    });

    it("Should not allow completing non-existent milestones", async function () {
      await expect(
        projectRegistry.connect(owner).completeMilestone(projectId, 999)
      ).to.be.revertedWith("ProjectRegistry: milestone does not exist");
    });

    it("Should not allow completing already completed milestones", async function () {
      await projectRegistry.addVerifier(verifier.address);
      const milestoneAmount = ethers.utils.parseEther("5");

      await projectRegistry
        .connect(user1)
        .addMilestone(projectId, "Plant 500 trees", milestoneAmount);

      // Fund the project first
      await projectRegistry
        .connect(user2)
        .donateToProject(projectId, "Funding");

      await projectRegistry.connect(verifier).completeMilestone(projectId, 0);

      await expect(
        projectRegistry.connect(verifier).completeMilestone(projectId, 0)
      ).to.be.revertedWith("ProjectRegistry: milestone already completed");
    });
  });

  describe("Project Verification", function () {
    let projectId;

    beforeEach(async function () {
      const targetAmount = ethers.utils.parseEther("10");
      const endDate = Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60;

      const tx = await projectRegistry
        .connect(user1)
        .createProject(
          "Amazon Rainforest Restoration",
          "Plant 1000 native trees in the Amazon rainforest",
          "Amazon Rainforest, Brazil",
          "tree_planting",
          targetAmount,
          endDate,
          "https://leaf.morphl2.io/images/amazon-project.jpg"
        );

      const receipt = await tx.wait();
      const event = receipt.events.find((e) => e.event === "ProjectCreated");
      projectId = event.args.projectId;
    });

    it("Should allow verifier to verify projects", async function () {
      await projectRegistry.verifyProject(projectId);

      const project = await projectRegistry.getProject(projectId);
      expect(project.isVerified).to.be.true;
    });

    it("Should not allow non-verifier to verify projects", async function () {
      await expect(
        projectRegistry.connect(user1).verifyProject(projectId)
      ).to.be.revertedWith("ProjectRegistry: caller is not a verifier");
    });
  });

  describe("Project Completion", function () {
    let projectId;

    beforeEach(async function () {
      const targetAmount = ethers.utils.parseEther("10");
      const endDate = Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60;

      const tx = await projectRegistry
        .connect(user1)
        .createProject(
          "Amazon Rainforest Restoration",
          "Plant 1000 native trees in the Amazon rainforest",
          "Amazon Rainforest, Brazil",
          "tree_planting",
          targetAmount,
          endDate,
          "https://leaf.morphl2.io/images/amazon-project.jpg"
        );

      const receipt = await tx.wait();
      const event = receipt.events.find((e) => e.event === "ProjectCreated");
      projectId = event.args.projectId;
    });

    it("Should allow verifier to complete funded projects", async function () {
      // Fund the project to target
      await projectRegistry
        .connect(user2)
        .donateToProject(projectId, "Full funding");

      await projectRegistry.completeProject(projectId);

      const project = await projectRegistry.getProject(projectId);
      expect(project.status).to.equal(1); // Completed
    });

    it("Should not allow completing unfunded projects", async function () {
      await expect(
        projectRegistry.completeProject(projectId)
      ).to.be.revertedWith("ProjectRegistry: project target not reached");
    });

    it("Should not allow non-verifier to complete projects", async function () {
      // Fund the project to target
      await projectRegistry
        .connect(user2)
        .donateToProject(projectId, "Full funding");

      await expect(
        projectRegistry.connect(user1).completeProject(projectId)
      ).to.be.revertedWith("ProjectRegistry: caller is not a verifier");
    });
  });

  describe("Project Cancellation", function () {
    let projectId;

    beforeEach(async function () {
      const targetAmount = ethers.utils.parseEther("10");
      const endDate = Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60;

      const tx = await projectRegistry
        .connect(user1)
        .createProject(
          "Amazon Rainforest Restoration",
          "Plant 1000 native trees in the Amazon rainforest",
          "Amazon Rainforest, Brazil",
          "tree_planting",
          targetAmount,
          endDate,
          "https://leaf.morphl2.io/images/amazon-project.jpg"
        );

      const receipt = await tx.wait();
      const event = receipt.events.find((e) => e.event === "ProjectCreated");
      projectId = event.args.projectId;
    });

    it("Should allow project creator to cancel project", async function () {
      await projectRegistry.connect(user1).cancelProject(projectId);

      const project = await projectRegistry.getProject(projectId);
      expect(project.status).to.equal(2); // Cancelled
    });

    it("Should allow verifier to cancel project", async function () {
      await projectRegistry.cancelProject(projectId);

      const project = await projectRegistry.getProject(projectId);
      expect(project.status).to.equal(2); // Cancelled
    });

    it("Should not allow non-creator/non-verifier to cancel project", async function () {
      await expect(
        projectRegistry.connect(user2).cancelProject(projectId)
      ).to.be.revertedWith(
        "ProjectRegistry: only creator or verifier can cancel project"
      );
    });
  });

  describe("Verifier Management", function () {
    it("Should allow owner to add verifier", async function () {
      await projectRegistry.addVerifier(verifier.address);
      expect(await projectRegistry.verifiers(verifier.address)).to.be.true;
    });

    it("Should allow owner to remove verifier", async function () {
      await projectRegistry.addVerifier(verifier.address);
      await projectRegistry.removeVerifier(verifier.address);
      expect(await projectRegistry.verifiers(verifier.address)).to.be.false;
    });

    it("Should not allow non-owner to add verifier", async function () {
      await expect(
        projectRegistry.connect(user1).addVerifier(verifier.address)
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });

    it("Should not allow non-owner to remove verifier", async function () {
      await expect(
        projectRegistry.connect(user1).removeVerifier(verifier.address)
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });
  });

  describe("Project Type Management", function () {
    it("Should allow owner to add valid project type", async function () {
      await projectRegistry.addValidProjectType("new_type");
      expect(await projectRegistry.validProjectTypes("new_type")).to.be.true;
    });

    it("Should not allow non-owner to add valid project type", async function () {
      await expect(
        projectRegistry.connect(user1).addValidProjectType("new_type")
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });
  });

  describe("View Functions", function () {
    beforeEach(async function () {
      // Create multiple projects
      const targetAmount = ethers.utils.parseEther("10");
      const endDate = Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60;

      await projectRegistry
        .connect(user1)
        .createProject(
          "Project 1",
          "Description 1",
          "Location 1",
          "tree_planting",
          targetAmount,
          endDate,
          "https://leaf.morphl2.io/images/project1.jpg"
        );

      await projectRegistry
        .connect(user2)
        .createProject(
          "Project 2",
          "Description 2",
          "Location 2",
          "solar_development",
          targetAmount,
          endDate,
          "https://leaf.morphl2.io/images/project2.jpg"
        );
    });

    it("Should return correct total projects", async function () {
      expect(await projectRegistry.totalProjects()).to.equal(2);
    });

    it("Should return projects by type", async function () {
      const treeProjects = await projectRegistry.getProjectsByType(
        "tree_planting"
      );
      expect(treeProjects.length).to.equal(1);
      expect(treeProjects[0]).to.equal(1);

      const solarProjects = await projectRegistry.getProjectsByType(
        "solar_development"
      );
      expect(solarProjects.length).to.equal(1);
      expect(solarProjects[0]).to.equal(2);
    });

    it("Should return empty array for non-existent project type", async function () {
      const invalidProjects = await projectRegistry.getProjectsByType(
        "invalid_type"
      );
      expect(invalidProjects.length).to.equal(0);
    });
  });
});
