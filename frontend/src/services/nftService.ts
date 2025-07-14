import { BrowserProvider, Contract } from 'ethers';
import { CONTRACT_ADDRESSES } from '../constants/contracts';

// ERC721 ABI cần thiết để đọc NFTs
const ERC721_ABI = [
  "function balanceOf(address owner) view returns (uint256)",
  "function tokenOfOwnerByIndex(address owner, uint256 index) view returns (uint256)",
  "function ownerOf(uint256 tokenId) view returns (address)",
  "function tokenURI(uint256 tokenId) view returns (string)",
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "function supportsInterface(bytes4 interfaceId) view returns (bool)"
];

// Interface cho NFT metadata
interface NFTMetadata {
  name?: string;
  description?: string;
  image?: string;
  attributes?: Array<{
    trait_type: string;
    value: string | number;
  }>;
}

interface NFTInfo {
  tokenId: string;
  title: string;
  description: string;
  image: string;
  collectionAddress: string;
  collectionName: string;
  metadata?: NFTMetadata;
}

// Danh sách các collection được hỗ trợ
const SUPPORTED_COLLECTIONS = [
  {
    address: CONTRACT_ADDRESSES.MockGameNFT,
    name: "Mock Game NFT",
    symbol: "TGNFT"
  }
  // Có thể thêm các collection khác ở đây
];

/**
 * Lấy danh sách NFTs từ một collection cụ thể
 */
async function getNFTsFromCollection(
  provider: BrowserProvider, 
  userAddress: string, 
  collectionAddress: string,
  collectionName: string
): Promise<NFTInfo[]> {
  try {
    const contract = new Contract(collectionAddress, ERC721_ABI, provider);
    
    // Kiểm tra xem contract có phải ERC721 không
    try {
      const isERC721 = await contract.supportsInterface('0x80ac58cd');
      if (!isERC721) {
        console.log(`Contract ${collectionAddress} is not ERC721`);
        return [];
      }
    } catch (e) {
      console.log(`Cannot check interface for ${collectionAddress}`);
    }

    // Lấy số lượng NFTs của user
    const balance = await contract.balanceOf(userAddress);
    const balanceNum = parseInt(balance.toString());
    
    if (balanceNum === 0) {
      return [];
    }

    console.log(`Found ${balanceNum} NFTs in collection ${collectionName}`);

    const nfts: NFTInfo[] = [];

    // Lấy từng NFT bằng tokenOfOwnerByIndex (nếu contract hỗ trợ)
    try {
      for (let i = 0; i < balanceNum; i++) {
        try {
          const tokenId = await contract.tokenOfOwnerByIndex(userAddress, i);
          const nft = await processNFT(contract, tokenId.toString(), collectionAddress, collectionName);
          if (nft) {
            nfts.push(nft);
          }
        } catch (e) {
          console.error(`Error getting NFT at index ${i}:`, e);
        }
      }
    } catch (e) {
      // Nếu contract không hỗ trợ tokenOfOwnerByIndex, fallback sang scan method
      console.log(`Collection ${collectionName} doesn't support enumeration, using scan method`);
      return await scanNFTsByOwnership(contract, userAddress, collectionAddress, collectionName, balanceNum);
    }

    return nfts;
  } catch (error) {
    console.error(`Error fetching NFTs from ${collectionName}:`, error);
    return [];
  }
}

/**
 * Fallback method: Scan NFTs bằng cách kiểm tra ownership
 */
async function scanNFTsByOwnership(
  contract: Contract,
  userAddress: string,
  collectionAddress: string,
  collectionName: string,
  expectedCount: number
): Promise<NFTInfo[]> {
  const nfts: NFTInfo[] = [];
  const maxScan = 10000; // Giới hạn scan để tránh infinite loop
  
  for (let tokenId = 0; tokenId < maxScan && nfts.length < expectedCount; tokenId++) {
    try {
      const owner = await contract.ownerOf(tokenId);
      if (owner.toLowerCase() === userAddress.toLowerCase()) {
        const nft = await processNFT(contract, tokenId.toString(), collectionAddress, collectionName);
        if (nft) {
          nfts.push(nft);
        }
      }
    } catch (e) {
      // Token không tồn tại hoặc lỗi khác, tiếp tục scan
      continue;
    }
  }
  
  return nfts;
}

