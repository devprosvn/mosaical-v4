import { BrowserProvider, Contract, JsonRpcSigner, formatUnits, parseUnits } from 'ethers';
import { CONTRACT_ADDRESSES } from '../constants/contracts';

// Import ABIs
import NFTVaultABI from '../../src/abi/contracts/NFTVaultV3.sol/NFTVaultV3.json';
import MockGameNFTABI from '../../src/abi/contracts/MockGameNFT.sol/MockGameNFT.json';
import GameFiOracleABI from '../../src/abi/contracts/GameFiOracleV3.sol/GameFiOracleV3.json';
import DPOTokenABI from '../../src/abi/contracts/DPOTokenV3.sol/DPOTokenV3.json';

export class ContractService {
  provider: BrowserProvider;
  signer: JsonRpcSigner | null;
  nftVault: Contract | null;
  mockGameNFT: Contract | null;
  oracle: Contract | null;
  dpoToken: Contract | null;

  constructor(provider: BrowserProvider, signer: JsonRpcSigner | null) {
    this.provider = provider;
    this.signer = signer;
    this.nftVault = null;
    this.mockGameNFT = null;
    this.oracle = null;
    this.dpoToken = null;
    
    this.initContracts();
  }

  initContracts() {
    try {
      // Initialize read-only contracts (with provider)
      this.nftVault = new Contract(
        CONTRACT_ADDRESSES.NFTVault,
        NFTVaultABI.abi,
        this.provider
      );
      
      this.mockGameNFT = new Contract(
        CONTRACT_ADDRESSES.MockGameNFT,
        MockGameNFTABI.abi,
        this.provider
      );
      
      this.oracle = new Contract(
        CONTRACT_ADDRESSES.GameFiOracle,
        GameFiOracleABI.abi,
        this.provider
      );
      
      this.dpoToken = new Contract(
        CONTRACT_ADDRESSES.DPOToken,
        DPOTokenABI.abi,
        this.provider
      );

      // If signer is available, connect contracts for write operations
      if (this.signer) {
        this.nftVault = this.nftVault.connect(this.signer);
        this.mockGameNFT = this.mockGameNFT.connect(this.signer);
        this.oracle = this.oracle.connect(this.signer);
        this.dpoToken = this.dpoToken.connect(this.signer);
      }
    } catch (error) {
      console.error('Error initializing contracts:', error);
    }
  }

  // Get list of supported collections from the vault
  async getSupportedCollections() {
    if (!this.nftVault) throw new Error('NFT Vault contract not initialized');
    
    try {
      // Get the count of supported collections
      const count = await this.nftVault.getSupportedCollectionCount();
      const collections = [];
      
      // Fetch each collection's details
      for (let i = 0; i < Number(count); i++) {
        const address = await this.nftVault.supportedCollections(i);
        const collectionInfo = await this.nftVault.collectionInfo(address);
        
        collections.push({
          address,
          maxLTV: collectionInfo.maxLTV,
          liquidationThreshold: collectionInfo.liquidationThreshold,
          baseInterestRate: collectionInfo.baseInterestRate
        });
      }
      
      return collections;
    } catch (error) {
      console.error('Error getting supported collections:', error);
      throw error;
    }
  }

  // Get NFTs deposited by a user
  async getUserDeposits(userAddress: string) {
    if (!this.nftVault) throw new Error('NFT Vault contract not initialized');
    
    try {
      // Query the depositsByOwner mapping - this emits events so we need to listen to them
      const filter = this.nftVault.filters.NFTDeposited(userAddress);
      const events = await this.nftVault.queryFilter(filter);
      
      // Process events to get unique NFT deposits (handling deposits/withdrawals)
      const deposits = [];
      const withdrawnNFTs = new Set(); // Track withdrawn NFTs
      
      // First, check for withdrawn NFTs
      const withdrawFilter = this.nftVault.filters.NFTWithdrawn(userAddress);
      const withdrawEvents = await this.nftVault.queryFilter(withdrawFilter);
      
      // Add all withdrawn NFTs to our tracking set
      for (const event of withdrawEvents) {
        const { collectionAddress, tokenId } = event.args;
        withdrawnNFTs.add(`${collectionAddress}-${tokenId}`);
      }
      
      // Now process deposit events, excluding those that were later withdrawn
      for (const event of events) {
        const { collectionAddress, tokenId } = event.args;
        const key = `${collectionAddress}-${tokenId}`;
        
        // Skip if this NFT was withdrawn
        if (withdrawnNFTs.has(key)) continue;
        
        // Add to our deposits array
        deposits.push({
          collectionAddress,
          tokenId
        });
      }
      
      return deposits;
    } catch (error) {
      console.error('Error getting user deposits:', error);
      throw error;
    }
  }

