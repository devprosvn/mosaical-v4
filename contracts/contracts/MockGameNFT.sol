// SPDX-License-Identifier: MIT
pragma solidity ^0.8.21;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Strings.sol";
import "base64-sol/base64.sol";

contract MockGameNFT is ERC721, Ownable {
    using Strings for uint256;
    uint256 private _nextTokenId;

    constructor(string memory name, string memory symbol)
        ERC721(name, symbol)
        Ownable(msg.sender)
    {}

    function mint(address to, uint256 tokenId) public onlyOwner {
        _safeMint(to, tokenId);
    }

    function safeMint(address to) public {
        uint256 tokenId = _nextTokenId++;
        _safeMint(to, tokenId);
    }

    function exists(uint256 tokenId) external view returns (bool) {
        return _ownerOf(tokenId) != address(0);
    }

    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        require(ownerOf(tokenId) != address(0), "Token does not exist");
        
        // Return Base64-encoded JSON metadata instead of CoinGecko API reference
        string memory json = Base64.encode(
            abi.encodePacked(
                '{"name": "Test Game NFT #', 
                Strings.toString(tokenId), 
                '", "description": "A mock GameFi NFT for testing", "image": "ipfs://QmTestImage", "attributes": [{"trait_type": "Level", "value": "50"}, {"trait_type": "Rarity", "value": "Epic"}]}'
            )
        );
        return string(abi.encodePacked('data:application/json;base64,', json));
    }
}