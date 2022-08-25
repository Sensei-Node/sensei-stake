// SPDX-License-Identifier: MIT
pragma solidity 0.8.4;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Counters.sol";
import "@openzeppelin/contracts/utils/Strings.sol";
import "./SenseistakeBase.sol";
import "./interfaces/ISenseistakeServicesContract.sol";
import "./interfaces/ISenseistakeServicesContractFactory.sol";

contract SenseistakeERC721 is ERC721, ERC721URIStorage, Ownable, SenseistakeBase {
    mapping(uint256 => address) private _tokenServiceContract;
    mapping(address => uint256) private _serviceContractToken;

    using Counters for Counters.Counter;
    Counters.Counter private _tokenIdCounter;

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

    function setFactory(address _factory) 
        external
        onlyOperator
    {
        require(address(factory) == address(0), "Already set up a factory contract address");
        factory =  ISenseistakeServicesContractFactory(_factory);
    }

    function _baseURI() internal view virtual override returns (string memory) {
        return "ipfs://QmXWnYeFgc6CZwzTUzNdbSrt6WRqU1ZUPk3YyJnqRLsKp8";
    }

    function _afterTokenTransfer(
        address from,
        address to,
        uint256 tokenId
    ) internal virtual override(ERC721)  {
        super._afterTokenTransfer(from, to, tokenId);
        // ISenseistakeServicesContractFactory factory = ISenseistakeServicesContractFactory(_serviceFactoryAddress);
        // transfer
        if (to != address(0) && from != address(0)) {
            // only for transfer we need to handle service-contranct and factory mappings 
            // (because operation starts in this contract)
            // factory.transferDepositServiceContract(_tokenServiceContract[tokenId], from, to);
            // _serviceContractToken[_tokenServiceContract[tokenId]] = tokenId;
            return;
        }
        // burn
        address serviceContract = msg.sender;
        string memory serviceContractName = getContractName(serviceContract);
        require(serviceContract == getContractAddress(serviceContractName), "Invalid or outdated contract");
        if (to == address(0) && from != address(0)) {
            // burn, does not need to remove mappings in factory (because operation starts in factory)
            delete _serviceContractToken[_tokenServiceContract[tokenId]];
            delete _tokenServiceContract[tokenId];
        } 
        // mint
        if (to != address(0) && from == address(0)) {
            _tokenServiceContract[tokenId] = serviceContract;
            _serviceContractToken[serviceContract] = tokenId;
        }
    }

    function safeMint(address to) public onlyLatestNetworkContract {
        uint256 tokenId = _tokenIdCounter.current();
        _tokenIdCounter.increment();
        _safeMint(to, tokenId);
        string memory uri = ERC721.tokenURI(tokenId);
        _setTokenURI(tokenId, uri);
    }

    function burn() public onlyLatestNetworkContract {
        uint256 tokenId = _serviceContractToken[msg.sender];
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
}
