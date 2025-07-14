import { Component, createSignal, createEffect, Show, For } from 'solid-js';
import { useWeb3 } from '../stores/Web3Store';
import { useContracts } from '../hooks/useContracts';
import { parseUnits, formatUnits } from 'ethers';
import { useAdmin } from '../hooks/useAdmin';

const SettingsPage: Component = () => {
  const web3 = useWeb3();
  const { contractService, isReady, error: contractError } = useContracts();
  
  const { isAdmin } = useAdmin();
  const [isProcessing, setIsProcessing] = createSignal(false);
  const [activeTab, setActiveTab] = createSignal('profile');
  
  // Collection form data
  const [collectionAddress, setCollectionAddress] = createSignal('');
  const [maxLTV, setMaxLTV] = createSignal('70');
  const [liquidationThreshold, setLiquidationThreshold] = createSignal('85');
  const [baseInterestRate, setBaseInterestRate] = createSignal('5');
  
  // Oracle form data
  const [oracleCollectionAddress, setOracleCollectionAddress] = createSignal('');
  const [floorPrice, setFloorPrice] = createSignal('');
  
  // Supported collections
  const [supportedCollections, setSupportedCollections] = createSignal<any[]>([]);
  const [isLoadingCollections, setIsLoadingCollections] = createSignal(false);

  // Handler to remove a collection (admin only)
  const handleRemoveCollection = async (address: string) => {
    if (!contractService) return;
    if (!isAdmin()) return;
    if (!confirm('Are you sure you want to remove this collection?')) return;
    try {
      setIsProcessing(true);
      await contractService.removeSupportedCollection(address);
      alert('Collection removed');
      loadSupportedCollections();
    } catch (err) {
      alert((err as Error).message || 'Failed to remove');
    } finally {
      setIsProcessing(false);
    }
  };

  // Load supported collections
  const loadSupportedCollections = async () => {
    if (!contractService) return;
    
    try {
      setIsLoadingCollections(true);
      const collections = await contractService.getSupportedCollections();
      setSupportedCollections(collections);
    } catch (error) {
      console.error('Error loading supported collections:', error);
    } finally {
      setIsLoadingCollections(false);
    }
  };

  // Handle adding a supported collection
  const handleAddCollection = async (e: Event) => {
    e.preventDefault();
    
    if (!contractService) {
      alert('Contract service not available');
      return;
    }

    try {
      setIsProcessing(true);
      
      // Convert percentages to basis points (e.g., 70% → 7000)
      const maxLTVBasisPoints = Math.round(parseFloat(maxLTV()) * 100);
      const liquidationThresholdBasisPoints = Math.round(parseFloat(liquidationThreshold()) * 100);
      const baseInterestRateBasisPoints = Math.round(parseFloat(baseInterestRate()) * 100);
      
      await contractService.addSupportedCollection(
        collectionAddress(),
        maxLTVBasisPoints,
        liquidationThresholdBasisPoints,
        baseInterestRateBasisPoints
      );
      
      alert(`Collection ${collectionAddress()} added successfully`);
      
      // Reset form
      setCollectionAddress('');
      
      // Refresh collections list
      loadSupportedCollections();
    } catch (error) {
      console.error('Error adding collection:', error);
      alert(`Failed to add collection: ${(error as Error).message || error}`);
    } finally {
      setIsProcessing(false);
    }
  };

  // Handle updating oracle floor price
  const handleUpdateFloorPrice = async (e: Event) => {
    e.preventDefault();
    
    if (!contractService) {
      alert('Contract service not available');
      return;
    }

    try {
      setIsProcessing(true);
      
      // Convert DPSV to wei
      const priceWei = parseUnits(floorPrice(), 18);
      
      await contractService.updateFloorPrice(oracleCollectionAddress(), priceWei);
      
      alert(`Floor price updated for ${oracleCollectionAddress()}`);
      
      // Reset form
      setOracleCollectionAddress('');
      setFloorPrice('');
      
      // Refresh collections list to show updated floor prices
      loadSupportedCollections();
    } catch (error) {
      console.error('Error updating floor price:', error);
      alert(`Failed to update floor price: ${(error as Error).message || error}`);
    } finally {
      setIsProcessing(false);
    }
  };

  // Show settings dashboard
  return (
    <div class="container py-4">
      <div class="glass-container mosaic-frame" style={{ "margin-bottom": '2rem' }}>
        <div class="text-center mb-4">
          <h1 class="text-neon mb-3" style={{ 
            "font-family": 'var(--font-primary)', 
            "font-size": '3rem',
            "text-shadow": '0 0 30px var(--neon-cyan)'
          }}>
            SETTINGS
          </h1>
          <p class="text-secondary">
            Configure your account and system preferences
          </p>
        </div>
        
        {/* Contract error banner */}
        <Show when={contractError()}>
          <div class="alert alert-warning mb-3">
            <i class="bi bi-exclamation-triangle me-2"></i>
            {contractError()}
          </div>
        </Show>

        {/* Cyberpunk Navigation Tabs */}
        <ul class="nav nav-tabs mb-4" style={{ "border-bottom": 'none' }}>
          <li class="nav-item">
            <button class={`nav-link ${activeTab() === 'profile' ? 'active' : ''}`} onClick={() => setActiveTab('profile')}>
              <i class="bi bi-person me-2"></i>Profile
            </button>
          </li>
          <li class="nav-item">
            <button class={`nav-link ${activeTab() === 'display' ? 'active' : ''}`} onClick={() => setActiveTab('display')}>
              <i class="bi bi-palette me-2"></i>Display
            </button>
          </li>
          <li class="nav-item">
            <button class={`nav-link ${activeTab() === 'notifications' ? 'active' : ''}`} onClick={() => setActiveTab('notifications')}>
              <i class="bi bi-bell me-2"></i>Notifications
            </button>
          </li>
          <li class="nav-item">
            <button class={`nav-link ${activeTab() === 'wallet' ? 'active' : ''}`} onClick={() => setActiveTab('wallet')}>
              <i class="bi bi-wallet2 me-2"></i>Wallet
            </button>
          </li>
          <Show when={isAdmin()}>
            <li class="nav-item">
              <button class={`nav-link ${activeTab() === 'collections' ? 'active' : ''}`} onClick={() => setActiveTab('collections')}>
                <i class="bi bi-collection me-2"></i>Collections
              </button>
            </li>
            <li class="nav-item">
              <button class={`nav-link ${activeTab() === 'oracle' ? 'active' : ''}`} onClick={() => setActiveTab('oracle')}>
                <i class="bi bi-graph-up me-2"></i>Oracle
              </button>
            </li>
          </Show>
        </ul>
        
        <div class="tab-content">
          {/* Profile Tab */}
          <Show when={activeTab() === 'profile'}>
            <div class="glass-container" style={{ "padding": '2rem' }}>
              <h4 class="text-neon mb-3">Profile Settings</h4>
              <p class="text-muted">Profile settings placeholder - Coming soon!</p>
            </div>
          </Show>
          
          {/* Display Tab */}
          <Show when={activeTab() === 'display'}>
            <div class="glass-container" style={{ "padding": '2rem' }}>
              <h4 class="text-neon mb-3">Display Settings</h4>
              <p class="text-muted">Display settings placeholder - Coming soon!</p>
            </div>
          </Show>
          
          {/* Notifications Tab */}
          <Show when={activeTab() === 'notifications'}>
            <div class="glass-container" style={{ "padding": '2rem' }}>
              <h4 class="text-neon mb-3">Notification Settings</h4>
              <p class="text-muted">Notification settings placeholder - Coming soon!</p>
            </div>
          </Show>
          
          {/* Wallet Tab */}
          <Show when={activeTab() === 'wallet'}>
            <div class="glass-container" style={{ "padding": '2rem' }}>
              <h4 class="text-neon mb-3">Wallet Settings</h4>
              <p class="text-muted">Wallet settings placeholder - Coming soon!</p>
            </div>
          </Show>
          
          {/* Collection Management Tab - Admin Only */}
          <Show when={activeTab() === 'collections' && isAdmin()}>
            <div class="glass-container" style={{ "padding": '2rem' }}>
              <h4 class="text-neon mb-4">
                <i class="bi bi-shield-check me-2"></i>
                Collection Management
              </h4>
              
              {/* Add Collection Form */}
              <form onSubmit={handleAddCollection} class="mb-5">
                <div class="row">
                  <div class="col-md-6 mb-3">
                    <label for="collectionAddress" class="form-label text-secondary">Collection Address</label>
                    <input 
                      type="text" 
                      class="form-control" 
                      id="collectionAddress" 
                      placeholder="0x..." 
                      value={collectionAddress()}
                      onInput={(e) => setCollectionAddress(e.currentTarget.value)}
                      required
                    />
                  </div>
                  
                  <div class="col-md-2 mb-3">
                    <label for="maxLTV" class="form-label text-secondary">Max LTV (%)</label>
                    <input 
                      type="number" 
                      class="form-control" 
                      id="maxLTV" 
                      placeholder="70" 
                      value={maxLTV()}
                      onInput={(e) => setMaxLTV(e.currentTarget.value)}
                      min="1"
                      max="90"
                      required
                    />
                  </div>
                  
                  <div class="col-md-2 mb-3">
                    <label for="liquidationThreshold" class="form-label text-secondary">Liquidation (%)</label>
                    <input 
                      type="number" 
                      class="form-control" 
                      id="liquidationThreshold" 
                      placeholder="85" 
                      value={liquidationThreshold()}
                      onInput={(e) => setLiquidationThreshold(e.currentTarget.value)}
                      min="1"
                      max="95"
                      required
                    />
                  </div>
                  
                  <div class="col-md-2 mb-3">
                    <label for="baseInterestRate" class="form-label text-secondary">Interest Rate (%)</label>
                    <input 
                      type="number" 
                      class="form-control" 
                      id="baseInterestRate" 
                      placeholder="5" 
                      value={baseInterestRate()}
                      onInput={(e) => setBaseInterestRate(e.currentTarget.value)}
                      min="0"
                      max="100"
                      step="0.1"
                      required
                    />
                  </div>
                </div>
                
                <button 
                  type="submit"
                  class="btn btn-neon-cyan"
                  disabled={isProcessing() || !isReady()}
                >
                  <Show when={isProcessing()} fallback={
                    <>
                      <i class="bi bi-plus-circle me-2"></i>
                      ADD COLLECTION
                    </>
                  }>
                    <span class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                    PROCESSING...
                  </Show>
                </button>
              </form>
              
              {/* Supported Collections List */}
              <h5 class="text-neon-yellow mb-3">Supported Collections</h5>
              <Show when={isLoadingCollections()}>
                <div class="text-center my-4">
                  <div class="spinner-border text-neon" role="status">
                    <span class="visually-hidden">Loading...</span>
                  </div>
                  <p class="mt-2 text-muted">Loading collections...</p>
                </div>
              </Show>
              
              <Show when={!isLoadingCollections() && supportedCollections().length === 0}>
                <div class="alert alert-info">
                  <i class="bi bi-info-circle me-2"></i>
                  No supported collections found.
                </div>
              </Show>
              
              <Show when={!isLoadingCollections() && supportedCollections().length > 0}>
                <div class="table-responsive">
                  <table class="table table-dark table-hover">
                    <thead>
                      <tr>
                        <th>Collection Address</th>
                        <th>Max LTV</th>
                        <th>Liquidation Threshold</th>
                        <th>Base Interest Rate</th>
                        <th class="text-end">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      <For each={supportedCollections()}>
                        {(collection) => (
                          <tr>
                            <td>
                              <span class="badge bg-secondary" style={{ "font-family": 'var(--font-mono)' }}>
                                {collection.address.substring(0, 6)}...{collection.address.substring(collection.address.length - 4)}
                              </span>
                            </td>
                            <td><span class="badge bg-info">{(Number(collection.maxLTV) / 100).toFixed(2)}%</span></td>
                            <td><span class="badge bg-warning">{(Number(collection.liquidationThreshold) / 100).toFixed(2)}%</span></td>
                            <td><span class="badge bg-success">{(Number(collection.baseInterestRate) / 100).toFixed(2)}%</span></td>
                            <td class="text-end">
                              <button 
                                class="btn btn-neon-magenta btn-sm" 
                                onClick={() => handleRemoveCollection(collection.address)}
                              >
                                <i class="bi bi-trash me-1"></i>Remove
                              </button>
                            </td>
                          </tr>
                        )}
                      </For>
                    </tbody>
                  </table>
                </div>
              </Show>
            </div>
          </Show>
          
          {/* Oracle Management Tab - Admin Only */}
          <Show when={activeTab() === 'oracle' && isAdmin()}>
            <div class="glass-container" style={{ "padding": '2rem' }}>
              <h4 class="text-neon mb-4">
                <i class="bi bi-shield-check me-2"></i>
                Oracle Management
              </h4>
              
              <form onSubmit={handleUpdateFloorPrice}>
                <div class="row">
                  <div class="col-md-8 mb-3">
                    <label for="oracleCollectionAddress" class="form-label text-secondary">Collection Address</label>
                    <input 
                      type="text" 
                      class="form-control" 
                      id="oracleCollectionAddress" 
                      placeholder="0x..." 
                      value={oracleCollectionAddress()}
                      onInput={(e) => setOracleCollectionAddress(e.currentTarget.value)}
                      required
                    />
                  </div>
                  
                  <div class="col-md-4 mb-3">
                    <label for="floorPrice" class="form-label text-secondary">Floor Price (DPSV)</label>
                    <input 
                      type="number" 
                      class="form-control" 
                      id="floorPrice" 
                      placeholder="0.1" 
                      value={floorPrice()}
                      onInput={(e) => setFloorPrice(e.currentTarget.value)}
                      min="0"
                      step="0.001"
                      required
                    />
                  </div>
                </div>
                
                <button 
                  type="submit"
                  class="btn btn-neon-yellow"
                  disabled={isProcessing() || !isReady()}
                >
                  <Show when={isProcessing()} fallback={
                    <>
                      <i class="bi bi-graph-up me-2"></i>
                      UPDATE FLOOR PRICE
                    </>
                  }>
                    <span class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                    PROCESSING...
                  </Show>
                </button>
              </form>
            </div>
          </Show>
        </div>
      </div>
    </div>
  );
};

export default SettingsPage;