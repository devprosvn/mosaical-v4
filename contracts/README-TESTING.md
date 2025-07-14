# Testing Guide for Mosaical Frontend

## NFT Minting for Testing

To test the frontend, you'll need to have NFTs in your wallet. Follow these steps to mint test NFTs:

### 1. Direct NFT Minting
The `direct_mint.js` script uses ethers.js directly to mint NFTs:

```bash
node scripts/direct_mint.js
```

This will mint 5 NFTs with token IDs 0-4 to the address specified in the script.

### 2. Verify NFT Ownership
The `direct_check.js` script verifies ownership and displays NFT metadata:

```bash
node scripts/direct_check.js
```

This will scan token IDs 0-99 and display the ones owned by the specified address.

## Important Parameters

Both scripts use these parameters at the top of the file:

- **NFT_CONTRACT_ADDRESS**: Address of the deployed MockGameNFT contract
- **RECIPIENT_ADDRESS/ADDRESS_TO_CHECK**: Your wallet address to receive/check NFTs
- **RPC_URL**: URL for the Devpros Chainlet

## Frontend Testing Workflow

1. **Mint NFTs** using the script above
2. **Verify ownership** of the NFTs 
3. **Connect wallet** in the frontend
4. **View NFTs** in the MyNFTs component
5. **Deposit NFTs** as collateral
6. **Borrow DPO tokens** against your NFTs
7. **Repay loans** and withdraw NFTs

## Troubleshooting

If you encounter issues with the scripts:

1. Make sure your `.env` file has the correct PRIVATE_KEY
2. Verify the contract addresses are correct
3. Check that you have enough SAGA for gas fees
4. Ensure the contracts are deployed correctly

## Contract Addresses

The frontend uses these contract addresses (configured in `constants/contracts.js`):
- NFTVaultV3: Handles NFT deposits, loans, and withdrawals
- DPOTokenV3: The lending token
- GameFiOracleV3: Provides valuation for NFTs
- MockGameNFT: Test NFTs for development 