/**
 * Xử lý thông tin của một NFT cụ thể
 */
async function processNFT(
  contract: Contract,
  tokenId: string,
  collectionAddress: string,
  collectionName: string
): Promise<NFTInfo | null> {
  try {
    let metadata: NFTMetadata = {};
    let title = `${collectionName} #${tokenId}`;
    let description = 'GameFi NFT Asset';
    let image = `https://via.placeholder.com/300/0a0a1a/00f6ff?text=NFT+%23${tokenId}`;

    // Lấy metadata từ tokenURI
    try {
      const tokenURI = await contract.tokenURI(tokenId);
      if (tokenURI) {
        metadata = await fetchNFTMetadata(tokenURI);
        if (metadata.name) title = metadata.name;
        if (metadata.description) description = metadata.description;
        if (metadata.image) image = metadata.image;
      }
    } catch (e) {
      console.log(`Cannot fetch metadata for token ${tokenId}:`, e);
    }

    return {
      tokenId,
      title,
      description,
      image,
      collectionAddress,
      collectionName,
      metadata
    };
  } catch (error) {
    console.error(`Error processing NFT ${tokenId}:`, error);
    return null;
  }
}

/**
 * Fetch metadata từ tokenURI
 */
async function fetchNFTMetadata(tokenURI: string): Promise<NFTMetadata> {
  try {
    // Xử lý data URI (base64)
    if (tokenURI.startsWith('data:application/json;base64,')) {
      const base64Data = tokenURI.split(',')[1];
      const jsonString = atob(base64Data);
      return JSON.parse(jsonString);
    }
    
    // Xử lý data URI (plain JSON)
    if (tokenURI.startsWith('data:application/json,')) {
      const jsonString = decodeURIComponent(tokenURI.split(',')[1]);
      return JSON.parse(jsonString);
    }
    
    // Xử lý HTTP/HTTPS URL
    if (tokenURI.startsWith('http')) {
      const response = await fetch(tokenURI);
      if (response.ok) {
        return await response.json();
      }
    }
    
    // Xử lý IPFS URL
    if (tokenURI.startsWith('ipfs://')) {
      const ipfsHash = tokenURI.replace('ipfs://', '');
      const ipfsUrl = `https://ipfs.io/ipfs/${ipfsHash}`;
      const response = await fetch(ipfsUrl);
      if (response.ok) {
        return await response.json();
      }
    }
    
    return {};
  } catch (error) {
    console.error('Error fetching NFT metadata:', error);
    return {};
  }
}

/**
 * Lấy tất cả NFTs của user từ các collection được hỗ trợ
 */
export async function getUserNFTs(provider: BrowserProvider, userAddress: string): Promise<NFTInfo[]> {
  console.log('🔍 Fetching NFTs for user:', userAddress);
  
  const allNFTs: NFTInfo[] = [];
  
  // Lấy NFTs từ tất cả các collection được hỗ trợ
  for (const collection of SUPPORTED_COLLECTIONS) {
    try {
      const nfts = await getNFTsFromCollection(
        provider, 
        userAddress, 
        collection.address, 
        collection.name
      );
      allNFTs.push(...nfts);
      console.log(`Found ${nfts.length} NFTs in ${collection.name}`);
    } catch (error) {
      console.error(`Error fetching from ${collection.name}:`, error);
    }
  }
  
  console.log(`Total NFTs found: ${allNFTs.length}`);
  return allNFTs;
}

/**
 * Lấy NFTs từ một collection cụ thể (để sử dụng trong admin panel)
 */
export async function getNFTsFromSpecificCollection(
  provider: BrowserProvider,
  userAddress: string,
  collectionAddress: string
): Promise<NFTInfo[]> {
  try {
    const contract = new Contract(collectionAddress, ERC721_ABI, provider);
    const name = await contract.name();
    return await getNFTsFromCollection(provider, userAddress, collectionAddress, name);
  } catch (error) {
    console.error('Error fetching from specific collection:', error);
    return [];
  }
}

/**
 * Kiểm tra xem một địa chỉ có phải là ERC721 contract không
 */
export async function isERC721Contract(provider: BrowserProvider, address: string): Promise<boolean> {
  try {
    const contract = new Contract(address, ERC721_ABI, provider);
    return await contract.supportsInterface('0x80ac58cd');
  } catch (error) {
    return false;
  }
}