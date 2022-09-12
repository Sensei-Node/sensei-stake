// SPDX-License-Identifier: MIT
pragma solidity 0.8.4;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Strings.sol";
import "@openzeppelin/contracts/proxy/Clones.sol";
import  "@openzeppelin/contracts/utils/Address.sol";
import "./SenseistakeServicesContract.sol";

contract SenseistakeERC721 is ERC721, ERC721URIStorage, Ownable {
    using Address for address;
    using Address for address payable;

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

    event CommissionRateChanged(
        uint256 newCommissionRate
    );

    event ContractCreated(
        bytes32 create2Salt
    );

    event ServiceContractDeposit(
        address indexed serviceContract
    );

    constructor(
        string memory _name, 
        string memory _symbol,
        uint8 _commissionRate
    ) ERC721(_name, _symbol) {
        if (commissionRate > COMMISSION_RATE_SCALE) { revert CommissionRateScaleExceeded(commissionRate); }
        if (commissionRate > (commissionRate / COMMISSION_RATE_SCALE * 2)) { revert CommisionRateTooHigh(commissionRate); }
        // commission rate
        commissionRate = _commissionRate;
        // emits
        emit CommissionRateChanged(commissionRate);
        // constructor for service contract implementation
        servicesContractImpl = payable(new SenseistakeServicesContract());
        SenseistakeServicesContract(servicesContractImpl).initialize(0, address(0), "", "");
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

    // f t action
    // 0 0 not possible
    // 0 1 mint
    // 1 0 burn
    // 1 1 transfer
    function _afterTokenTransfer(
        address from,
        address to,
        uint256 tokenId
    ) internal virtual override(ERC721)  {
        super._afterTokenTransfer(from, to, tokenId);
        // transfer
        if (to != address(0) && from != address(0)) {
            // TODO
        } else {
            // mint
            if (to != address(0)) {
                // TODO
            } else {
                // burn
                if (from != address(0)) {
                    // TODO
                }
            }
        }
    }

    error safeMintInvalid();

    function safeMint(address to, bytes32 salt) public {
        // verify that caller is a service contract
        if (msg.sender != Clones.predictDeterministicAddress(servicesContractImpl, salt)) { revert safeMintInvalid(); }
        // tokenId is the uint256(salt)
        _safeMint(to, uint256(salt));
        // concatenation of base uri and id
        _setTokenURI(uint256(salt), string(abi.encodePacked(_baseUri, Strings.toString(uint256(salt)))));
    }

    function burn(bytes32 salt) public {
        // verify that caller is a service contract
        if (msg.sender != Clones.predictDeterministicAddress(servicesContractImpl, salt)) { revert safeMintInvalid(); }
        // burns token of salt
        _burn(uint256(salt));
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

    function getServiceAddress(bytes32 salt)
        public
        view
        returns (address)
    {
        return Clones.predictDeterministicAddress(servicesContractImpl, salt);
    }

    // FROM HERE WE START PUTTING CONTRACT FACTORY CODE

    function changeCommissionRate(uint8 newCommissionRate)
        external
        onlyOwner
    {
        require(uint256(newCommissionRate) <= COMMISSION_RATE_SCALE, "Commission rate exceeds scale");
        commissionRate = newCommissionRate;

        emit CommissionRateChanged(newCommissionRate);
    }

    error ValueSentGreaterThanFullDeposit();

    function createContract(
        bytes32 saltValue,
        bytes32 operatorDataCommitment
    )
        external
        payable
        returns (address)
    {
        if (msg.value > FULL_DEPOSIT_SIZE) { revert ValueSentGreaterThanFullDeposit(); }

        // TODO: verify operatorDataCommitment with signatures;

        bytes memory initData =
            abi.encodeWithSignature(
                "initialize(uint8,address,bytes32,bytes32)",
                commissionRate,
                owner(),
                operatorDataCommitment,
                saltValue
            );

        address proxy = Clones.cloneDeterministic(servicesContractImpl, saltValue);
        if (initData.length > 0) {
            (bool success, ) = proxy.call(initData);
            require(success, "Proxy init failed");
        }
        emit ContractCreated(saltValue);

        if (msg.value > 0) {
            SenseistakeServicesContract(payable(proxy)).depositFrom{value: msg.value}(msg.sender);
        }

        return proxy;
    }

    error DepositedAmountLowerThanMinimum();

    function fundMultipleContracts(
        bytes32[] calldata saltValues
    )
        external
        payable
        returns (uint256)
    {
        if (msg.value < FULL_DEPOSIT_SIZE) { revert DepositedAmountLowerThanMinimum(); }
        
        uint256 remaining = msg.value;
        address depositor = msg.sender;

        for (uint256 i = 0; i < saltValues.length; i++) {
            if (remaining == 0)
                break;
            address proxy = Clones.predictDeterministicAddress(servicesContractImpl, saltValues[i]);
            if (proxy.isContract()) {
                SenseistakeServicesContract sc = SenseistakeServicesContract(payable(proxy));
                if (sc.state() == SenseistakeServicesContract.State.PreDeposit) {
                    uint256 depositAmount = _min(remaining, FULL_DEPOSIT_SIZE - address(sc).balance);
                    if (depositAmount != 0) {
                        sc.depositFrom{value: depositAmount}(depositor);
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

    error notOwner();

    function withdraw(uint256 tokenId)
        external
    {
        if (msg.sender != ownerOf(tokenId)) { revert notOwner(); }
        address serviceContract = Clones.predictDeterministicAddress(servicesContractImpl, bytes32(tokenId));
        SenseistakeServicesContract(payable(serviceContract)).withdrawTo(payable(msg.sender));
    }

    function _min(uint256 a, uint256 b) pure internal returns (uint256) {
        return a <= b ? a : b;
    }
}
