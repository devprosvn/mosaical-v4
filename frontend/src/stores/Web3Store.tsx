import { createSignal, createEffect, createContext, useContext, ParentComponent } from 'solid-js';
import { BrowserProvider } from 'ethers';

interface Web3ContextValue {
  provider: () => BrowserProvider | null;
  signer: () => any;
  account: () => string | null;
  chainId: () => bigint | number | null;
  isConnecting: () => boolean;
  isConnected: () => boolean;
  error: () => string | null;
  connectWallet: () => Promise<void>;
  disconnectWallet: () => void;
  formatAddress: (address: string | null) => string;
}

const Web3Context = createContext<Web3ContextValue>();

export const useWeb3 = (): Web3ContextValue => {
  const ctx = useContext(Web3Context);
  if (!ctx) throw new Error('useWeb3 must be used within Web3Provider');
  return ctx;
};

export const Web3Provider: ParentComponent = (props) => {
  const [provider, setProvider] = createSignal<BrowserProvider | null>(null);
  const [signer, setSigner] = createSignal<any>(null);
  const [account, setAccount] = createSignal<string | null>(null);
  const [chainId, setChainId] = createSignal<bigint | number | null>(null);
  const [isConnecting, setIsConnecting] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);

  // Check for an existing connection when the component mounts
  createEffect(() => {
    const checkExistingConnection = async () => {
      if (!(window as any).ethereum) return;
      
      try {
        // Get accounts that are already connected
        const accounts = await (window as any).ethereum.request({ method: 'eth_accounts' });
        
        if (accounts.length > 0) {
          // User is already connected, restore the connection
          console.log('Restoring existing wallet connection:', accounts[0]);
          const ethersProvider = new BrowserProvider((window as any).ethereum);
          const ethersSigner = await ethersProvider.getSigner();
          const network = await ethersProvider.getNetwork();

          setProvider(ethersProvider);
          setSigner(ethersSigner);
          setAccount(accounts[0]);
          setChainId(network.chainId);
        }
      } catch (e) {
        console.error('Error checking existing connection:', e);
      }
    };
    
    checkExistingConnection();
  });

  const connectWallet = async () => {
    if (!(window as any).ethereum) {
      setError('Please install MetaMask or another Ethereum wallet');
      return;
    }
    try {
      setIsConnecting(true);
      setError(null);
      const accounts: string[] = await (window as any).ethereum.request({ method: 'eth_requestAccounts' });
      const ethersProvider = new BrowserProvider((window as any).ethereum);
      const ethersSigner = await ethersProvider.getSigner();
      const network = await ethersProvider.getNetwork();

      setProvider(ethersProvider);
      setSigner(ethersSigner);
      setAccount(accounts[0]);
      setChainId(network.chainId);
    } catch (e: any) {
      console.error(e);
      setError(e?.message ?? 'Failed to connect wallet');
    } finally {
      setIsConnecting(false);
    }
  };

  const disconnectWallet = () => {
    setProvider(null);
    setSigner(null);
    setAccount(null);
    setChainId(null);
  };

  const formatAddress = (addr: string | null) => {
    if (!addr) return '';
    return `${addr.substring(0, 6)}...${addr.substring(addr.length - 4)}`;
  };

  // Listen for account / chain changes
  createEffect(() => {
    if (!(window as any).ethereum) return;
    const handleAccountsChanged = (accounts: string[]) => {
      if (accounts.length === 0) disconnectWallet();
      else setAccount(accounts[0]);
    };
    
    // Update this to avoid full page reload which loses state
    const handleChainChanged = async (chainIdHex: string) => {
      try {
        const newChainId = BigInt(chainIdHex);
        setChainId(newChainId);
        
        // Update provider and signer for new chain
        if (account()) {
          const ethersProvider = new BrowserProvider((window as any).ethereum);
          const ethersSigner = await ethersProvider.getSigner();
          
          setProvider(ethersProvider);
          setSigner(ethersSigner);
        }
      } catch (e) {
        console.error('Error handling chain change:', e);
      }
    };
    
    (window as any).ethereum.on('accountsChanged', handleAccountsChanged);
    (window as any).ethereum.on('chainChanged', handleChainChanged);
    return () => {
      (window as any).ethereum.removeListener('accountsChanged', handleAccountsChanged);
      (window as any).ethereum.removeListener('chainChanged', handleChainChanged);
    };
  });

  const value: Web3ContextValue = {
    provider,
    signer,
    account,
    chainId,
    isConnecting,
    isConnected: () => !!account(),
    error,
    connectWallet,
    disconnectWallet,
    formatAddress,
  } as Web3ContextValue;

  return <Web3Context.Provider value={value}>{props.children}</Web3Context.Provider>;
}; 