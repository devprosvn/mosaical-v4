import { Component, ParentComponent, Show } from 'solid-js';
import { A } from '@solidjs/router';
import WalletConnector from '../components/WalletConnector';
import { useWeb3 } from '../stores/Web3Store';
import { useAdmin } from '../hooks/useAdmin';

const MainLayout: ParentComponent = (props) => {
  const { isConnected } = useWeb3();
  const { isAdmin } = useAdmin();
  
  return (
    <div style={{ "min-height": '100vh', "display": 'flex', "flex-direction": 'column' }}>
      <header>
        <nav class="navbar navbar-expand-lg glass-container" style={{ 
          "margin": '1rem', 
          "border-radius": '16px',
          "backdrop-filter": 'blur(25px)'
        }}>
          <div class="container-fluid">
            <A class="navbar-brand fw-bold text-neon" href="/" style={{ 
              "font-family": 'var(--font-primary)', 
              "font-size": '1.8rem',
              "text-shadow": '0 0 20px var(--neon-cyan)'
            }}>
              MOSAICAL
            </A>
            
            <button class="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#navbarMain">
              <span class="navbar-toggler-icon"></span>
            </button>
            
            <div class="collapse navbar-collapse" id="navbarMain">
              <Show when={isConnected()}>
                <ul class="navbar-nav mx-auto">
                  <li class="nav-item">
                    <A class="nav-link interactive-element" href="/" end>
                      <i class="bi bi-grid-3x3-gap me-2"></i>Dashboard
                    </A>
                  </li>
                  <li class="nav-item">
                    <A class="nav-link interactive-element" href="/dpo-tokens">
                      <i class="bi bi-currency-exchange me-2"></i>DPO Tokens
                    </A>
                  </li>
                  <li class="nav-item">
                    <A class="nav-link interactive-element" href="/loans">
                      <i class="bi bi-bank me-2"></i>Loans
                    </A>
                  </li>
                  <li class="nav-item">
                    <A class="nav-link interactive-element" href="/settings">
                      <i class="bi bi-gear me-2"></i>Settings
                    </A>
                  </li>
                </ul>
              </Show>
            </div>
            
            <div class="ms-auto d-flex align-items-center gap-3">
              <Show when={isAdmin()}>
                <span class="badge bg-danger glow-magenta" style={{ 
                  "font-family": 'var(--font-mono)',
                  "padding": '0.5rem 1rem'
                }}>
                  <i class="bi bi-shield-check me-1"></i>ADMIN
                </span>
              </Show>
              <WalletConnector />
            </div>
          </div>
        </nav>
      </header>
      
      <main class="flex-grow-1" style={{ "padding": '0 1rem' }}>
        {props.children}
      </main>
      
      <footer class="text-center py-4 mt-5">
        <div class="glass-container" style={{ 
          "margin": '1rem',
          "padding": '1rem',
          "border-radius": '16px'
        }}>
          <p class="mb-0 text-muted">
            <span class="text-neon">MOSAICAL</span> &copy; {new Date().getFullYear()} - 
            Fractionalized GameFi NFT Lending Protocol
          </p>
          <small class="text-muted">
            Powered by <span class="text-neon-magenta">Glassmorphism</span> + 
            <span class="text-neon-yellow">Cyberpunk</span> + 
            <span class="text-neon">Mosaic</span> Design
          </small>
        </div>
      </footer>
    </div>
  );
};

export default MainLayout;