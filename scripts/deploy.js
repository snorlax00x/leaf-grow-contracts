const { ethers, upgrades } = require("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying contracts with the account:", deployer.address);
  console.log("Account balance:", (await deployer.getBalance()).toString());

  // Deploy LeafToken
  console.log("\nDeploying LeafToken...");
  const LeafToken = await ethers.getContractFactory("LeafToken");
  const leafToken = await LeafToken.deploy(deployer.address);
  await leafToken.deployed();
  console.log("LeafToken deployed to:", leafToken.address);

  // Deploy PlantNFT
  console.log("\nDeploying PlantNFT...");
  const PlantNFT = await ethers.getContractFactory("PlantNFT");
  const plantNFT = await PlantNFT.deploy(deployer.address);
  await plantNFT.deployed();
  console.log("PlantNFT deployed to:", plantNFT.address);

  // Deploy ProjectRegistry
  console.log("\nDeploying ProjectRegistry...");
  const ProjectRegistry = await ethers.getContractFactory("ProjectRegistry");
  const projectRegistry = await ProjectRegistry.deploy(deployer.address);
  await projectRegistry.deployed();
  console.log("ProjectRegistry deployed to:", projectRegistry.address);

  // Deploy TimelockController for DAO
  console.log("\nDeploying TimelockController...");
  const TimelockController = await ethers.getContractFactory(
    "TimelockController"
  );
  const timelock = await TimelockController.deploy(
    60, // minimum delay in seconds
    [deployer.address], // proposers
    [deployer.address], // executors
    deployer.address // admin
  );
  await timelock.deployed();
  console.log("TimelockController deployed to:", timelock.address);

  // Deploy LeafDAO
  console.log("\nDeploying LeafDAO...");
  const LeafDAO = await ethers.getContractFactory("LeafDAO");
  const leafDAO = await LeafDAO.deploy(
    leafToken.address,
    timelock.address,
    4 // 4% quorum
  );
  await leafDAO.deployed();
  console.log("LeafDAO deployed to:", leafDAO.address);

  // Deploy LeafCore
  console.log("\nDeploying LeafCore...");
  const LeafCore = await ethers.getContractFactory("LeafCore");
  const leafCore = await LeafCore.deploy(
    leafToken.address,
    plantNFT.address,
    projectRegistry.address,
    leafDAO.address,
    deployer.address
  );
  await leafCore.deployed();
  console.log("LeafCore deployed to:", leafCore.address);

  // Setup permissions and roles
  console.log("\nSetting up permissions...");

  // Grant minter role to LeafCore for LeafToken
  await leafToken.addMinter(leafCore.address);
  console.log("Granted minter role to LeafCore for LeafToken");

  // Grant minter role to LeafCore for PlantNFT
  await plantNFT.addMinter(leafCore.address);
  console.log("Granted minter role to LeafCore for PlantNFT");

  // Grant verifier role to LeafCore for ProjectRegistry
  await projectRegistry.addVerifier(leafCore.address);
  console.log("Granted verifier role to LeafCore for ProjectRegistry");

  // Grant operator role to LeafCore for itself
  await leafCore.addOperator(leafCore.address);
  console.log("Granted operator role to LeafCore");

  // Setup TimelockController roles
  const proposerRole = await timelock.PROPOSER_ROLE();
  const executorRole = await timelock.EXECUTOR_ROLE();
  const adminRole = await timelock.DEFAULT_ADMIN_ROLE();

  await timelock.grantRole(proposerRole, leafDAO.address);
  console.log("Granted proposer role to LeafDAO");

  await timelock.grantRole(executorRole, leafDAO.address);
  console.log("Granted executor role to LeafDAO");

  await timelock.revokeRole(adminRole, deployer.address);
  console.log("Revoked admin role from deployer");

  // Create some sample projects
  console.log("\nCreating sample projects...");

  // Sample tree planting project
  const treeProjectId = await projectRegistry.createProject(
    "Amazon Rainforest Restoration",
    "Plant 1000 native trees in the Amazon rainforest to restore biodiversity and combat climate change",
    "Amazon Rainforest, Brazil",
    "tree_planting",
    ethers.parseEther("10"), // 10 ETH target
    Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60, // 30 days from now
    "https://leaf.morphl2.io/images/amazon-project.jpg"
  );
  console.log(
    "Created Amazon Rainforest project with ID:",
    treeProjectId.toString()
  );

  // Sample solar development project
  const solarProjectId = await projectRegistry.createProject(
    "Community Solar Farm",
    "Install solar panels in rural communities to provide clean energy and reduce carbon emissions",
    "Rural India",
    "solar_development",
    ethers.parseEther("5"), // 5 ETH target
    Math.floor(Date.now() / 1000) + 60 * 24 * 60 * 60, // 60 days from now
    "https://leaf.morphl2.io/images/solar-project.jpg"
  );
  console.log(
    "Created Community Solar Farm project with ID:",
    solarProjectId.toString()
  );

  // Sample conservation project
  const conservationProjectId = await projectRegistry.createProject(
    "Coral Reef Protection",
    "Protect and restore coral reefs in the Great Barrier Reef through monitoring and restoration efforts",
    "Great Barrier Reef, Australia",
    "conservation",
    ethers.parseEther("8"), // 8 ETH target
    Math.floor(Date.now() / 1000) + 45 * 24 * 60 * 60, // 45 days from now
    "https://leaf.morphl2.io/images/coral-project.jpg"
  );
  console.log(
    "Created Coral Reef Protection project with ID:",
    conservationProjectId.toString()
  );

  // Verify the sample projects
  await projectRegistry.verifyProject(treeProjectId);
  await projectRegistry.verifyProject(solarProjectId);
  await projectRegistry.verifyProject(conservationProjectId);
  console.log("Verified all sample projects");

  // Add milestones to projects
  await projectRegistry.addMilestone(
    treeProjectId,
    "Site preparation and soil analysis",
    ethers.parseEther("2")
  );
  await projectRegistry.addMilestone(
    treeProjectId,
    "Plant 500 trees",
    ethers.parseEther("4")
  );
  await projectRegistry.addMilestone(
    treeProjectId,
    "Plant remaining 500 trees and initial maintenance",
    ethers.parseEther("4")
  );

  await projectRegistry.addMilestone(
    solarProjectId,
    "Site survey and planning",
    ethers.parseEther("1")
  );
  await projectRegistry.addMilestone(
    solarProjectId,
    "Install solar panels",
    ethers.parseEther("3")
  );
  await projectRegistry.addMilestone(
    solarProjectId,
    "Connect to grid and community training",
    ethers.parseEther("1")
  );

  console.log("Added milestones to sample projects");

  // Save deployment addresses
  const deploymentInfo = {
    network: hre.network.name,
    deployer: deployer.address,
    contracts: {
      leafToken: leafToken.address,
      plantNFT: plantNFT.address,
      projectRegistry: projectRegistry.address,
      timelockController: timelock.address,
      leafDAO: leafDAO.address,
      leafCore: leafCore.address,
    },
    sampleProjects: {
      amazonRainforest: treeProjectId.toString(),
      communitySolar: solarProjectId.toString(),
      coralReef: conservationProjectId.toString(),
    },
    deploymentTime: new Date().toISOString(),
  };

  console.log("\n=== DEPLOYMENT SUMMARY ===");
  console.log("Network:", deploymentInfo.network);
  console.log("Deployer:", deploymentInfo.deployer);
  console.log("\nContract Addresses:");
  console.log("LeafToken:", deploymentInfo.contracts.leafToken);
  console.log("PlantNFT:", deploymentInfo.contracts.plantNFT);
  console.log("ProjectRegistry:", deploymentInfo.contracts.projectRegistry);
  console.log(
    "TimelockController:",
    deploymentInfo.contracts.timelockController
  );
  console.log("LeafDAO:", deploymentInfo.contracts.leafDAO);
  console.log("LeafCore:", deploymentInfo.contracts.leafCore);
  console.log("\nSample Projects:");
  console.log(
    "Amazon Rainforest (ID:",
    deploymentInfo.sampleProjects.amazonRainforest + ")"
  );
  console.log(
    "Community Solar Farm (ID:",
    deploymentInfo.sampleProjects.communitySolar + ")"
  );
  console.log(
    "Coral Reef Protection (ID:",
    deploymentInfo.sampleProjects.coralReef + ")"
  );

  // Save to file
  const fs = require("fs");
  fs.writeFileSync(
    `deployment-${hre.network.name}.json`,
    JSON.stringify(deploymentInfo, null, 2)
  );
  console.log(`\nDeployment info saved to deployment-${hre.network.name}.json`);

  console.log("\n=== NEXT STEPS ===");
  console.log("1. Verify contracts on block explorer");
  console.log("2. Set up frontend to interact with contracts");
  console.log("3. Configure AI recommendation system");
  console.log("4. Set up monitoring and analytics");
  console.log("5. Launch community governance");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
