const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("LeafToken", function () {
  let LeafToken;
  let leafToken;
  let owner;
  let user1;
  let user2;
  let minter;

  beforeEach(async function () {
    [owner, user1, user2, minter] = await ethers.getSigners();

    LeafToken = await ethers.getContractFactory("LeafToken");
    leafToken = await LeafToken.deploy(owner.address);
    await leafToken.deployed();
  });

  describe("Deployment", function () {
    it("Should set the right owner", async function () {
      expect(await leafToken.owner()).to.equal(owner.address);
    });

    it("Should mint initial supply to owner", async function () {
      const initialSupply = ethers.utils.parseEther("1000000"); // 1 million tokens
      expect(await leafToken.totalSupply()).to.equal(initialSupply);
      expect(await leafToken.balanceOf(owner.address)).to.equal(initialSupply);
    });

    it("Should set owner as minter", async function () {
      expect(await leafToken.minters(owner.address)).to.be.true;
    });

    it("Should have correct name and symbol", async function () {
      expect(await leafToken.name()).to.equal("Leaf DAO Token");
      expect(await leafToken.symbol()).to.equal("LEAF");
    });
  });

  describe("Minting", function () {
    it("Should allow owner to mint tokens", async function () {
      const mintAmount = ethers.utils.parseEther("1000");
      await leafToken.mint(user1.address, mintAmount, "test_reason");

      expect(await leafToken.balanceOf(user1.address)).to.equal(mintAmount);
    });

    it("Should allow minter to mint tokens", async function () {
      await leafToken.addMinter(minter.address);
      const mintAmount = ethers.utils.parseEther("500");

      await leafToken
        .connect(minter)
        .mint(user1.address, mintAmount, "minter_test");
      expect(await leafToken.balanceOf(user1.address)).to.equal(mintAmount);
    });

    it("Should not allow non-minter to mint tokens", async function () {
      const mintAmount = ethers.utils.parseEther("1000");

      await expect(
        leafToken.connect(user1).mint(user2.address, mintAmount, "test")
      ).to.be.revertedWith("LeafToken: caller is not a minter");
    });

    it("Should not exceed max supply", async function () {
      const maxSupply = ethers.utils.parseEther("10000000"); // 10 million
      const currentSupply = await leafToken.totalSupply();
      const remainingSupply = maxSupply.sub(currentSupply);
      const exceedAmount = remainingSupply.add(ethers.utils.parseEther("1"));

      await expect(
        leafToken.mint(user1.address, exceedAmount, "test")
      ).to.be.revertedWith("LeafToken: would exceed max supply");
    });

    it("Should emit TokensMinted event", async function () {
      const mintAmount = ethers.utils.parseEther("1000");

      await expect(leafToken.mint(user1.address, mintAmount, "test_reason"))
        .to.emit(leafToken, "TokensMinted")
        .withArgs(user1.address, mintAmount, "test_reason");
    });
  });

  describe("Burning", function () {
    beforeEach(async function () {
      await leafToken.mint(
        user1.address,
        ethers.utils.parseEther("1000"),
        "test"
      );
    });

    it("Should allow minter to burn tokens", async function () {
      const burnAmount = ethers.utils.parseEther("500");
      const initialBalance = await leafToken.balanceOf(user1.address);

      await leafToken.burn(user1.address, burnAmount, "burn_test");
      expect(await leafToken.balanceOf(user1.address)).to.equal(
        initialBalance.sub(burnAmount)
      );
    });

    it("Should not allow non-minter to burn tokens", async function () {
      const burnAmount = ethers.utils.parseEther("500");

      await expect(
        leafToken.connect(user1).burn(user1.address, burnAmount, "test")
      ).to.be.revertedWith("LeafToken: caller is not a minter");
    });

    it("Should emit TokensBurned event", async function () {
      const burnAmount = ethers.utils.parseEther("500");

      await expect(leafToken.burn(user1.address, burnAmount, "burn_test"))
        .to.emit(leafToken, "TokensBurned")
        .withArgs(user1.address, burnAmount, "burn_test");
    });
  });

  describe("Minter Management", function () {
    it("Should allow owner to add minter", async function () {
      await leafToken.addMinter(minter.address);
      expect(await leafToken.minters(minter.address)).to.be.true;
    });

    it("Should allow owner to remove minter", async function () {
      await leafToken.addMinter(minter.address);
      await leafToken.removeMinter(minter.address);
      expect(await leafToken.minters(minter.address)).to.be.false;
    });

    it("Should not allow non-owner to add minter", async function () {
      await expect(
        leafToken.connect(user1).addMinter(minter.address)
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });

    it("Should not allow non-owner to remove minter", async function () {
      await expect(
        leafToken.connect(user1).removeMinter(minter.address)
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });
  });

  describe("Voting", function () {
    beforeEach(async function () {
      await leafToken.mint(
        user1.address,
        ethers.utils.parseEther("1000"),
        "test"
      );
      await leafToken.mint(
        user2.address,
        ethers.utils.parseEther("500"),
        "test"
      );
    });

    it("Should track voting power correctly", async function () {
      const user1Votes = await leafToken.getVotes(user1.address);
      const user2Votes = await leafToken.getVotes(user2.address);

      expect(user1Votes).to.equal(ethers.utils.parseEther("1000"));
      expect(user2Votes).to.equal(ethers.utils.parseEther("500"));
    });

    it("Should track past votes correctly", async function () {
      const currentBlock = await ethers.provider.getBlockNumber();
      const user1PastVotes = await leafToken.getPastVotes(
        user1.address,
        currentBlock
      );

      expect(user1PastVotes).to.equal(ethers.utils.parseEther("1000"));
    });

    it("Should handle delegation", async function () {
      await leafToken.connect(user1).delegate(user2.address);
      const user2Votes = await leafToken.getVotes(user2.address);

      expect(user2Votes).to.equal(ethers.utils.parseEther("1500")); // 1000 + 500
    });
  });

  describe("Permit", function () {
    it("Should allow permit for approval", async function () {
      const deadline = Math.floor(Date.now() / 1000) + 3600; // 1 hour from now
      const nonce = await leafToken.nonces(user1.address);
      const domain = {
        name: "Leaf DAO Token",
        version: "1",
        chainId: await ethers.provider.getNetwork().then((n) => n.chainId),
        verifyingContract: leafToken.address,
      };

      const types = {
        Permit: [
          { name: "owner", type: "address" },
          { name: "spender", type: "address" },
          { name: "value", type: "uint256" },
          { name: "nonce", type: "uint256" },
          { name: "deadline", type: "uint256" },
        ],
      };

      const value = {
        owner: user1.address,
        spender: user2.address,
        value: ethers.utils.parseEther("100"),
        nonce: nonce,
        deadline: deadline,
      };

      const signature = await user1._signTypedData(domain, types, value);
      const { v, r, s } = ethers.utils.splitSignature(signature);

      await leafToken.permit(
        user1.address,
        user2.address,
        ethers.utils.parseEther("100"),
        deadline,
        v,
        r,
        s
      );

      expect(await leafToken.allowance(user1.address, user2.address)).to.equal(
        ethers.utils.parseEther("100")
      );
    });
  });
});