  // Deposit NFT into vault
  async depositNFT(collectionAddress: string, tokenId: number | string) {
    if (!this.nftVault || !this.mockGameNFT || !this.signer) 
      throw new Error('Contracts not initialized or signer not available');
    
    try {
      // First approve the vault to transfer the NFT
      console.log(`Approving NFT transfer: Collection ${collectionAddress}, Token ID ${tokenId}`);
      const approveTx = await this.mockGameNFT.approve(CONTRACT_ADDRESSES.NFTVault, tokenId);
      await approveTx.wait();
      
      console.log('Approval successful, now depositing NFT...');
      
      // Then deposit the NFT
      const depositTx = await this.nftVault.depositNFT(collectionAddress, tokenId);
      await depositTx.wait();
      
      console.log('NFT deposit successful!');
      return true;
    } catch (error) {
      console.error('Error depositing NFT:', error);
      throw error;
    }
  }

  // Withdraw NFT from vault
  async withdrawNFT(collectionAddress: string, tokenId: number | string) {
    if (!this.nftVault || !this.signer) 
      throw new Error('NFT Vault contract not initialized or signer not available');
    
    try {
      const tx = await this.nftVault.withdrawNFT(collectionAddress, tokenId);
      await tx.wait();
      return true;
    } catch (error) {
      console.error('Error withdrawing NFT:', error);
      throw error;
    }
  }

  // Get user's position for a specific NFT
  async getUserPosition(userAddress: string, collectionAddress: string, tokenId: number | string) {
    if (!this.nftVault || !this.oracle) 
      throw new Error('Contracts not initialized');
    
    try {
      // Get loan info
      const loanInfo = await this.nftVault.getLoanInfo(collectionAddress, tokenId);
      
      // Get collection info (max LTV, etc.)
      const collectionInfo = await this.nftVault.collectionInfo(collectionAddress);
      
      // Get floor price from oracle
      const floorPrice = await this.oracle.getFloorPrice(collectionAddress);
      
      // Check if this NFT has an active loan
      const hasLoan = loanInfo.borrower !== "0x0000000000000000000000000000000000000000";
      
      // Calculate max borrow based on floor price and maxLTV
      const maxBorrow = floorPrice * collectionInfo.maxLTV / 100n;
      
      // Calculate current LTV if there's an active loan
      let currentLTV = "0";
      let liquidationThreshold = formatUnits(collectionInfo.liquidationThreshold, 0);
      
      if (hasLoan && floorPrice > 0n) {
        currentLTV = ((loanInfo.totalDebt * 100n) / floorPrice).toString();
      }
      
      return {
        maxBorrow,
        totalDebt: loanInfo.borrower === userAddress ? loanInfo.totalDebt : 0n,
        hasLoan: hasLoan && loanInfo.borrower === userAddress,
        currentLTV,
        liquidationThreshold
      };
    } catch (error) {
      console.error('Error getting user position:', error);
      throw error;
    }
  }

  // Borrow against deposited NFT
  async borrow(collectionAddress: string, tokenId: number | string, amount: bigint) {
    if (!this.nftVault || !this.signer) 
      throw new Error('NFT Vault contract not initialized or signer not available');
    
    try {
      const tx = await this.nftVault.borrow(collectionAddress, tokenId, amount);
      await tx.wait();
      return true;
    } catch (error) {
      console.error('Error borrowing against NFT:', error);
      throw error;
    }
  }

  // Repay loan
  async repayLoan(collectionAddress: string, tokenId: number | string, value: bigint) {
    if (!this.nftVault || !this.signer) 
      throw new Error('NFT Vault contract not initialized or signer not available');
    
    try {
      const tx = await this.nftVault.repay(collectionAddress, tokenId, { value });
      await tx.wait();
      return true;
    } catch (error) {
      console.error('Error repaying loan:', error);
      throw error;
    }
  }

  // Admin: Add supported collection
  async addSupportedCollection(
    collectionAddress: string, 
    maxLTV: number, 
    liquidationThreshold: number, 
    baseInterestRate: number
  ) {
    if (!this.nftVault || !this.signer) 
      throw new Error('NFT Vault contract not initialized or signer not available');
    
    try {
      const tx = await this.nftVault.addSupportedCollection(
        collectionAddress,
        maxLTV,
        liquidationThreshold,
        baseInterestRate
      );
      await tx.wait();
      return true;
    } catch (error) {
      console.error('Error adding supported collection:', error);
      throw error;
    }
  }

