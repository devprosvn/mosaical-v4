import { JsonRpcProvider, Contract } from 'ethers';
import { RPC_URL, ORACLE_ADDRESS } from '../config';

// Minimal ABI: function getFloorPrice(address collection) view returns (uint256)
const ORACLE_ABI = [
  'function getFloorPrice(address collection) view returns (uint256)',
];

const provider = new JsonRpcProvider(RPC_URL);

const oracleContract = new Contract(ORACLE_ADDRESS, ORACLE_ABI, provider);

export const getFloorPrice = async (collectionAddress: string): Promise<bigint | null> => {
  try {
    const price: bigint = await oracleContract.getFloorPrice(collectionAddress);
    return price;
  } catch (err) {
    console.error('Oracle call failed', err);
    return null;
  }
}; 