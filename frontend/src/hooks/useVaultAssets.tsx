import { createSignal, createEffect } from 'solid-js';
import { useWeb3 } from '../stores/Web3Store';
import { useContracts } from './useContracts';
import { fetchUserDepositedNFTs, getUserPositionDetails } from '../services/vaultService';

/**
 * Custom hook to fetch and manage vault assets (NFTs deposited as collateral)
 * This serves as the single source of truth for NFT vault data across the app
 * 
 * @param refreshTrigger - Increment this value to force a refresh
 * @returns Object containing assets, loading state, and error
 */
export function useVaultAssets(refreshTrigger = 0) {
  const web3 = useWeb3();
  const { contractService } = useContracts();
  
  const [assets, setAssets] = createSignal<any[]>([]);
  const [refreshTick, setRefreshTick] = createSignal(0);
  const [isLoading, setIsLoading] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);
  const [userPositions, setUserPositions] = createSignal<Record<string, any>>({});

  // Load assets whenever account, provider, or refresh trigger changes
  createEffect(() => {
    const account = web3.account();
    const provider = web3.provider();
    
    // Create a value to trigger the effect when refreshTick changes
    const refresh = refreshTick();
    const externalRefresh = refreshTrigger;
    
    const fetchAndProcessAssets = async () => {
      if (!account || !provider) {
        console.log("⚠️ [useVaultAssets] Missing account or provider");
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        console.log("1️⃣ [useVaultAssets] Starting to fetch assets for account:", account);
        
        // Use our direct scanning function from vaultService.js
        const deposits = await fetchUserDepositedNFTs(provider, account);
        console.log("2️⃣ [useVaultAssets] Found deposits:", deposits);
        
        if (!deposits || deposits.length === 0) {
          console.log("⚠️ [useVaultAssets] No deposits found");
          setAssets([]);
          setIsLoading(false);
          return;
        }
        
        // Fetch position for each deposited NFT
        const assetsWithMetadata = await Promise.all(
          deposits.map(async (deposit) => {
            try {
              console.log(`3️⃣ [useVaultAssets] Processing deposited NFT #${deposit.tokenId}...`);
              
              // Get position using our custom function
              const position = await getUserPositionDetails(
                provider,
                account,
                deposit.collectionAddress,
                deposit.tokenId
              );
              
              // Store position in state
              setUserPositions(prev => ({
                ...prev,
                [`${deposit.collectionAddress}-${deposit.tokenId}`]: position
              }));
              
              // Ensure the NFT object has the right structure for other components
              return {
                ...deposit,
                contract: { address: deposit.collectionAddress },
                position
              };
            } catch (err) {
              console.error(`Error processing NFT ${deposit.collectionAddress}-${deposit.tokenId}:`, err);
              return {
                ...deposit,
                name: `NFT #${deposit.tokenId}`,
                contract: { address: deposit.collectionAddress },
                error: (err as Error).message
              };
            }
          })
        );
        
        console.log("4️⃣ [useVaultAssets] Processed assets:", assetsWithMetadata);
        setAssets(assetsWithMetadata);
      } catch (err) {
        console.error('❌ [useVaultAssets] Error fetching vault assets:', err);
        setError('Failed to load your vault assets');
      } finally {
        setIsLoading(false);
      }
    };

    if (account && provider) {
      fetchAndProcessAssets();
    }
  });

  // Separate assets into those with loans and those without
  const activeLoans = () => assets().filter(asset => 
    asset.position && 
    asset.position.hasLoan && 
    asset.position.totalDebt && 
    asset.position.totalDebt.toString() !== '0'
  );
  
  const availableCollateral = () => assets().filter(asset => 
    !asset.position || 
    !asset.position.hasLoan || 
    !asset.position.totalDebt || 
    asset.position.totalDebt.toString() === '0'
  );

  // Helper method to refresh positions for a specific NFT
  const refreshPosition = async (collectionAddress: string, tokenId: string | number) => {
    const account = web3.account();
    const provider = web3.provider();
    
    if (!account || !provider) return null;
    
    try {
      const position = await getUserPositionDetails(
        provider,
        account,
        collectionAddress,
        tokenId
      );
      
      setUserPositions(prev => ({
        ...prev,
        [`${collectionAddress}-${tokenId}`]: position
      }));
      
      return position;
    } catch (err) {
      console.error(`Error refreshing position for NFT ${collectionAddress}-${tokenId}:`, err);
      return null;
    }
  };

  // Full refresh all positions & assets
  const refreshAllPositions = async () => {
    setRefreshTick(prev => prev + 1);
  };

  return { 
    assets: assets(),
    activeLoans: activeLoans(),
    availableCollateral: availableCollateral(),
    userPositions: userPositions(),
    isLoading: isLoading(), 
    error: error(),
    refreshPosition,
    refreshAllPositions
  };
} 