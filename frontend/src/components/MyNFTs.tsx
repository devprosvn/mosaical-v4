import { Component, createSignal, createEffect, For, Show } from 'solid-js';
import { useWeb3 } from '../stores/Web3Store';
import { useContracts } from '../hooks/useContracts';
import { getUserNFTs } from '../services/nftService';
import { CONTRACT_ADDRESSES } from '../constants/contracts';

interface NFTCardProps {
  nft: {
    tokenId: string;
    title: string;
    description: string;
    image: string;
    collectionAddress: string;
    collectionName: string;
  };
  onDeposit: (tokenId: string, collectionAddress: string) => void;
}

// Component to display a single NFT card
const NFTCardItem: Component<NFTCardProps> = (props) => {
  return (
    <div class="col-12 col-sm-6 col-md-4 col-lg-3 mb-4">
      <div class="glass-container mosaic-frame interactive-element" style={{ "height": '100%' }}>
        {/* Hexagonal NFT Image */}
        <div class="hexagon-container" style={{ "margin": '1rem auto 0.5rem' }}>
          <div class="hexagon">
            <img 
              src={props.nft.image}
              alt={props.nft.title}
              loading="lazy"
            />
          </div>
        </div>
        
        <div class="card-body text-center" style={{ "padding": '1rem' }}>
          <h5 class="text-neon mb-2" style={{ "font-family": 'var(--font-primary)' }}>
            {props.nft.title}
          </h5>
          <p class="text-secondary mb-3" style={{ "font-size": '0.9rem' }}>
            {props.nft.description}
          </p>
          
          <div class="mb-3">
            <div class="badge bg-info mb-2">Token #{props.nft.tokenId}</div>
            <div class="badge bg-success mb-2">{props.nft.collectionName}</div>
            <div class="badge bg-secondary" style={{ 
              "font-family": 'var(--font-mono)', 
              "font-size": '0.7rem',
              "display": 'block'
            }}>
              {props.nft.collectionAddress.substring(0, 6)}...{props.nft.collectionAddress.substring(props.nft.collectionAddress.length - 4)}
            </div>
          </div>
          
          <button 
            class="btn btn-neon-cyan w-100" 
            onClick={() => props.onDeposit(props.nft.tokenId, props.nft.collectionAddress)}
          >
            <i class="bi bi-safe me-2"></i>
            DEPOSIT
          </button>
        </div>
      </div>
    </div>
  );
};

interface MyNFTsProps {
  onNFTDeposited?: () => void;
}

const MyNFTs: Component<MyNFTsProps> = (props) => {
  const web3 = useWeb3();
  const { contractService } = useContracts();
  
  const [ownedNFTs, setOwnedNFTs] = createSignal<any[]>([]);
  const [isLoading, setIsLoading] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);

  // Fetch user's NFTs when account changes
  createEffect(() => {
    const account = web3.account();
    const provider = web3.provider();
    
    const fetchOwnedNFTs = async () => {
      if (!account || !provider) return;

      setIsLoading(true);
      setError('');
      setOwnedNFTs([]); 

      try {
        // Sử dụng service mới để lấy NFTs
        const userNFTs = await getUserNFTs(provider, account);
        
        setOwnedNFTs(userNFTs);

      } catch (err) {
        console.error("Failed to fetch NFTs from contract:", err);
        setError('Could not fetch NFT data from the contract.');
      } finally {
        setIsLoading(false);
      }
    };

    if (account && provider) {
      fetchOwnedNFTs();
    }
  });

  // Handle depositing an NFT
  const handleDepositNFT = async (tokenId: string, collectionAddress?: string) => {
    if (!contractService) {
      alert('Contract service not available');
      return;
    }

    try {
      // Tìm NFT để lấy collection address
      const nft = ownedNFTs().find(n => n.tokenId === tokenId);
      const collection = collectionAddress || nft?.collectionAddress || CONTRACT_ADDRESSES.MockGameNFT;
      
      await contractService.depositNFT(collection, tokenId);
      alert('NFT successfully deposited!');
      
      // Notify parent component to refresh vault assets
      if (props.onNFTDeposited) {
        props.onNFTDeposited();
      }
    } catch (err) {
      console.error('Error depositing NFT:', err);
      alert(`Failed to deposit NFT: ${(err as Error).message || err}`);
    }
  };

  // Show loading state
  if (isLoading()) {
    return (
      <div class="text-center my-5">
        <div class="spinner-border text-neon" role="status" style={{ "width": '3rem', "height": '3rem' }}>
          <span class="visually-hidden">Loading...</span>
        </div>
        <p class="mt-3 text-neon" style={{ "font-family": 'var(--font-primary)' }}>
          Fetching your NFTs from supported collections...
        </p>
      </div>
    );
  }

  // Show error state
  if (error()) {
    return (
      <div class="alert alert-danger text-center">
        <i class="bi bi-exclamation-triangle me-2"></i>
        {error()}
      </div>
    );
  }

  // Show empty state
  if (!web3.account()) {
    return (
      <div class="alert alert-info text-center">
        <i class="bi bi-wallet2 me-2"></i>
        Please connect your wallet to see your NFTs.
      </div>
    );
  }

  // Show empty collection state
  if (ownedNFTs().length === 0) {
    return (
      <div class="alert alert-info text-center" style={{ "padding": '2rem' }}>
        <i class="bi bi-collection" style={{ "font-size": '3rem', "margin-bottom": '1rem' }}></i>
        <h4 class="text-neon">No NFTs Found</h4>
        <p class="mb-0">You don't own any NFTs in the supported collections yet.</p>
      </div>
    );
  }

  // Show NFTs
  return (
    <div class="container-fluid">
      <div class="text-center mb-4">
        <h3 class="text-neon mb-2" style={{ "font-family": 'var(--font-primary)' }}>
          YOUR NFT COLLECTION
        </h3>
        <p class="text-muted">
          These NFTs can be deposited as collateral to borrow DPSV tokens
        </p>
      </div>
      
      <div class="row g-4">
        <For each={ownedNFTs()}>
          {(nft) => (
            <NFTCardItem 
              nft={nft}
              onDeposit={handleDepositNFT}
            />
          )}
        </For>
      </div>
    </div>
  );
};

export default MyNFTs;