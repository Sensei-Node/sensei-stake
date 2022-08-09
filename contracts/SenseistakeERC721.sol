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
    ISenseistakeServicesContract _serviceContract;

    constructor(string memory name, string memory symbol) ERC721(name, symbol) {}

    // function _baseURI() internal pure override returns (string memory) {
    //     return "https://example.com/nft/";
    // }

     //function safeMint(address to, string memory uri) public onlyOwner {
     function safeMint(address to, address serviceContractAddress) public onlyOwner returns (uint256){
        
         uint256 tokenId = _tokenIdCounter.current();
         _tokenIdCounter.increment();
         _safeMint(to, tokenId);
         //_setTokenURI(tokenId, uri);
         _setServiceContract(ISenseistakeServicesContract(serviceContractAddress));
         return tokenId;
     }

    // The following functions are overrides required by Solidity.

    // function _burn(uint256 tokenId) internal override(ERC721, ERC721URIStorage) {
    //      super._burn(tokenId);
    // }

    function _setServiceContract(ISenseistakeServicesContract serviceContract) private  {
        _serviceContract = serviceContract;
    }

    // function tokenURI(uint256 tokenId)
    //     public
    //     view
    //     override(ERC721, ERC721URIStorage)
    //     returns (string memory)
    // {
    //     return super.tokenURI(tokenId);
    // }
}