  // Admin: Update floor price for a collection
  async updateFloorPrice(collectionAddress: string, price: bigint) {
    if (!this.oracle || !this.signer) 
      throw new Error('Oracle contract not initialized or signer not available');
    
    try {
      const tx = await this.oracle.updateFloorPrice(collectionAddress, price);
      await tx.wait();
      return true;
    } catch (error) {
      console.error('Error updating floor price:', error);
      throw error;
    }
  }

  // Admin: Liquidate a loan
  async liquidateLoan(collectionAddress: string, tokenId: number | string) {
    if (!this.nftVault || !this.signer) 
      throw new Error('NFT Vault contract not initialized or signer not available');
    
    try {
      const tx = await this.nftVault.liquidateNFT(collectionAddress, tokenId);
      await tx.wait();
      return true;
    } catch (error) {
      console.error('Error liquidating loan:', error);
      throw error;
    }
  }

  // Admin: Remove supported collection
  async removeSupportedCollection(collectionAddress: string) {
    if (!this.nftVault || !this.signer)
      throw new Error('NFT Vault contract not initialized or signer not available');

    try {
      // Assuming smart-contract has function removeSupportedCollection(address)
      const tx = await (this.nftVault as any).removeSupportedCollection(collectionAddress);
      await tx.wait();
      return true;
    } catch (error) {
      console.error('Error removing supported collection:', error);
      throw error;
    }
  }

  // Get loans at risk of liquidation
  async getLoansAtRisk() {
    if (!this.nftVault || !this.oracle) 
      throw new Error('Contracts not initialized');
    
    try {
      // Get all active loans
      const loanFilter = this.nftVault.filters.LoanCreated();
      const loanEvents = await this.nftVault.queryFilter(loanFilter);
      
      // Get all repayments
      const repayFilter = this.nftVault.filters.LoanRepaid();
      const repayEvents = await this.nftVault.queryFilter(repayFilter);
      
      // Track repaid loans
      const repaidLoans = new Set();
      for (const event of repayEvents) {
        const { collectionAddress, tokenId } = event.args;
        repaidLoans.add(`${collectionAddress}-${tokenId}`);
      }
      
      // Process each loan
      const activeLoans = [];
      for (const event of loanEvents) {
        const { collectionAddress, tokenId, borrower } = event.args;
        const key = `${collectionAddress}-${tokenId}`;
        
        // Skip repaid loans
        if (repaidLoans.has(key)) continue;
        
        // Get loan details
        const loanInfo = await this.nftVault.getLoanInfo(collectionAddress, tokenId);
        if (loanInfo.borrower === "0x0000000000000000000000000000000000000000") continue;
        
        // Get collection info
        const collectionInfo = await this.nftVault.collectionInfo(collectionAddress);
        
        // Get current floor price
        const floorPrice = await this.oracle.getFloorPrice(collectionAddress);
        
        // Calculate current LTV
        let currentLTV = 0;
        if (floorPrice > 0n) {
          currentLTV = Number((loanInfo.totalDebt * 100n) / floorPrice);
        }
        
        // Check if at risk (over liquidation threshold)
        const liquidationThreshold = Number(collectionInfo.liquidationThreshold);
        const isAtRisk = currentLTV >= liquidationThreshold;
        
        if (isAtRisk) {
          activeLoans.push({
            collectionAddress,
            tokenId,
            borrower,
            totalDebt: loanInfo.totalDebt,
            currentLTV,
            liquidationThreshold,
            floorPrice
          });
        }
      }
      
      return activeLoans;
    } catch (error) {
      console.error('Error getting loans at risk:', error);
      throw error;
    }
  }

  // Get wallet balance (needed for repayments)
  async getWalletBalance() {
    if (!this.signer) throw new Error('Signer not available');
    
    try {
      return await this.signer.provider.getBalance(await this.signer.getAddress());
    } catch (error) {
      console.error('Error getting wallet balance:', error);
      throw error;
    }
  }

  // Check if address is contract owner
  async isContractOwner(address: string) {
    if (!this.nftVault) throw new Error('NFT Vault contract not initialized');
    
    try {
      const owner = await this.nftVault.owner();
      return owner.toLowerCase() === address.toLowerCase();
    } catch (error) {
      console.error('Error checking if address is contract owner:', error);
      return false;
    }
  }
} 