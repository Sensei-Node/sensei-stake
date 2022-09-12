// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Counters.sol";
import "@openzeppelin/contracts/utils/Strings.sol";
import "@openzeppelin/contracts/proxy/Clones.sol";
//TODO try to bring only isContract
//import { isContract } from "@openzeppelin/contracts/utils/Address.sol";
import  "@openzeppelin/contracts/utils/Address.sol";
import "./SenseistakeBase.sol";
import "./SenseistakeServicesContract.sol";
//import "./interfaces/ISenseistakeServicesContractFactory.sol";
//import "./libraries/ProxyFactory.sol";

contract SenseistakeERC721 is ERC721, Clones, ERC721URIStorage, Ownable, SenseistakeBase {
    mapping(uint256 => address) private _tokenServiceContract;
    mapping(address => uint256) private _serviceContractToken;

    using Address for address;
    using Address for address payable;
    using Counters for Counters.Counter;

    Counters.Counter private _tokenIdCounter;

    string private _baseUri = "ipfs://QmWMi519m7BEEdNyxsmadLC214QzgXRemp3wa2pzw95Gm4/";

    uint256 private constant FULL_DEPOSIT_SIZE = 32 ether;
    uint8 private constant COMMISSION_RATE_SCALE = 100;

    address payable public servicesContractImpl;
    
    uint8 public commissionRate;

    error CommissionRateScaleExceeded(uint8 rate);
    error CommisionRateTooHigh(uint8 rate);

    event ServiceImplementationChanged(
        address newServiceContractImplementationAdddress
    );

    /// @notice Emitted when operator service commission rate is set or changed.
    event CommissionRateChanged(
        uint256 newCommissionRate
    );

    constructor(
        string memory _name, 
        string memory _symbol,
        uint8 _commissionRate
    ) ERC721(_name, _symbol) {
        if(commissionRate > COMMISSION_RATE_SCALE){ revert CommissionRateScaleExceeded(commissionRate); }
        if(commissionRate > (commissionRate / COMMISSION_RATE_SCALE * 2)){ revert CommisionRateTooHigh(commissionRate); }
        // commission rate
        commissionRate = _commissionRate;
        // emits
        emit CommissionRateChanged(commissionRate);
        // constructor for service contract implementation
        servicesContractImpl = payable(new SenseistakeServicesContract());
        SenseistakeServicesContract(servicesContractImpl).initialize(0, address(0), "", address(0));
        emit ServiceImplementationChanged(address(servicesContractImpl));
    }

    function changeBaseUri(string memory baseUri) 
        external
        onlyOwner
    {
        _baseUri = baseUri;
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
            //return ISenseistakeServicesContractFactory(_factoryAddress).transferDepositServiceContract(_tokenServiceContract[tokenId], from, to);
            transferOwnership(to);
        }
        // check that sender is valid service contract
        //address serviceContract = msg.sender;
        //string memory serviceContractName = getContractName(serviceContract);
        //require(serviceContract == getContractAddress(serviceContractName), "Invalid or outdated contract");
        // burn, does not need to remove mappings in factory 
        // (because operation starts in factory)
        if (to == address(0) && from != address(0)) {
            //delete _serviceContractToken[_tokenServiceContract[tokenId]];
            //delete _tokenServiceContract[tokenId];
            renounceOwnership();
        } 
        // mint, does not need to remove mappings in factory 
        // (because operation starts in factory)
        if (to != address(0) && from == address(0)) {
            //_tokenServiceContract[tokenId] = serviceContract;
            //_serviceContractToken[serviceContract] = tokenId;
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

    function getTokenId(address serviceContract)
        public
        view
        returns (uint256)
    {
        return _serviceContractToken[serviceContract];
    }

    // FROM HERE WE START PUTTING CONTRACT FACTORY CODE

    function changeCommissionRate(uint24 newCommissionRate)
        external
        override
        onlyOwner
    {
        require(uint256(newCommissionRate) <= COMMISSION_RATE_SCALE, "Commission rate exceeds scale");
        _commissionRate = newCommissionRate;

        emit CommissionRateChanged(newCommissionRate);
    }

    error ValueSentGreaterThanFullDeposit();

    function createContract(
        bytes32 saltValue,
        bytes32 operatorDataCommitment
    )
        external
        payable
        override
        returns (address)
    {
        if (msg.value > FULL_DEPOSIT_SIZE) { revert ValueSentLowerThanFullDeposit(); }

        // TODO: verify operatorDataCommitment with signatures;

        bytes memory initData =
            abi.encodeWithSignature(
                "initialize(uint24,address,bytes32,address)",
                _commissionRate,
                owner(),
                operatorDataCommitment
            );

        address proxy = cloneDeterministic(servicesContractImpl, initData, saltValue);
        if (initData.length > 0) {
            (bool success, ) = proxy.call(initData);
            require(success, "Proxy init failed");
        }
        emit ContractCreated(saltValue);

        if (msg.value > 0) {
            SenseistakeServicesContract(payable(proxy)).depositOnBehalfOf{value: msg.value}(msg.sender);
        }

        return proxy;
    }

    error DepositedAmountLowerThanMinimum();

    function fundMultipleContracts(
        bytes32[] calldata saltValues
    )
        external
        payable
        override
        returns (uint256)
    {
        if (msg.value < FULL_DEPOSIT_SIZE) { revert DepositedAmountLowerThanMinimum(); }
        
        uint256 remaining = msg.value;
        address depositor = msg.sender;

        for (uint256 i = 0; i < saltValues.length; i++) {
            if (remaining == 0)
                break;
            address proxy = predictDeterministicAddress(servicesContractImpl, saltValues[i]);
            if (proxy.isContract()) {
                SenseistakeServicesContract sc = SenseistakeServicesContract(payable(proxy));
                if (sc.getState() == SenseistakeServicesContract.State.PreDeposit) {
                    uint256 depositAmount = _min(remaining, FULL_DEPOSIT_SIZE - address(sc).balance);
                    if (depositAmount != 0) {
                        sc.depositOnBehalfOf{value: depositAmount}(depositor);
                        remaining -= depositAmount;
                        emit ServiceContractDeposit(address(sc));
                    }
                    
                }
            }
        }

        if (remaining > 0) {
            payable(msg.sender).sendValue(remaining);
        }

        return remaining;
    }

    // tokenId is the salt .. we use predictDeterministicAddress
    function withdraw(bytes32 tokenId) 
        external 
        override
    {
        address serviceContract = predictDeterministicAddress(servicesContractImpl, tokenId);
        serviceContract.withdrawAllOnBehalfOf(payable(msg.sender));
    }

    function _min(uint256 a, uint256 b) pure internal returns (uint256) {
        return a <= b ? a : b;
    }


}
