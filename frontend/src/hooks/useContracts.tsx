import { createSignal, createEffect, createMemo } from 'solid-js';
import { useWeb3 } from '../stores/Web3Store';
import { ContractService } from '../services/contractService';
import { SUPPORTED_NETWORKS } from '../constants/contracts';

export const useContracts = () => {
  const web3 = useWeb3();
  const [contractService, setContractService] = createSignal<ContractService | null>(null);
  const [isReady, setIsReady] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);

  // Initialize contract service when provider/signer changes
  createEffect(() => {
    const provider = web3.provider();
    const signer = web3.signer();
    const chainId = web3.chainId();

    // Reset first
    setContractService(null);
    setIsReady(false);
    setError(null);

    if (!provider) return;

    // Check supported network
    if (!chainId || !(Number(chainId) in SUPPORTED_NETWORKS)) {
      setError('Unsupported network');
      return;
    }

    (async () => {
      try {
        const service = new ContractService(provider, signer);
        setContractService(service);
        setIsReady(true);
      } catch (err: any) {
        console.error('ContractService init failed', err);
        setError(err?.message || 'Initialization failed');
      }
    })();
  });

  return { contractService: contractService(), isReady, error };
}; 