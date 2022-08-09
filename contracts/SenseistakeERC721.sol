// SPDX-License-Identifier: MIT
pragma solidity 0.8.4;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Counters.sol";
import "./interfaces/ISenseistakeServicesContract.sol";

contract SenseistakeERC721 is ERC721, Ownable {
    using Counters for Counters.Counter;

    Counters.Counter private _tokenIdCounter;
    // Mapping from token ID to owner address
    mapping(uint256 => address) private _serviceContracts;

    constructor(string memory name, string memory symbol) ERC721(name, symbol) {}

    // function _baseURI() internal pure override returns (string memory) {
    //     return "https://example.com/nft/";
    // }

    function _afterTokenTransfer(
        address from,
        address to,
        uint256 tokenId
    )  internal virtual override(ERC721)  {
        super._afterTokenTransfer(from, to, tokenId);
        if(to == address(0)){
            //burn
            delete _serviceContracts[tokenId];
        }else{
            // mint y transfer
            _serviceContracts[tokenId] = to;
        }

    }

     //function safeMint(address to, string memory uri) public onlyOwner {
     function safeMint(address to) public onlyOwner returns (uint256){
        
         uint256 tokenId = _tokenIdCounter.current();
         _tokenIdCounter.increment();
         _safeMint(to, tokenId);
         //_setTokenURI(tokenId, uri);
         return tokenId;
     }

     function burn(uint tokenId) public {
        _burn(tokenId);
     }

    // The following functions are overrides required by Solidity 
    //  function _burn(uint256 tokenId) internal override(ERC721, ERC721URIStorage) {
    //       super._burn(tokenId);
    //  }

    // function tokenURI(uint256 tokenId)
    //     public
    //     view
    //     override(ERC721, ERC721URIStorage)
    //     returns (string memory)
    // {
    //     return super.tokenURI(tokenId);
    // }
}
