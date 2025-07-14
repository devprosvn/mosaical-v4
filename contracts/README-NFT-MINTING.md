# NFT Minting Instructions

Follow these steps to mint NFTs using the provided scripts:

## Setup

1. Create a `.env` file in the `src` directory with the following content:
   ```
   RPC_URL=https://devpros-2749656616387000-1.jsonrpc.sagarpc.io
   PRIVATE_KEY=YOUR_PRIVATE_KEY_HERE
   ```
   
   Replace `YOUR_PRIVATE_KEY_HERE` with the private key of the account that deployed the contracts.

## Available Scripts

We've created three scripts for working with NFTs:

### 1. Mint NFTs with Specified IDs

Use this script when you want to mint NFTs with specific token IDs:

```bash
cd src
npx hardhat run scripts/mint_nfts.js --network devpros
```

Before running, edit `scripts/mint_nfts.js` and update:
- `RECIPIENT_ADDRESS`: The wallet address where you want to receive the NFTs
- You can also adjust the number of NFTs to mint in the script

### 2. Automatically Mint NFTs with Sequential IDs

Use this script to mint NFTs with automatically assigned sequential token IDs:

```bash
cd src
npx hardhat run scripts/safe_mint_nfts.js --network devpros
```

Before running, edit `scripts/safe_mint_nfts.js` and update:
- `RECIPIENT_ADDRESS`: The wallet address where you want to receive the NFTs
- Adjust the `numberOfNFTs` variable if you want to mint more or fewer NFTs

### 3. Check NFT Ownership

Use this script to check which NFTs an address owns:

```bash
cd src
npx hardhat run scripts/check_nfts.js --network devpros
```

Before running, edit `scripts/check_nfts.js` and update:
- `ADDRESS_TO_CHECK`: The wallet address you want to check for NFT ownership

## Integrating with Frontend

After minting NFTs, you can use the frontend to:

1. Connect your wallet (same as the `RECIPIENT_ADDRESS` you used for minting)
2. View your NFTs in the "My NFTs" tab
3. Deposit them into the vault
4. Borrow against them
5. Repay loans and withdraw your NFTs

The frontend is already configured to connect to the deployed contracts. 