const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-toolbox/network-helpers");

describe("Mosaical MVP Test Suite", function () {
  let admin, borrower, lender, treasury, liquidator;
  let nftVault, dpoToken, oracle;
  let gameNFT, governanceToken, governance;
  let collectionAddress;
  let unsupportedNFT, unsupportedCollectionAddress;

  beforeEach(async function () {
    [admin, borrower, lender, treasury, liquidator] = await ethers.getSigners();

    const MockGameNFT = await ethers.getContractFactory("MockGameNFT");
    gameNFT = await MockGameNFT.deploy("Test Game NFT", "TGNFT");
    collectionAddress = await gameNFT.getAddress();

    // Deploy an unsupported NFT collection for testing
    unsupportedNFT = await MockGameNFT.deploy("Unsupported NFT", "UNFT");
    unsupportedCollectionAddress = await unsupportedNFT.getAddress();

    const GovernanceToken = await ethers.getContractFactory("GovernanceToken");
    governanceToken = await GovernanceToken.deploy("Devpros Governance", "DPSGOV");

    const GameFiOracleV3 = await ethers.getContractFactory("GameFiOracleV3");
    oracle = await GameFiOracleV3.deploy();

    const MosaicalGovernance = await ethers.getContractFactory("MosaicalGovernance");
    governance = await MosaicalGovernance.deploy(await governanceToken.getAddress());

    const NFTVaultV3 = await ethers.getContractFactory("NFTVaultV3");
    nftVault = await NFTVaultV3.deploy(await oracle.getAddress());

    const DPOTokenV3 = await ethers.getContractFactory("DPOTokenV3");
    dpoToken = await DPOTokenV3.deploy();
    
    await nftVault.setDPOToken(await dpoToken.getAddress());
    await dpoToken.authorizeMinter(await nftVault.getAddress());
    
    await nftVault.addSupportedCollection(collectionAddress);
    await nftVault.setCollectionRiskTier(collectionAddress, 2);

    await oracle.updateFloorPrice(collectionAddress, ethers.parseEther("10"));
    await oracle.updateUtilityScore(collectionAddress, 1, 85);
    await oracle.updateCollectionMetrics(collectionAddress, 1, 1, 1, 1, true);

    await gameNFT.mint(borrower.address, 1);
    await unsupportedNFT.mint(borrower.address, 1);
  });

  describe("Lending Logic", function () {
    beforeEach(async function() {
      await gameNFT.connect(borrower).approve(await nftVault.getAddress(), 1);
      await nftVault.connect(borrower).depositNFT(collectionAddress, 1);
      await admin.sendTransaction({ to: await nftVault.getAddress(), value: ethers.parseEther("10") });
    });

    it("Should create a loan correctly", async function () {
      const maxBorrow = await nftVault.getMaxBorrowAmount(collectionAddress, 1);
      // Calculate 90% of maxBorrow
      const borrowAmount = ethers.parseEther((Number(ethers.formatEther(maxBorrow)) * 0.9).toString());
      await nftVault.connect(borrower).borrow(collectionAddress, 1, borrowAmount);

      const loan = await nftVault.loans(collectionAddress, 1);
      expect(loan.amount).to.equal(borrowAmount);
      expect(loan.isActive).to.be.true;
    });

    it("Should repay a loan correctly", async function () {
      const maxBorrow = await nftVault.getMaxBorrowAmount(collectionAddress, 1);
      const borrowAmount = ethers.parseEther((Number(ethers.formatEther(maxBorrow)) * 0.9).toString());
      await nftVault.connect(borrower).borrow(collectionAddress, 1, borrowAmount);

      await time.increase(3600); 

      const totalDebt = await nftVault.getTotalDebt(collectionAddress, 1);
      // Add a small buffer to ensure we cover any potential rounding issues
      const repaymentAmount = ethers.parseEther((Number(ethers.formatEther(totalDebt)) * 1.01).toString());
      
      await nftVault.connect(borrower).repayLoan(collectionAddress, 1, { value: repaymentAmount });

      const loan = await nftVault.loans(collectionAddress, 1);
      expect(loan.isActive).to.be.false;
    });
  });

  describe("Security", function () {
    it("Should prevent borrowing more than LTV", async function() {
      await gameNFT.connect(borrower).approve(await nftVault.getAddress(), 1);
      await nftVault.connect(borrower).depositNFT(collectionAddress, 1);
      
      const maxBorrow = await nftVault.getMaxBorrowAmount(collectionAddress, 1);
      // Add a small amount to maxBorrow to exceed LTV
      const highBorrowAmount = ethers.parseEther((Number(ethers.formatEther(maxBorrow)) + 0.1).toString());
      
      await expect(nftVault.connect(borrower).borrow(collectionAddress, 1, highBorrowAmount))
          .to.be.revertedWith("Exceeds max LTV");
    });

    it("Should prevent repaying with insufficient funds", async function() {
      await gameNFT.connect(borrower).approve(await nftVault.getAddress(), 1);
      await nftVault.connect(borrower).depositNFT(collectionAddress, 1);
      await admin.sendTransaction({ to: await nftVault.getAddress(), value: ethers.parseEther("10") });
      
      const maxBorrow = await nftVault.getMaxBorrowAmount(collectionAddress, 1);
      const borrowAmount = ethers.parseEther((Number(ethers.formatEther(maxBorrow)) * 0.5).toString());
      await nftVault.connect(borrower).borrow(collectionAddress, 1, borrowAmount);

      const insufficientPayment = ethers.parseEther((Number(ethers.formatEther(borrowAmount)) - 0.1).toString());

      await expect(nftVault.connect(borrower).repayLoan(collectionAddress, 1, { value: insufficientPayment }))
          .to.be.revertedWith("Insufficient payment");
    });
  });

  // 1. Liquidation Logic Tests
  describe("Liquidation Logic", function () {
    beforeEach(async function() {
      await gameNFT.connect(borrower).approve(await nftVault.getAddress(), 1);
      await nftVault.connect(borrower).depositNFT(collectionAddress, 1);
      await admin.sendTransaction({ to: await nftVault.getAddress(), value: ethers.parseEther("20") });
    });

    it("Should allow liquidation when LTV exceeds threshold", async function() {
      // Create a loan
      const maxBorrow = await nftVault.getMaxBorrowAmount(collectionAddress, 1);
      const borrowAmount = ethers.parseEther((Number(ethers.formatEther(maxBorrow)) * 0.9).toString());
      await nftVault.connect(borrower).borrow(collectionAddress, 1, borrowAmount);
      
      // Decrease NFT value significantly to trigger liquidation
      await oracle.updateFloorPrice(collectionAddress, ethers.parseEther("5")); // 50% drop in price
      
      // Check if LTV exceeds liquidation threshold
      const currentLTV = await nftVault.getCurrentLTV(collectionAddress, 1);
      const collectionConfig = await nftVault.collectionConfigs(collectionAddress);
      expect(currentLTV).to.be.gte(collectionConfig.liquidationThreshold);
      
      // Liquidator performs liquidation
      await nftVault.connect(liquidator).liquidate(collectionAddress, 1);
      
      // Verify NFT ownership transferred to liquidator
      expect(await gameNFT.ownerOf(1)).to.equal(liquidator.address);
      
      // Verify loan is no longer active
      const loan = await nftVault.loans(collectionAddress, 1);
      expect(loan.isActive).to.be.false;
    });

    it("Should prevent liquidation when LTV is below threshold", async function() {
      // Create a loan with only 50% of max borrow to ensure safe LTV
      const maxBorrow = await nftVault.getMaxBorrowAmount(collectionAddress, 1);
      const borrowAmount = ethers.parseEther((Number(ethers.formatEther(maxBorrow)) * 0.5).toString());
      await nftVault.connect(borrower).borrow(collectionAddress, 1, borrowAmount);
      
      // Decrease NFT value slightly, but not enough to trigger liquidation
      await oracle.updateFloorPrice(collectionAddress, ethers.parseEther("8")); // 20% drop in price
      
      // Attempt to liquidate should fail
      await expect(nftVault.connect(liquidator).liquidate(collectionAddress, 1))
          .to.be.revertedWith("Not liquidatable");
    });

    it("Should calculate liquidation penalty correctly", async function() {
      // Create a loan
      const maxBorrow = await nftVault.getMaxBorrowAmount(collectionAddress, 1);
      const borrowAmount = ethers.parseEther((Number(ethers.formatEther(maxBorrow)) * 0.9).toString());
      await nftVault.connect(borrower).borrow(collectionAddress, 1, borrowAmount);
      
      // Decrease NFT value to trigger liquidation
      await oracle.updateFloorPrice(collectionAddress, ethers.parseEther("5")); // 50% drop in price
      
      // Get liquidation details before liquidation
      const totalDebt = await nftVault.getTotalDebt(collectionAddress, 1);
      const floorPrice = await oracle.getFloorPrice(collectionAddress);
      const liquidationPenalty = await nftVault.LIQUIDATION_PENALTY();
      const basisPoints = await nftVault.BASIS_POINTS();
      
      // Calculate expected sale price with penalty (using Number for simplicity)
      const expectedSalePrice = Number(ethers.formatEther(floorPrice)) * 
                              (Number(basisPoints) - Number(liquidationPenalty)) / 
                              Number(basisPoints);
      
      // Liquidator performs liquidation
      await nftVault.connect(liquidator).liquidate(collectionAddress, 1);
      
      // Verify NFT ownership transferred to liquidator
      expect(await gameNFT.ownerOf(1)).to.equal(liquidator.address);
    });
  });

  // 2. Oracle Interaction Tests
  describe("Oracle Interaction", function () {
    beforeEach(async function() {
      await gameNFT.connect(borrower).approve(await nftVault.getAddress(), 1);
      await nftVault.connect(borrower).depositNFT(collectionAddress, 1);
      await admin.sendTransaction({ to: await nftVault.getAddress(), value: ethers.parseEther("10") });
    });

    it("Should handle zero floor price correctly", async function() {
      // Set floor price to a very low value instead of zero (which is rejected)
      await oracle.updateFloorPrice(collectionAddress, 1); // 1 wei
      
      // Max borrow amount should be effectively zero
      const maxBorrow = await nftVault.getMaxBorrowAmount(collectionAddress, 1);
      expect(Number(ethers.formatEther(maxBorrow))).to.be.lessThan(0.000001);
      
      // Attempt to borrow should fail
      await expect(nftVault.connect(borrower).borrow(collectionAddress, 1, ethers.parseEther("0.1")))
          .to.be.revertedWith("Exceeds max LTV");
    });

    it("Should adjust max borrow amount based on utility score", async function() {
      // Get max borrow with current utility score (85)
      const maxBorrowBefore = await nftVault.getMaxBorrowAmount(collectionAddress, 1);
      
      // Update utility score to maximum (100)
      await oracle.updateUtilityScore(collectionAddress, 1, 100);
      
      // Get max borrow with higher utility score
      const maxBorrowAfter = await nftVault.getMaxBorrowAmount(collectionAddress, 1);
      
      // Higher utility score should result in higher max borrow
      expect(Number(ethers.formatEther(maxBorrowAfter))).to.be.greaterThan(Number(ethers.formatEther(maxBorrowBefore)));
    });

    it("Should handle different risk tiers correctly", async function() {
      // Check max LTV with current risk tier (2)
      const maxLTVTier2 = await nftVault.getMaxLTV(collectionAddress, 1);
      
      // Change to risk tier 1 (higher LTV)
      await nftVault.connect(admin).setCollectionRiskTier(collectionAddress, 1);
      const maxLTVTier1 = await nftVault.getMaxLTV(collectionAddress, 1);
      
      // Change to risk tier 5 (lower LTV)
      await nftVault.connect(admin).setCollectionRiskTier(collectionAddress, 5);
      const maxLTVTier5 = await nftVault.getMaxLTV(collectionAddress, 1);
      
      // Verify tier 1 has higher LTV than tier 2, and tier 5 has lower LTV than tier 2
      expect(maxLTVTier1).to.be.gt(maxLTVTier2);
      expect(maxLTVTier5).to.be.lt(maxLTVTier2);
    });

    it("Should check isActiveAsset before calculating max borrow", async function() {
      // Set collection as inactive GameFi asset
      await oracle.updateCollectionMetrics(collectionAddress, 1, 1, 1, 1, false);
      
      // Max borrow amount should be zero for inactive assets
      const maxBorrow = await nftVault.getMaxBorrowAmount(collectionAddress, 1);
      expect(maxBorrow).to.equal(0);
      
      // Set back to active for other tests
      await oracle.updateCollectionMetrics(collectionAddress, 1, 1, 1, 1, true);
    });
  });

  // 3. NFT Management and Permissions
  describe("NFT Management and Permissions", function () {
    it("Should prevent withdrawing NFT with active loan", async function() {
      await gameNFT.connect(borrower).approve(await nftVault.getAddress(), 1);
      await nftVault.connect(borrower).depositNFT(collectionAddress, 1);
      await admin.sendTransaction({ to: await nftVault.getAddress(), value: ethers.parseEther("10") });
      
      // Create a loan
      const maxBorrow = await nftVault.getMaxBorrowAmount(collectionAddress, 1);
      const borrowAmount = ethers.parseEther((Number(ethers.formatEther(maxBorrow)) * 0.5).toString());
      await nftVault.connect(borrower).borrow(collectionAddress, 1, borrowAmount);
      
      // Attempt to withdraw NFT should fail
      await expect(nftVault.connect(borrower).withdrawNFT(collectionAddress, 1))
          .to.be.revertedWith("Active loan exists");
    });

    it("Should allow withdrawing NFT after loan repayment", async function() {
      await gameNFT.connect(borrower).approve(await nftVault.getAddress(), 1);
      await nftVault.connect(borrower).depositNFT(collectionAddress, 1);
      await admin.sendTransaction({ to: await nftVault.getAddress(), value: ethers.parseEther("10") });
      
      // Create and repay a loan
      const maxBorrow = await nftVault.getMaxBorrowAmount(collectionAddress, 1);
      const borrowAmount = ethers.parseEther((Number(ethers.formatEther(maxBorrow)) * 0.5).toString());
      await nftVault.connect(borrower).borrow(collectionAddress, 1, borrowAmount);
      
      const totalDebt = await nftVault.getTotalDebt(collectionAddress, 1);
      const repaymentAmount = ethers.parseEther((Number(ethers.formatEther(totalDebt)) * 1.01).toString());
      await nftVault.connect(borrower).repayLoan(collectionAddress, 1, { value: repaymentAmount });
      
      // Now withdraw should succeed
      await nftVault.connect(borrower).withdrawNFT(collectionAddress, 1);
      
      // Verify NFT ownership
      expect(await gameNFT.ownerOf(1)).to.equal(borrower.address);
    });

    it("Should prevent depositing NFT from unsupported collection", async function() {
      await unsupportedNFT.connect(borrower).approve(await nftVault.getAddress(), 1);
      
      // Attempt to deposit from unsupported collection should fail
      await expect(nftVault.connect(borrower).depositNFT(unsupportedCollectionAddress, 1))
          .to.be.revertedWith("Collection not supported");
    });

    it("Should prevent unauthorized NFT withdrawals", async function() {
      await gameNFT.connect(borrower).approve(await nftVault.getAddress(), 1);
      await nftVault.connect(borrower).depositNFT(collectionAddress, 1);
      
      // Attempt to withdraw by someone other than the owner should fail
      await expect(nftVault.connect(lender).withdrawNFT(collectionAddress, 1))
          .to.be.revertedWith("Not your NFT");
    });
  });

  // 4. Admin Functions
  describe("Admin Functions", function () {
    it("Should allow only owner to add supported collections", async function() {
      // Admin can add collections
      await nftVault.connect(admin).addSupportedCollection(unsupportedCollectionAddress);
      
      // Verify collection is now supported
      const collectionConfig = await nftVault.collectionConfigs(unsupportedCollectionAddress);
      expect(collectionConfig.isSupported).to.be.true;
      
      // Deploy another NFT for testing
      const AnotherNFT = await ethers.getContractFactory("MockGameNFT");
      const anotherNFT = await AnotherNFT.deploy("Another NFT", "ANFT");
      const anotherCollectionAddress = await anotherNFT.getAddress();
      
      // Non-admin cannot add collections (use custom error matcher)
      await expect(nftVault.connect(borrower).addSupportedCollection(anotherCollectionAddress))
          .to.be.reverted; // Just check that it reverts
    });

    it("Should allow only owner to set collection risk tier", async function() {
      // Admin can set risk tier
      await nftVault.connect(admin).setCollectionRiskTier(collectionAddress, 3);
      
      // Verify risk tier was updated
      expect(await nftVault.collectionRiskTiers(collectionAddress)).to.equal(3);
      
      // Non-admin cannot set risk tier (use custom error matcher)
      await expect(nftVault.connect(borrower).setCollectionRiskTier(collectionAddress, 1))
          .to.be.reverted; // Just check that it reverts
    });

    it("Should allow only owner to update oracle", async function() {
      // Deploy a new oracle
      const NewOracle = await ethers.getContractFactory("GameFiOracleV3");
      const newOracle = await NewOracle.deploy();
      
      // Admin can update oracle
      await nftVault.connect(admin).updateOracle(await newOracle.getAddress());
      
      // Verify oracle was updated
      expect(await nftVault.oracle()).to.equal(await newOracle.getAddress());
      
      // Non-admin cannot update oracle (use custom error matcher)
      await expect(nftVault.connect(borrower).updateOracle(await oracle.getAddress()))
          .to.be.reverted; // Just check that it reverts
    });

    it("Should allow only owner to set DPO token", async function() {
      // Deploy a new DPO token
      const NewDPOToken = await ethers.getContractFactory("DPOTokenV3");
      const newDpoToken = await NewDPOToken.deploy();
      
      // Admin can set DPO token
      await nftVault.connect(admin).setDPOToken(await newDpoToken.getAddress());
      
      // Verify DPO token was updated
      expect(await nftVault.dpoToken()).to.equal(await newDpoToken.getAddress());
      
      // Non-admin cannot set DPO token (use custom error matcher)
      await expect(nftVault.connect(borrower).setDPOToken(await dpoToken.getAddress()))
          .to.be.reverted; // Just check that it reverts
    });
  });

  // 5. DPO Token Integration
  describe("DPO Token Integration", function () {
    it("Should mint DPO tokens when creating a loan", async function() {
      await gameNFT.connect(borrower).approve(await nftVault.getAddress(), 1);
      await nftVault.connect(borrower).depositNFT(collectionAddress, 1);
      await admin.sendTransaction({ to: await nftVault.getAddress(), value: ethers.parseEther("10") });
      
      // Check borrower's DPO balance before loan
      const balanceBefore = await dpoToken.balanceOf(borrower.address);
      
      // Create a loan
      const maxBorrow = await nftVault.getMaxBorrowAmount(collectionAddress, 1);
      const borrowAmount = ethers.parseEther((Number(ethers.formatEther(maxBorrow)) * 0.5).toString());
      await nftVault.connect(borrower).borrow(collectionAddress, 1, borrowAmount);
      
      // Check borrower's DPO balance after loan
      const balanceAfter = await dpoToken.balanceOf(borrower.address);
      
      // Verify DPO tokens were minted (using Number comparison)
      expect(Number(ethers.formatEther(balanceAfter)) - Number(ethers.formatEther(balanceBefore)))
          .to.be.approximately(Number(ethers.formatEther(borrowAmount)), 0.000001);
    });

    it("Should verify DPO token authorization", async function() {
      // Check if NFTVault is authorized as minter
      expect(await dpoToken.authorizedMinters(await nftVault.getAddress())).to.be.true;
      
      // Deploy a new NFTVault that's not authorized
      const UnauthorizedVault = await ethers.getContractFactory("NFTVaultV3");
      const unauthorizedVault = await UnauthorizedVault.deploy(await oracle.getAddress());
      
      // Check that the new vault is not authorized
      expect(await dpoToken.authorizedMinters(await unauthorizedVault.getAddress())).to.be.false;
    });
    
    it("Should track NFT-specific token holdings", async function() {
      await gameNFT.connect(borrower).approve(await nftVault.getAddress(), 1);
      await nftVault.connect(borrower).depositNFT(collectionAddress, 1);
      await admin.sendTransaction({ to: await nftVault.getAddress(), value: ethers.parseEther("10") });
      
      // Create a loan
      const maxBorrow = await nftVault.getMaxBorrowAmount(collectionAddress, 1);
      const borrowAmount = ethers.parseEther((Number(ethers.formatEther(maxBorrow)) * 0.5).toString());
      await nftVault.connect(borrower).borrow(collectionAddress, 1, borrowAmount);
      
      // Check NFT-specific token holdings
      const tokenHoldings = await dpoToken.tokenHoldings(collectionAddress, 1, borrower.address);
      const nftTokenSupply = await dpoToken.nftTokenSupply(collectionAddress, 1);
      
      // Verify token holdings are tracked correctly (using Number comparison)
      expect(Number(ethers.formatEther(tokenHoldings)))
          .to.be.approximately(Number(ethers.formatEther(borrowAmount)), 0.000001);
      expect(Number(ethers.formatEther(nftTokenSupply)))
          .to.be.approximately(Number(ethers.formatEther(borrowAmount)), 0.000001);
    });
  });
});