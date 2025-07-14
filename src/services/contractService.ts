@@ .. @@
   // Get NFTs deposited by a user
   async getUserDeposits(userAddress: string) {
     if (!this.nftVault) throw new Error('NFT Vault contract not initialized');
     
     try {
       // Query the depositsByOwner mapping - this emits events so we need to listen to them
       const filter = this.nftVault.filters.NFTDeposited(userAddress);
       const events = await this.nftVault.queryFilter(filter);
       
       // Process events to get unique NFT deposits (handling deposits/withdrawals)
       const deposits = [];
       const withdrawnNFTs = new Set(); // Track withdrawn NFTs
       
       // First, check for withdrawn NFTs
       const withdrawFilter = this.nftVault.filters.NFTWithdrawn(userAddress);
       const withdrawEvents = await this.nftVault.queryFilter(withdrawFilter);
       
       // Add all withdrawn NFTs to our tracking set
       for (const event of withdrawEvents) {
         const { collectionAddress, tokenId } = event.args;
         withdrawnNFTs.add(`${collectionAddress}-${tokenId}`);
       }
       
       // Now process deposit events, excluding those that were later withdrawn
       for (const event of events) {
         const { collectionAddress, tokenId } = event.args;
         const key = `${collectionAddress}-${tokenId}`;
         
         // Skip if this NFT was withdrawn
         if (withdrawnNFTs.has(key)) continue;
         
         // Add to our deposits array
         deposits.push({
           collectionAddress,
           tokenId
         });
       }
       
       return deposits;
     } catch (error) {
       console.error('Error getting user deposits:', error);
       throw error;
     }
   }

+  // Lấy thông tin chi tiết của một NFT
+  async getNFTDetails(collectionAddress: string, tokenId: number | string) {
+    try {
+      const nftContract = new Contract(
+        collectionAddress,
+        [
+          "function tokenURI(uint256 tokenId) view returns (string)",
+          "function name() view returns (string)",
+          "function symbol() view returns (string)",
+          "function ownerOf(uint256 tokenId) view returns (address)"
+        ],
+        this.provider
+      );
+
+      const [tokenURI, name, symbol, owner] = await Promise.all([
+        nftContract.tokenURI(tokenId).catch(() => ''),
+        nftContract.name().catch(() => 'Unknown'),
+        nftContract.symbol().catch(() => 'UNK'),
+        nftContract.ownerOf(tokenId).catch(() => '')
+      ]);

+      return {
+        tokenId: tokenId.toString(),
+        tokenURI,
+        collectionName: name,
+        collectionSymbol: symbol,
+        owner,
+        collectionAddress
+      };
+    } catch (error) {
+      console.error('Error getting NFT details:', error);
+      throw error;
+    }
+  }

   // Deposit NFT into vault
   async depositNFT(collectionAddress: string, tokenId: number | string) {
-    if (!this.nftVault || !this.mockGameNFT || !this.signer) 
+    if (!this.nftVault || !this.signer) 
       throw new Error('Contracts not initialized or signer not available');
     
     try {
+      // Tạo contract instance cho collection cụ thể
+      const nftContract = new Contract(
+        collectionAddress,
+        [
+          "function approve(address to, uint256 tokenId) external",
+          "function ownerOf(uint256 tokenId) view returns (address)"
+        ],
+        this.signer
+      );
+
       // First approve the vault to transfer the NFT
       console.log(`Approving NFT transfer: Collection ${collectionAddress}, Token ID ${tokenId}`);
-      const approveTx = await this.mockGameNFT.approve(CONTRACT_ADDRESSES.NFTVault, tokenId);
+      const approveTx = await nftContract.approve(CONTRACT_ADDRESSES.NFTVault, tokenId);
       await approveTx.wait();
       
       console.log('Approval successful, now depositing NFT...');
       
       // Then deposit the NFT
       const depositTx = await this.nftVault.depositNFT(collectionAddress, tokenId);
       await depositTx.wait();
       
       console.log('NFT deposit successful!');
       return true;
     } catch (error) {
       console.error('Error depositing NFT:', error);
       throw error;
     }
   }