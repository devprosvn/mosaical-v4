import { createMemo } from 'solid-js';
import { useWeb3 } from '../stores/Web3Store';
import { MASTER_ADMIN } from '../constants/admin';
import { useContracts } from '../hooks/useContracts';

/**
 * useAdmin – returns reactive boolean isAdmin
 *   1. True if current account matches MASTER_ADMIN (case-insensitive)
 *   2. Fallback: if ContractService owner() equals account (for future flexibility)
 */
export const useAdmin = () => {
  const web3 = useWeb3();
  const { contractService } = useContracts();

  // Quick client-side check against master admin constant
  const localCheck = createMemo(() => {
    const acc = web3.account();
    if (!acc) return false;
    return acc.toLowerCase() === MASTER_ADMIN.toLowerCase();
  });

  // Optional on-chain owner check (non-reactive promise) – expensive, so only when asked
  const checkOwnerOnChain = async () => {
    if (!contractService || !web3.account()) return false;
    try {
      return await contractService.isContractOwner(web3.account()!);
    } catch {
      return false;
    }
  };

  return {
    isAdmin: localCheck,
    checkOwnerOnChain
  };
}; 