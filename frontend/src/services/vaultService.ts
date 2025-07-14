import { BrowserProvider, Contract, Log } from 'ethers';
import { CONTRACT_ADDRESSES } from '../constants/contracts';
import NFTVaultABI from '../../src/abi/contracts/NFTVaultV3.sol/NFTVaultV3.json';
import { getLogsInBatches } from '../utils/getLogsInBatches';

/**
 * Fetch user's deposited NFTs from the vault
 * @param provider Ethers BrowserProvider 
 * @param account User's address
 */
export async function fetchUserDepositedNFTs(provider: BrowserProvider, account: string) {
  try {
    console.log('🔍 Fetching deposited NFTs for:', account);

    const nftVault = new Contract(CONTRACT_ADDRESSES.NFTVault, NFTVaultABI.abi, provider);
    const latest = await provider.getBlockNumber();
    const batch = 9000n;

    // Build filters using Ethers helpers. We will explicitly lock topic[0]
    // to the event signature to avoid nodes returning logs that match only
    // indexed parameters but come from a different event (which leads to
    // "fragment/topic mismatch" during decoding).

    const depositFilter = nftVault.filters.NFTDeposited(account);
    const withdrawFilter = nftVault.filters.NFTWithdrawn(account);

    // Ensure the event signature is enforced as topic[0]
    const depositEventTopic = (nftVault.interface as any).getEventTopic
      ? (nftVault.interface as any).getEventTopic('NFTDeposited')
      : (nftVault.interface as any).getEvent('NFTDeposited').topicHash;
    const withdrawEventTopic = (nftVault.interface as any).getEventTopic
      ? (nftVault.interface as any).getEventTopic('NFTWithdrawn')
      : (nftVault.interface as any).getEvent('NFTWithdrawn').topicHash;

    // Copy the topics array so we can safely mutate it
    const rawDepositTopics: any = (depositFilter as any).topics;
    const rawWithdrawTopics: any = (withdrawFilter as any).topics;

    // If the contract filter failed to include topics (can happen on some setups),
    // fall back to a manually-built topics array.
    const depositTopics: any = Array.isArray(rawDepositTopics) && rawDepositTopics.length
      ? [...rawDepositTopics]
      : [depositEventTopic, null, null, null];
    const withdrawTopics: any = Array.isArray(rawWithdrawTopics) && rawWithdrawTopics.length
      ? [...rawWithdrawTopics]
      : [withdrawEventTopic, null, null, null];

    const [depositLogs, withdrawLogs] = await Promise.all([
      getLogsInBatches(provider, { address: CONTRACT_ADDRESSES.NFTVault, topics: depositTopics }, 0n, BigInt(latest), batch),
      getLogsInBatches(provider, { address: CONTRACT_ADDRESSES.NFTVault, topics: withdrawTopics }, 0n, BigInt(latest), batch)
    ]);

    console.log(`📦 deposit logs: ${depositLogs.length}, withdraw logs: ${withdrawLogs.length}`);

    // Track withdrawn NFTs
    const withdrawnSet = new Set<string>();
    for (const log of withdrawLogs) {
      // Extra guard: some backends may still include rogue logs; skip them.
      if (log.topics[0] !== withdrawEventTopic) continue;
      const decoded = nftVault.interface.decodeEventLog('NFTWithdrawn', log.data, log.topics);
      withdrawnSet.add(`${decoded.collectionAddress}-${decoded.tokenId.toString()}`);
    }

    const deposits: Array<{ collectionAddress: string; tokenId: string; title: string; description: string; image: string }> = [];

    for (const log of depositLogs) {
      if (log.topics[0] !== depositEventTopic) continue; // safety guard
      const decoded = nftVault.interface.decodeEventLog('NFTDeposited', log.data, log.topics);
      const key = `${decoded.collectionAddress}-${decoded.tokenId.toString()}`;
      if (withdrawnSet.has(key)) continue; // already withdrawn
      deposits.push({
        collectionAddress: decoded.collectionAddress,
        tokenId: decoded.tokenId.toString(),
        title: `NFT #${decoded.tokenId.toString()}`,
        description: 'GameFi NFT',
        image: `https://via.placeholder.com/300/6c757d/ffffff?text=NFT+%23${decoded.tokenId}`
      });
    }

    console.log(`🏦 User has ${deposits.length} NFTs currently in vault`);
    return deposits;
  } catch (error) {
    console.error('❌ Error fetching user deposits:', error);
    throw error;
  }
}

// ----------------------
// Helper: getUserPositionDetails (restored)
// ----------------------
export async function getUserPositionDetails(
  provider: BrowserProvider,
  account: string,
  collectionAddress: string,
  tokenId: string | number
) {
  try {
    const nftVault = new Contract(CONTRACT_ADDRESSES.NFTVault, NFTVaultABI.abi, provider);
    const oracle = new Contract(
      CONTRACT_ADDRESSES.GameFiOracle,
      ["function getFloorPrice(address collection) view returns (uint256)"],
      provider
    );

    const [loanInfo, collectionInfo, floorPrice] = await Promise.all([
      nftVault.getLoanInfo(collectionAddress, tokenId),
      nftVault.collectionInfo(collectionAddress),
      oracle.getFloorPrice(collectionAddress)
    ]);

    const hasLoan = loanInfo.borrower !== '0x0000000000000000000000000000000000000000';
    const maxBorrow = floorPrice * BigInt(collectionInfo.maxLTV) / 100n;

    let currentLTV = '0';
    if (hasLoan && floorPrice > 0n) {
      currentLTV = ((loanInfo.totalDebt * 100n) / floorPrice).toString();
    }

    return {
      maxBorrow,
      totalDebt: loanInfo.borrower === account ? loanInfo.totalDebt : 0n,
      hasLoan: hasLoan && loanInfo.borrower === account,
      currentLTV,
      liquidationThreshold: collectionInfo.liquidationThreshold.toString()
    };
  } catch (error) {
    console.error('❌ Error getUserPositionDetails:', error);
    throw error;
  }
}