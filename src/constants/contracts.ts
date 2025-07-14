@@ .. @@
 // Contract addresses - replace with actual deployed addresses
 export const CONTRACT_ADDRESSES = {
   NFTVault: "0x32B3275Fa5E3E52AF6c42C9143699086dc83E760",
   DPOToken: "0x8dd2383361aA2bcF7a1B41BA2E8Cbd831809a852",
   GameFiOracle: "0x46f7F373864ffF22c7280CD91C26Fe7eb904dc35",
   MosaicalGovernance: "0x5B8A466F95f12cD36d8692B2371047FBb12D2841",
   MockGameNFT: "0x9BD14Eb8581F1B47f01836657BFe572D799610D9" // Replace with actual address when available
 };

+// Danh sách các collection NFT được hỗ trợ
+export const SUPPORTED_NFT_COLLECTIONS = [
+  {
+    address: "0x9BD14Eb8581F1B47f01836657BFe572D799610D9",
+    name: "Mock Game NFT",
+    symbol: "TGNFT",
+    type: "ERC721"
+  }
+  // Thêm các collection khác ở đây khi cần
+];

 // Supported networks
 export const SUPPORTED_NETWORKS = {
   // Saga devpros
   2749656616387000: {
     name: "Devpros Chainlet",
     rpcUrl: "https://devpros-2749656616387000-1.jsonrpc.sagarpc.io",
     blockExplorer: "https://devpros-2749656616387000-1.sagaexplorer.io",
     currency: {
       name: "devpros",
       symbol: "DPSV",
       decimals: 18
     }
   }
   // Add more networks as needed
 };