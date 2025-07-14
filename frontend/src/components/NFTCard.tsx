import { Component, Show } from 'solid-js';
import { formatUnits } from 'ethers';

interface NFTCardProps {
  nft: {
    tokenId: string;
    title?: string;
    description?: string;
    image?: string;
    collectionAddress: string;
    contract?: { 
      name?: string; 
      address?: string;
    };
  };
  userPosition?: {
    maxBorrow: bigint;
    totalDebt: bigint;
    hasLoan: boolean;
    currentLTV: string;
    liquidationThreshold: string;
  };
  onDeposit?: (nft: any) => void;
  onWithdraw?: (nft: any) => void;
  onBorrow?: (nft: any) => void;
  onRepay?: (nft: any) => void;
  canWithdraw?: boolean;
  canBorrow?: boolean;
  canRepay?: boolean;
  isProcessing?: boolean;
}

const NFTCard: Component<NFTCardProps> = (props) => {
  // Extract NFT metadata
  const tokenId = () => props.nft.tokenId || '?';
  const name = () => props.nft.title || props.nft?.contract?.name || `NFT #${tokenId()}`;
  const description = () => props.nft.description || 'GameFi NFT Asset';
  const imageUrl = () => props.nft.image || `https://via.placeholder.com/300/0a0a1a/00f6ff?text=NFT+%23${tokenId()}`;
  const collectionName = () => props.nft?.contract?.name || 'Mosaical Collection';
  const collectionAddress = () => props.nft.collectionAddress || props.nft?.contract?.address || '';

  // Format position values
  const formatDPSV = (value: bigint | undefined) => {
    if (!value) return '0 DPSV';
    try {
      return `${parseFloat(formatUnits(value, 18)).toFixed(4)} DPSV`;
    } catch (e) {
      return `${value} DPSV`;
    }
  };

  // Get LTV variant color based on value
  const getLtvVariant = (ltv: string | undefined) => {
    if (!ltv) return 'info';
    const ltvNum = parseFloat(ltv);
    if (ltvNum < 50) return 'success';
    if (ltvNum < 70) return 'warning';
    return 'danger';
  };

  // Format contract address for display
  const formattedAddress = () => {
    const addr = collectionAddress();
    return addr ? `${addr.substring(0, 6)}...${addr.substring(addr.length - 4)}` : '';
  };

  // Determine if the NFT is at risk of liquidation
  const isAtRiskOfLiquidation = () => {
    if (!props.userPosition) return false;
    
    return props.userPosition.hasLoan && 
      props.userPosition.currentLTV && 
      props.userPosition.liquidationThreshold &&
      parseFloat(props.userPosition.currentLTV) >= parseFloat(props.userPosition.liquidationThreshold) * 0.9;
  };
    
  // Check if Oracle price is missing
  const hasOraclePrice = () => {
    return props.userPosition && props.userPosition.maxBorrow && props.userPosition.maxBorrow !== 0n;
  };

  return (
    <div class={`glass-container mosaic-frame interactive-element ${isAtRiskOfLiquidation() ? 'glitch' : ''}`}
      style={{ 
        "display": 'flex',
        "flex-direction": 'column',
        "height": '100%',
        "min-height": '400px',
        "transition": 'all 0.3s ease'
      }}
    >
      {/* NFT Image with Hexagonal Style */}
      <div class="hexagon-container" style={{ "margin": '1rem auto 0.5rem' }}>
        <div class="hexagon">
          <img 
            src={imageUrl()} 
            alt={name()}
            loading="lazy"
          />
        </div>
      </div>
      
      {/* NFT Information */}
      <div class="card-body" style={{ 
        "flex": 1, 
        "display": 'flex', 
        "flex-direction": 'column',
        "padding": '1rem'
      }}>
        <h5 class="text-neon text-center mb-2" style={{ "font-family": 'var(--font-primary)' }}>
          {name()}
        </h5>
        <h6 class="text-secondary text-center mb-3" style={{ "font-size": '0.9rem' }}>
          {collectionName()}
        </h6>
        
        {/* Token ID and Contract Address */}
        <div class="mb-3 text-center">
          <div class="badge bg-info mb-1">Token #{tokenId()}</div>
          <Show when={formattedAddress()}>
            <div class="badge bg-secondary" style={{ "font-family": 'var(--font-mono)', "font-size": '0.7rem' }}>
              {formattedAddress()}
            </div>
          </Show>
        </div>
        
        {/* Show position details if available */}
        <Show when={props.userPosition}>
          <div class="position-details mb-3">
            {/* Oracle Price Missing Warning */}
            <Show when={!hasOraclePrice() && props.canBorrow}>
              <div class="alert alert-warning p-2 mb-2 text-center">
                <small><i class="bi bi-exclamation-triangle me-1"></i>Oracle price not set</small>
              </div>
            </Show>
            
            {/* Max Borrow Amount */}
            <div class="d-flex justify-content-between align-items-center mb-2">
              <span class="text-muted small">Max Borrow:</span>
              <span class="badge bg-info text-neon-yellow">{formatDPSV(props.userPosition?.maxBorrow)}</span>
            </div>
            
            {/* Current LTV with neon progress bar */}
            <div class="mb-2">
              <div class="d-flex justify-content-between align-items-center mb-1">
                <span class="text-muted small">Current LTV:</span>
                <span class={`badge bg-${getLtvVariant(props.userPosition?.currentLTV)}`}>
                  {props.userPosition?.currentLTV ? 
                    `${parseFloat(props.userPosition.currentLTV).toFixed(2)}%` : '0%'}
                </span>
              </div>
              <Show when={props.userPosition?.currentLTV && props.userPosition?.liquidationThreshold}>
                <div class="progress" style={{ "height": '6px' }}>
                  <div 
                    class={`progress-bar bg-${getLtvVariant(props.userPosition?.currentLTV)}`}
                    style={{ 
                      "width": `${Math.min(parseFloat(props.userPosition?.currentLTV || '0'), 100)}%`
                    }}
                    role="progressbar"
                  ></div>
                </div>
              </Show>
            </div>
            
            {/* Total Debt */}
            <Show when={props.userPosition?.hasLoan}>
              <div class="d-flex justify-content-between align-items-center mb-2">
                <span class="text-muted small">Total Debt:</span>
                <span class="badge bg-danger text-neon-magenta">{formatDPSV(props.userPosition?.totalDebt)}</span>
              </div>
            </Show>
            
            {/* Liquidation Warning */}
            <Show when={isAtRiskOfLiquidation()}>
              <div class="alert alert-danger p-2 text-center glitch">
                <small class="text-neon-magenta">
                  <i class="bi bi-exclamation-triangle-fill me-1"></i>
                  AT RISK OF LIQUIDATION
                </small>
              </div>
            </Show>
          </div>
        </Show>
        
        {/* Action Buttons */}
        <div class="d-flex justify-content-center gap-2 mt-auto">
          <Show when={props.onDeposit}>
            <button 
              class="btn btn-neon-cyan btn-sm" 
              onClick={() => props.onDeposit?.(props.nft)}
              disabled={props.isProcessing}
            >
              <Show when={props.isProcessing} fallback="Deposit">
                <span class="spinner-border spinner-border-sm me-1" role="status" aria-hidden="true"></span>
                Processing...
              </Show>
            </button>
          </Show>
          
          <Show when={props.canWithdraw && props.onWithdraw}>
            <button 
              class="btn btn-outline-light btn-sm interactive-element" 
              onClick={() => props.onWithdraw?.(props.nft)}
              disabled={props.isProcessing || (props.userPosition && props.userPosition.hasLoan)}
            >
              <Show when={props.isProcessing} fallback="Withdraw">
                <span class="spinner-border spinner-border-sm me-1" role="status" aria-hidden="true"></span>
                Processing...
              </Show>
            </button>
          </Show>
          
          <Show when={props.canBorrow && props.onBorrow}>
            <button 
              class="btn btn-neon-yellow btn-sm" 
              onClick={() => props.onBorrow?.(props.nft)}
              disabled={props.isProcessing || !hasOraclePrice()}
            >
              <Show when={props.isProcessing} fallback="Borrow">
                <span class="spinner-border spinner-border-sm me-1" role="status" aria-hidden="true"></span>
                Processing...
              </Show>
            </button>
          </Show>
          
          <Show when={props.canRepay && props.onRepay}>
            <button 
              class="btn btn-neon-magenta btn-sm" 
              onClick={() => props.onRepay?.(props.nft)}
              disabled={props.isProcessing || !props.userPosition || !props.userPosition.hasLoan}
            >
              <Show when={props.isProcessing} fallback="Repay">
                <span class="spinner-border spinner-border-sm me-1" role="status" aria-hidden="true"></span>
                Repaying...
              </Show>
            </button>
          </Show>
        </div>
      </div>
    </div>
  );
};

export default NFTCard;