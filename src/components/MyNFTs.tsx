@@ .. @@
 import { Component, createSignal, createEffect, For, Show } from 'solid-js';
 import { useWeb3 } from '../stores/Web3Store';
 import { useContracts } from '../hooks/useContracts';
-import { CONTRACT_ADDRESSES } from '../constants/contracts';
-import { Contract } from 'ethers';
+import { getUserNFTs } from '../services/nftService';
+import { CONTRACT_ADDRESSES } from '../constants/contracts';

 interface NFTCardProps {
-  tokenId: string;
+  nft: {
+    tokenId: string;
+    title: string;
+    description: string;
+    image: string;
+    collectionAddress: string;
+    collectionName: string;
+  };
   onDeposit: (tokenId: string) => void;
 }

 // Component to display a single NFT card
 const NFTCardItem: Component<NFTCardProps> = (props) => {
   return (
     <div class="col-12 col-sm-6 col-md-4 col-lg-3 mb-4">
       <div class="glass-container mosaic-frame interactive-element" style={{ "height": '100%' }}>
         {/* Hexagonal NFT Image */}
         <div class="hexagon-container" style={{ "margin": '1rem auto 0.5rem' }}>
           <div class="hexagon">
             <img 
-              src={`https://via.placeholder.com/300/0a0a1a/00f6ff?text=NFT+%23${props.tokenId}`}
-              alt={`NFT #${props.tokenId}`}
+              src={props.nft.image}
+              alt={props.nft.title}
               loading="lazy"
             />
           </div>
         </div>
         
         <div class="card-body text-center" style={{ "padding": '1rem' }}>
           <h5 class="text-neon mb-2" style={{ "font-family": 'var(--font-primary)' }}>
-            Test Game NFT #{props.tokenId}
+            {props.nft.title}
           </h5>
           <p class="text-secondary mb-3" style={{ "font-size": '0.9rem' }}>
-            GameFi NFT ready for collateralization
+            {props.nft.description}
           </p>
           
           <div class="mb-3">
-            <div class="badge bg-info mb-2">Token #{props.tokenId}</div>
+            <div class="badge bg-info mb-2">Token #{props.nft.tokenId}</div>
+            <div class="badge bg-success mb-2">{props.nft.collectionName}</div>
             <div class="badge bg-secondary" style={{ 
               "font-family": 'var(--font-mono)', 
               "font-size": '0.7rem',
               "display": 'block'
             }}>
-              {CONTRACT_ADDRESSES.MockGameNFT.substring(0, 6)}...{CONTRACT_ADDRESSES.MockGameNFT.substring(CONTRACT_ADDRESSES.MockGameNFT.length - 4)}
+              {props.nft.collectionAddress.substring(0, 6)}...{props.nft.collectionAddress.substring(props.nft.collectionAddress.length - 4)}
             </div>
           </div>
           
           <button 
             class="btn btn-neon-cyan w-100" 
-            onClick={() => props.onDeposit(props.tokenId)}
+            onClick={() => props.onDeposit(props.nft.tokenId)}
           >
             <i class="bi bi-safe me-2"></i>
             DEPOSIT
           </button>
         </div>
       </div>
     </div>
   );
 };

@@ .. @@
 const MyNFTs: Component<MyNFTsProps> = (props) => {
   const web3 = useWeb3();
   const { contractService } = useContracts();
   
-  const [ownedNFTs, setOwnedNFTs] = createSignal<{tokenId: string}[]>([]);
+  const [ownedNFTs, setOwnedNFTs] = createSignal<any[]>([]);
   const [isLoading, setIsLoading] = createSignal(false);
   const [error, setError] = createSignal<string | null>(null);

   // Fetch user's NFTs when account changes
   createEffect(() => {
     const account = web3.account();
     const provider = web3.provider();
     
     const fetchOwnedNFTs = async () => {
       if (!account || !provider) return;

       setIsLoading(true);
       setError('');
       setOwnedNFTs([]); 

       try {
-        // 1. Create contract instance to interact with MockGameNFT
-        const contract = new Contract(
-          CONTRACT_ADDRESSES.MockGameNFT, 
-          [
-            "function balanceOf(address owner) view returns (uint256)",
-            "function ownerOf(uint256 tokenId) view returns (address)"
-          ], 
-          provider
-        );
-        const userNFTs = [];
-
-        // 2. Get total NFTs owned by the user
-        const balance = await contract.balanceOf(account);
-        if (balance.toString() === "0") {
-          setIsLoading(false);
-          return;
-        }
-
-        // 3. Scan through token IDs to find user's NFTs
-        // Simple approach for MVP, not optimized for large collections
-        for (let i = 0; userNFTs.length < parseInt(balance.toString()); i++) {
-          try {
-            const owner = await contract.ownerOf(i);
-            if (owner.toLowerCase() === account.toLowerCase()) {
-              // Found one of the user's NFTs!
-              userNFTs.push({ tokenId: i.toString() });
-            }
-          } catch (e) {
-            // Skip "token doesn't exist" errors as we're scanning
-            if (i > 100) break; // Set a scan limit to avoid infinite loop
-          }
-        }
+        // Sử dụng service mới để lấy NFTs
+        const userNFTs = await getUserNFTs(provider, account);
         
         setOwnedNFTs(userNFTs);

       } catch (err) {
         console.error("Failed to fetch NFTs from contract:", err);
         setError('Could not fetch NFT data from the contract.');
       } finally {
         setIsLoading(false);
       }
     };

     if (account && provider) {
       fetchOwnedNFTs();
     }
   });

   // Handle depositing an NFT
-  const handleDepositNFT = async (tokenId: string) => {
+  const handleDepositNFT = async (tokenId: string, collectionAddress?: string) => {
     if (!contractService) {
       alert('Contract service not available');
       return;
     }

     try {
-      const collectionAddress = CONTRACT_ADDRESSES.MockGameNFT;
+      // Tìm NFT để lấy collection address
+      const nft = ownedNFTs().find(n => n.tokenId === tokenId);
+      const collection = collectionAddress || nft?.collectionAddress || CONTRACT_ADDRESSES.MockGameNFT;
       
-      await contractService.depositNFT(collectionAddress, tokenId);
+      await contractService.depositNFT(collection, tokenId);
       alert('NFT successfully deposited!');
       
       // Notify parent component to refresh vault assets
       if (props.onNFTDeposited) {
         props.onNFTDeposited();
       }
     } catch (err) {
       console.error('Error depositing NFT:', err);
       alert(`Failed to deposit NFT: ${(err as Error).message || err}`);
     }
   };

@@ .. @@
       <div class="row g-4">
         <For each={ownedNFTs()}>
           {(nft) => (
             <NFTCardItem 
-              tokenId={nft.tokenId} 
-              onDeposit={handleDepositNFT}
+              nft={nft}
+              onDeposit={(tokenId) => handleDepositNFT(tokenId, nft.collectionAddress)}
             />
           )}
         </For>
       </div>
     </div>
   );
 };

 export default MyNFTs;