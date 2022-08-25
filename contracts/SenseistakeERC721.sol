// SPDX-License-Identifier: MIT
pragma solidity 0.8.4;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./SenseistakeBase.sol";
import "./interfaces/ISenseistakeServicesContract.sol";
import "./interfaces/ISenseistakeServicesContractFactory.sol";
import "@openzeppelin/contracts/utils/Strings.sol";

contract SenseistakeERC721 is ERC721, ERC721URIStorage, Ownable, SenseistakeBase {
    mapping(uint256 => address) private _serviceContracts;
    // TODO: evaluate costs involved in defining address global or interface global
    // address public _serviceFactoryAddress;
    ISenseistakeServicesContractFactory factory;

    address private _operatorAddress;

    constructor(
        string memory name, 
        string memory symbol/*, 
        address senseistakeStorageAddress*/) ERC721(name, symbol) {
        // _serviceFactoryAddress = getContractAddress("SenseistakeServicesContractFactory");
        
        _operatorAddress = msg.sender;
        //initializeSenseistakeStorage(senseistakeStorageAddress);
    }

    modifier onlyOperator() {
        require(
            msg.sender == _operatorAddress,
            "Caller is not the operator"
        );
        _;
    }


    function setStorageAddress(address senseistakeStorageAddress) external {
        initializeSenseistakeStorage(senseistakeStorageAddress);
    }

    //TODO ver por que onlyOperator no me funciona
    function setFactory(address _factory) 
        external
        onlyOperator
    {
        require(address(factory) == address(0), "Already set up a factory contract address");
        factory =  ISenseistakeServicesContractFactory(_factory);
    }


    // function _baseURI() internal pure override returns (string memory) {
    //     return "https://example.com/nft/";
    // }

    // TODO: agregar factory transfer/remove ownership
    function _afterTokenTransfer(
        address from,
        address to,
        uint256 tokenId
    ) internal virtual override(ERC721)  {
        super._afterTokenTransfer(from, to, tokenId);
        // ISenseistakeServicesContractFactory factory = ISenseistakeServicesContractFactory(_serviceFactoryAddress);
        // transfer case only, do things in factory
        if (to != address(0) && from != address(0)) {
            // only for transfer we need to handle service-contranct and factory mappings 
            // (because operation starts in this contract)
            factory.transferDepositServiceContract(_serviceContracts[tokenId], from, to);
        }
        if (to == address(0)) {
            // burn, does not need to remove mappings in factory (because operation starts in factory)
            delete _serviceContracts[tokenId];
        } else {
            // mint && transfer
            _serviceContracts[tokenId] = to;
        }
    }

     //function safeMint(address to, string memory uri) public onlyOwner {
    // TODO Check if the require could replace the only  the onlyLatestContract
    function safeMint(address to, uint256 tokenId) public /*onlyLatestContract("SenseistakeServicesContract", msg.sender)*/ {
        require(msg.sender ==
        getAddress(keccak256(abi.encodePacked("contract.address", "SenseistakeServicesContract" , Strings.toString(tokenId)))), "The msg.sender must be previously stored");
        
        _safeMint(to, tokenId);
        //_setTokenURI(tokenId, uri);
    }

    function burn(uint tokenId) public {
        _burn(tokenId);
    }

    //The following functions are overrides required by Solidity 
     function _burn(uint256 tokenId) internal override(ERC721, ERC721URIStorage) {
          super._burn(tokenId);
     }

    function tokenURI(uint256 tokenId)
        public
        view
        override(ERC721, ERC721URIStorage)
        returns (string memory)
    {
        return super.tokenURI(tokenId);
    }

    //TODO SEGURIZAR
    function setTokenURI(uint256 tokenId, string memory _tokenURI) public {
        super._setTokenURI( tokenId, _tokenURI);
    }

    
}
