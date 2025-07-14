import { Component, createSignal } from 'solid-js';
import VaultAssets from '../components/VaultAssets';
import MyNFTs from '../components/MyNFTs';
import { useWeb3 } from '../stores/Web3Store';

const DashboardPage: Component = () => {
  const web3 = useWeb3();
  const [refreshTrigger, setRefreshTrigger] = createSignal(0);
  const [activeTab, setActiveTab] = createSignal('vault');

  // Handler to refresh data when NFT is deposited
  const handleNFTDeposited = () => {
    setRefreshTrigger(prev => prev + 1);
    // Switch to vault tab to show the newly deposited NFT
    setActiveTab('vault');
  };

  return (
    <div class="container-fluid mt-4">
      <div class="glass-container mosaic-frame" style={{ "margin-bottom": '2rem' }}>
        <div class="text-center mb-4">
          <h1 class="text-neon mb-3" style={{ 
            "font-family": 'var(--font-primary)', 
            "font-size": '3rem',
            "text-shadow": '0 0 30px var(--neon-cyan)'
          }}>
            DASHBOARD
          </h1>
          <p class="text-secondary" style={{ "font-size": '1.1rem' }}>
            Manage your GameFi NFT collateral and DPO positions
          </p>
        </div>
        
        {/* Only show tabs when wallet is connected */}
        {web3.isConnected() ? (
          <>
            {/* Cyberpunk-style Navigation Tabs */}
            <ul class="nav nav-tabs mb-4" style={{ "border-bottom": 'none' }}>
              <li class="nav-item">
                <button 
                  class={`nav-link ${activeTab() === 'vault' ? 'active' : ''}`} 
                  onClick={() => setActiveTab('vault')}
                  style={{ 
                    "background": activeTab() === 'vault' ? 'var(--glass-bg)' : 'transparent',
                    "border": '1px solid var(--glass-border)',
                    "color": activeTab() === 'vault' ? 'var(--neon-cyan)' : 'var(--text-secondary)',
                    "font-family": 'var(--font-primary)',
                    "font-weight": '600',
                    "margin-right": '0.5rem',
                    "border-radius": '12px 12px 0 0',
                    "transition": 'all 0.3s ease'
                  }}
                >
                  <i class="bi bi-safe me-2"></i>
                  YOUR VAULT
                </button>
              </li>
              <li class="nav-item">
                <button 
                  class={`nav-link ${activeTab() === 'wallet' ? 'active' : ''}`} 
                  onClick={() => setActiveTab('wallet')}
                  style={{ 
                    "background": activeTab() === 'wallet' ? 'var(--glass-bg)' : 'transparent',
                    "border": '1px solid var(--glass-border)',
                    "color": activeTab() === 'wallet' ? 'var(--neon-cyan)' : 'var(--text-secondary)',
                    "font-family": 'var(--font-primary)',
                    "font-weight": '600',
                    "border-radius": '12px 12px 0 0',
                    "transition": 'all 0.3s ease'
                  }}
                >
                  <i class="bi bi-wallet2 me-2"></i>
                  WALLET NFTs
                </button>
              </li>
            </ul>

            {/* Tab content with enhanced styling */}
            <div class="tab-content">
              {activeTab() === 'vault' && (
                <div class="glass-container" style={{ 
                  "padding": '2rem',
                  "border-radius": '0 16px 16px 16px',
                  "border-top": '2px solid var(--neon-cyan)'
                }}>
                  <VaultAssets refreshTrigger={refreshTrigger()} />
                </div>
              )}
              {activeTab() === 'wallet' && (
                <div class="glass-container" style={{ 
                  "padding": '2rem',
                  "border-radius": '0 16px 16px 16px',
                  "border-top": '2px solid var(--neon-cyan)'
                }}>
                  <MyNFTs onNFTDeposited={handleNFTDeposited} />
                </div>
              )}
            </div>
          </>
        ) : (
          <div class="alert alert-info text-center" style={{ 
            "background": 'var(--glass-bg)',
            "border": '1px solid var(--neon-cyan)',
            "color": 'var(--neon-cyan)',
            "padding": '2rem'
          }}>
            <i class="bi bi-wallet2" style={{ "font-size": '3rem', "margin-bottom": '1rem' }}></i>
            <h4 class="text-neon">Connect Your Wallet</h4>
            <p class="mb-0">Connect your wallet to view your dashboard and manage your NFT collateral.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default DashboardPage;