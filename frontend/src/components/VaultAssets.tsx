import { Component, createSignal, For, Show } from 'solid-js';
import { useWeb3 } from '../stores/Web3Store';
import { useContracts } from '../hooks/useContracts';
import { useVaultAssets } from '../hooks/useVaultAssets';
import NFTCard from './NFTCard';
import { formatUnits, parseUnits } from 'ethers';

interface VaultAssetsProps {
  refreshTrigger?: number;
}

const VaultAssets: Component<VaultAssetsProps> = (props) => {
  const web3 = useWeb3();
  const { contractService } = useContracts();
  
  // Use our custom hook to manage vault assets
  const { 
    assets, 
    userPositions, 
    isLoading, 
    error,
    refreshPosition,
    refreshAllPositions
  } = useVaultAssets(props.refreshTrigger);
  
  // General processing state for disabling buttons during transactions
  const [isProcessing, setIsProcessing] = createSignal(false);
  
  // Borrow modal state
  const [showBorrowModal, setShowBorrowModal] = createSignal(false);
  const [borrowAmount, setBorrowAmount] = createSignal('');
  const [selectedNFT, setSelectedNFT] = createSignal<any>(null);
  const [maxBorrowAmount, setMaxBorrowAmount] = createSignal('0');
  
  // Repay modal state
  const [showRepayModal, setShowRepayModal] = createSignal(false);
  const [currentDebt, setCurrentDebt] = createSignal('0');

  // Track NFTs that have just been withdrawn so UI updates instantly
  const [removedKeys, setRemovedKeys] = createSignal<Set<string>>(new Set());

  // Handle withdrawing an NFT
  const handleWithdrawNFT = async (nft: any) => {
    console.log("1️⃣ [Withdraw] Starting withdrawal with NFT:", nft);
    
    if (!contractService) {
      alert('Contract service not available');
      return;
    }

    try {
      setIsProcessing(true);
      
      // Ensure we get the collection address correctly
      const collectionAddress = nft.collectionAddress || nft.contract?.address;
      const tokenId = nft.tokenId;
      
      console.log("2️⃣ [Withdraw] Extracted data:", { collectionAddress, tokenId });

      if (!tokenId || !collectionAddress) {
        console.error("❌ [Withdraw] Invalid NFT data:", { tokenId, collectionAddress });
        alert('Invalid NFT data');
        return;
      }
      
      const result = await contractService.withdrawNFT(collectionAddress, tokenId);
      console.log("3️⃣ [Withdraw] Withdrawal result:", result);
      
      alert('NFT withdrawn successfully');
      
      // Remove NFT from local view immediately
      const key = `${collectionAddress}-${tokenId}`;
      setRemovedKeys(prev => {
        const newSet = new Set(prev);
        newSet.add(key);
        return newSet;
      });

      // Trigger full refresh in the background
      await refreshAllPositions();
    } catch (err) {
      console.error("❌ [Withdraw] Withdrawal error:", err);
      alert(`Failed to withdraw NFT: ${(err as Error).message || err}`);
    } finally {
      setIsProcessing(false);
    }
  };

  // Prepare for borrowing - called when user clicks "Borrow" button
  const prepareAndOpenBorrowModal = (nft: any) => {
    setSelectedNFT(nft);
    
    // Use the correct key format based on our updated structure
    const key = `${nft.collectionAddress || nft.contract?.address}-${nft.tokenId}`;
    const position = userPositions[key];
    
    if (position) {
      // Format max borrow amount to show in DPSV
      setMaxBorrowAmount(formatUnits(position.maxBorrow?.toString() || '0', 18));
    }
    
    setShowBorrowModal(true);
  };

  // Handle borrowing after user confirms in modal
  const handleBorrow = async () => {
    if (!contractService || !selectedNFT()) {
      alert('Contract service not available');
      return;
    }

    try {
      setIsProcessing(true);
      
      // Convert input amount (DPSV) to wei
      const amountWei = parseUnits(borrowAmount(), 18);
      
      const tokenId = selectedNFT().tokenId;
      const collectionAddress = selectedNFT().collectionAddress || selectedNFT().contract?.address;
      
      if (!tokenId || !collectionAddress) {
        alert('Invalid NFT data');
        return;
      }
      
      await contractService.borrow(collectionAddress, tokenId, amountWei);
      alert('Loan successfully created!');
      
      // Close modal and reset
      setShowBorrowModal(false);
      setBorrowAmount('');
      setSelectedNFT(null);
      
      // Refresh position for this NFT
      await refreshPosition(collectionAddress, tokenId);
    } catch (err) {
      console.error('Error borrowing:', err);
      alert(`Failed to borrow: ${(err as Error).message || err}`);
    } finally {
      setIsProcessing(false);
    }
  };

  // Prepare for repaying - called when user clicks "Repay Full Amount" button
  const prepareAndOpenRepayModal = (nft: any) => {
    setSelectedNFT(nft);
    
    const key = `${nft.collectionAddress || nft.contract?.address}-${nft.tokenId}`;
    const position = userPositions[key];
    
    if (position) {
      // Format debt amount to show in DPSV
      setCurrentDebt(formatUnits(position.totalDebt?.toString() || '0', 18));
    }
    
    setShowRepayModal(true);
  };

  // Handle repaying - called when user confirms in modal
  const handleRepay = async () => {
    const account = web3.account();
    if (!contractService || !selectedNFT() || !account) {
      alert('Cannot proceed with repayment. Please reconnect wallet.');
      return;
    }

    setIsProcessing(true);

    try {
      const tokenId = selectedNFT().tokenId;
      const collectionAddress = selectedNFT().collectionAddress || selectedNFT().contract?.address;
      
      if (!tokenId || !collectionAddress) {
        alert('Invalid NFT data');
        setIsProcessing(false);
        return;
      }
      
      // CRITICAL: Get the most up-to-date debt amount right before sending the transaction
      // This prevents CALL_EXCEPTION errors due to interest accrual
      console.log(`Getting latest debt amount for NFT #${tokenId}...`);
      const position = await contractService.getUserPosition(account, collectionAddress, tokenId);
      const totalDebtInWei = position.totalDebt; // This is a BigInt value in wei
      
      // Add a 0.1% buffer to account for interest accrual between fetching and sending tx
      const buffer = totalDebtInWei / 1000n; // 0.1% buffer
      const finalRepaymentAmount = totalDebtInWei + buffer;

      // 🔒 Ensure the user has enough native DPSV (ETH on testnet) to cover the repayment
      const userBalanceWei = await contractService.getWalletBalance();
      if (userBalanceWei < finalRepaymentAmount) {
        alert('Insufficient wallet balance to repay this loan.');
        setIsProcessing(false);
        return;
      }

      // Check if there's any debt to repay
      if (totalDebtInWei === 0n) { // Using 0n for BigInt comparison
        alert('There is no debt to repay for this NFT.');
        setIsProcessing(false);
        return;
      }
      
      console.log(`--- Repaying Loan for NFT #${tokenId} ---`);
      console.log(`Final debt check (wei): ${totalDebtInWei.toString()}`);
      console.log(`Sending with buffer (wei): ${finalRepaymentAmount.toString()}`);
      
      // Send the transaction with the exact up-to-date debt amount
      await contractService.repayLoan(
        collectionAddress, 
        tokenId, 
        finalRepaymentAmount // Pass amount directly
      );
      
      alert('Loan successfully repaid! You can now withdraw your NFT.');
      
      // Close modal and reset
      setShowRepayModal(false);
      setSelectedNFT(null);
      
      // Refresh position for this NFT
      await refreshAllPositions();
    } catch (err) {
      console.error('Error repaying loan:', err);
      alert(`Failed to repay loan: ${(err as any).reason || (err as Error).message || 'Transaction reverted.'}`);
    } finally {
      setIsProcessing(false);
    }
  };

  // Filter assets to exclude ones withdrawn in this session
  const displayedAssets = () => {
    return assets.filter(asset => {
      const k = `${asset.collectionAddress || asset.contract?.address}-${asset.tokenId}`;
      return !removedKeys().has(k);
    });
  };

  // Show loading state
  if (isLoading) {
    return (
      <div class="text-center my-5">
        <div class="spinner-border text-neon" role="status" style={{ "width": '3rem', "height": '3rem' }}>
          <span class="visually-hidden">Loading...</span>
        </div>
        <p class="mt-3 text-neon" style={{ "font-family": 'var(--font-primary)' }}>
          Loading your vault assets...
        </p>
      </div>
    );
  }

  // Show error state
  if (error) {
    return (
      <div class="alert alert-danger text-center">
        <i class="bi bi-exclamation-triangle me-2"></i>
        {error}
      </div>
    );
  }

  // Show empty state
  if (!web3.account()) {
    return (
      <div class="alert alert-info text-center">
        <i class="bi bi-wallet2 me-2"></i>
        Connect your wallet to view your vault assets
      </div>
    );
  }

  // Show empty vault state
  if (assets.length === 0) {
    return (
      <div class="alert alert-info text-center" style={{ "padding": '2rem' }}>
        <i class="bi bi-safe" style={{ "font-size": '3rem', "margin-bottom": '1rem' }}></i>
        <h4 class="text-neon">Empty Vault</h4>
        <p class="mb-0">You have no NFTs deposited in the vault. Switch to "Wallet NFTs" tab to deposit some.</p>
      </div>
    );
  }

  return (
    <>
      {/* Main Content */}
      <div class="container-fluid">
        <div class="text-center mb-4">
          <h3 class="text-neon mb-2" style={{ "font-family": 'var(--font-primary)' }}>
            DEPOSITED NFTs
          </h3>
          <p class="text-muted">
            Manage your collateralized NFTs and active loans
          </p>
        </div>
        
        <div class="row g-4">
          <For each={displayedAssets()}>
            {(nft) => {
              // Use the correct key format based on our updated structure
              const key = `${nft.collectionAddress || nft.contract?.address}-${nft.tokenId}`;
              const position = userPositions[key];
              
              return (
                <div class="col-12 col-md-6 col-lg-4">
                  <NFTCard 
                    nft={nft}
                    userPosition={position}
                    isProcessing={isProcessing()}
                    canWithdraw={true}
                    canBorrow={true}
                    canRepay={true}
                    onWithdraw={handleWithdrawNFT}
                    onBorrow={prepareAndOpenBorrowModal}
                    onRepay={prepareAndOpenRepayModal}
                  />
                </div>
              );
            }}
          </For>
        </div>
      </div>

      {/* Borrow Modal - Cyberpunk Style */}
      <Show when={showBorrowModal()}>
        <div class="modal show d-block" tabindex="-1">
          <div class="modal-dialog modal-dialog-centered">
            <div class="modal-content glass-container-modal">
              <div class="modal-header" style={{ "border-bottom": '1px solid var(--glass-border)' }}>
                <h5 class="modal-title text-neon" style={{ "font-family": 'var(--font-primary)' }}>
                  <i class="bi bi-currency-exchange me-2"></i>
                  BORROW AGAINST NFT
                </h5>
                <button type="button" class="btn-close btn-close-white" onClick={() => setShowBorrowModal(false)}></button>
              </div>
              <div class="modal-body">
                <div class="text-center mb-4">
                  <div class="badge bg-info mb-2">Available to Borrow</div>
                  <h3 class="text-neon-yellow">{maxBorrowAmount()} DPSV</h3>
                </div>
                
                <div class="mb-3">
                  <label for="borrowAmount" class="form-label text-secondary">
                    Enter amount to borrow (DPSV)
                  </label>
                  <input
                    type="text"
                    class="form-control"
                    id="borrowAmount"
                    value={borrowAmount()}
                    onInput={(e) => setBorrowAmount(e.target.value)}
                    placeholder="0.0"
                    style={{ 
                      "font-family": 'var(--font-mono)',
                      "font-size": '1.2rem',
                      "text-align": 'center'
                    }}
                  />
                </div>
              </div>
              <div class="modal-footer" style={{ "border-top": '1px solid var(--glass-border)' }}>
                <button class="btn btn-outline-secondary" onClick={() => setShowBorrowModal(false)}>
                  Cancel
                </button>
                <button 
                  class="btn btn-neon-yellow" 
                  onClick={handleBorrow}
                  disabled={!borrowAmount() || 
                    parseFloat(borrowAmount()) <= 0 || 
                    parseFloat(borrowAmount()) > parseFloat(maxBorrowAmount()) || 
                    isProcessing()}
                >
                  <Show when={isProcessing()} fallback="BORROW">
                    <span class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                    PROCESSING...
                  </Show>
                </button>
              </div>
            </div>
          </div>
        </div>
        <div class="modal-backdrop show"></div>
      </Show>

      {/* Repay Modal - Cyberpunk Style */}
      <Show when={showRepayModal()}>
        <div class="modal show d-block" tabindex="-1">
          <div class="modal-dialog modal-dialog-centered">
            <div class="modal-content glass-container-modal">
              <div class="modal-header" style={{ "border-bottom": '1px solid var(--glass-border)' }}>
                <h5 class="modal-title text-neon-magenta" style={{ "font-family": 'var(--font-primary)' }}>
                  <i class="bi bi-credit-card me-2"></i>
                  REPAY LOAN
                </h5>
                <button type="button" class="btn-close btn-close-white" onClick={() => setShowRepayModal(false)}></button>
              </div>
              <div class="modal-body text-center">
                <p class="mb-3">You are about to repay the entire loan for <strong class="text-neon">NFT #{selectedNFT()?.tokenId}</strong>.</p>
                <p class="text-muted mb-4">This will close the loan and allow you to withdraw your NFT.</p>
                
                <div class="alert alert-info">
                  <h5 class="text-neon-magenta">Total Debt to Repay:</h5>
                  <h3 class="text-neon-magenta mb-0">{currentDebt()} DPSV</h3>
                </div>
                
                <p class="text-muted small">
                  <i class="bi bi-info-circle me-1"></i>
                  The exact amount may be slightly higher due to interest accrual.
                  The precise amount will be calculated at transaction time.
                </p>
              </div>
              <div class="modal-footer" style={{ "border-top": '1px solid var(--glass-border)' }}>
                <button class="btn btn-outline-secondary" onClick={() => setShowRepayModal(false)}>
                  Cancel
                </button>
                <button 
                  class="btn btn-neon-magenta" 
                  onClick={handleRepay}
                  disabled={isProcessing()}
                >
                  <Show when={isProcessing()} fallback="CONFIRM & REPAY">
                    <span class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                    PROCESSING...
                  </Show>
                </button>
              </div>
            </div>
          </div>
        </div>
        <div class="modal-backdrop show"></div>
      </Show>
    </>
  );
};

export default VaultAssets;