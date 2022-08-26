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

    address private _factoryAddress;
    address private _operatorAddress;

    string private _baseUri = "https://ipfs.io/ipfs/QmSiQuffUmDf3TsNRGApBiMkgTc8cLipAVcWM4V7kdTyBo?filename=";

    constructor(
        string memory name, 
        string memory symbol,
        address storageDeploymentAddress
    ) ERC721(name, symbol) {
        initializeSenseistakeStorage(storageDeploymentAddress);
        _operatorAddress = msg.sender;
    }

    modifier onlyOperator() {
        require(
            msg.sender == _operatorAddress,
            "Caller is not the operator"
        );
        _;
    }

    function setFactory(address _factory) 
        external
        onlyOperator
    {
        require(_factoryAddress == address(0), "Already set up a factory contract address");
        _factoryAddress = _factory;
    }

    // function _baseURI() internal view virtual override returns (string memory) {
    //     return "https://ipfs.io/ipfs/QmSiQuffUmDf3TsNRGApBiMkgTc8cLipAVcWM4V7kdTyBo?filename=";
    // }

    function _afterTokenTransfer(
        address from,
        address to,
        uint256 tokenId
    ) internal virtual override(ERC721)  {
        super._afterTokenTransfer(from, to, tokenId);
        // transfer
        if (to != address(0) && from != address(0)) {
            // only for transfer we need to handle service-contranct and factory mappings 
            // (because operation starts in this contract)
            // ISenseistakeServicesContractFactory(_factoryAddress).transferDepositServiceContract(_tokenServiceContract[tokenId], from, to);
            // _serviceContractToken[_tokenServiceContract[tokenId]] = tokenId;
            revert("Transfers not allowed yet!");
        }
        // burn, does not need to remove mappings in factory 
        // (because operation starts in factory)
        address serviceContract = msg.sender;
        string memory serviceContractName = getContractName(serviceContract);
        require(serviceContract == getContractAddress(serviceContractName), "Invalid or outdated contract");
        if (to == address(0) && from != address(0)) {
            delete _serviceContractToken[_tokenServiceContract[tokenId]];
            delete _tokenServiceContract[tokenId];
        } 
        // mint, does not need to remove mappings in factory 
        // (because operation starts in factory)
        if (to != address(0) && from == address(0)) {
            _tokenServiceContract[tokenId] = serviceContract;
            _serviceContractToken[serviceContract] = tokenId;
        }
    }

    function safeMint(address to) public onlyLatestNetworkContract {
        _tokenIdCounter.increment();
        uint256 tokenId = _tokenIdCounter.current();
        _safeMint(to, tokenId);
        // concatenation of base uri and id
        _setTokenURI(tokenId, string(abi.encodePacked(_baseUri, Strings.toString(tokenId))));
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
