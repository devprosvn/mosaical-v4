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
  onDeposit: (tokenId: string) => void;
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
            onClick={() => props.onDeposit(props.nft.tokenId)}
          >
            <i class="bi bi-safe me-2"></i>
            DEPOSIT
          </button>
        </div>
      </div>
    </div>
  );
};

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

  return (
    <div class="container py-4">
      <Show when={isLoading()}>
        <div class="text-center py-5">
          <div class="spinner-border text-primary" role="status">
            <span class="visually-hidden">Loading...</span>
          </div>
        </div>
      </Show>

      <Show when={error()}>
        <div class="alert alert-danger">{error()}</div>
      </Show>

      <Show when={!isLoading() && !error() && ownedNFTs().length === 0}>
        <div class="text-center py-5">
          <h3>No NFTs Found</h3>
          <p class="text-muted">You don't own any NFTs in the supported collections yet.</p>
        </div>
      </Show>

      <div class="row g-4">
        <For each={ownedNFTs()}>
          {(nft) => (
            <NFTCardItem 
              nft={nft}
              onDeposit={(tokenId) => handleDepositNFT(tokenId, nft.collectionAddress)}
            />
          )}
        </For>
      </div>
    </div>
  );
};

export default MyNFTs;