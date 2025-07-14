import { Component, Show } from 'solid-js';
import { useWeb3 } from '../stores/Web3Store';

const WalletConnector: Component = () => {
  const {
    account,
    isConnecting,
    error,
    connectWallet,
    disconnectWallet,
    formatAddress,
    isConnected,
  } = useWeb3();

  return (
    <div class="d-flex align-items-center gap-2">
      <Show when={!isConnected()} fallback={
        <div class="glass-container d-flex align-items-center" style={{ 
          "padding": '0.75rem 1rem',
          "border-radius": '12px',
          "border": '1px solid var(--neon-cyan)'
        }}>
          <div class="badge bg-success glow-cyan me-2" style={{ 
            "font-family": 'var(--font-mono)',
            "padding": '0.5rem 0.75rem'
          }}>
            <i class="bi bi-wallet2 me-1"></i>
            {formatAddress(account())}
          </div>
          <button 
            class="btn btn-outline-danger btn-sm interactive-element" 
            onClick={disconnectWallet}
            style={{ "font-size": '0.8rem' }}
          >
            <i class="bi bi-power me-1"></i>Disconnect
          </button>
        </div>
      }>
        <button 
          class="btn btn-neon-cyan interactive-element" 
          disabled={isConnecting()} 
          onClick={connectWallet}
          style={{ 
            "padding": '0.75rem 1.5rem',
            "font-weight": '600',
            "font-family": 'var(--font-primary)'
          }}
        >
          <Show when={isConnecting()} fallback={
            <>
              <i class="bi bi-wallet2 me-2"></i>
              CONNECT WALLET
            </>
          }>
            <span class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
            CONNECTING...
          </Show>
        </button>
      </Show>
      
      <Show when={error()}>
        <div class="alert alert-danger p-2 ms-2" style={{ "font-size": '0.8rem' }}>
          <i class="bi bi-exclamation-triangle me-1"></i>
          {error()}
        </div>
      </Show>
    </div>
  );
};

export default WalletConnector;