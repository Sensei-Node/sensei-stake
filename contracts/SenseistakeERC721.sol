// SPDX-License-Identifier: MIT
pragma solidity 0.8.4;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Strings.sol";
import "@openzeppelin/contracts/proxy/Clones.sol";
import "@openzeppelin/contracts/utils/Address.sol";
import "./SenseistakeServicesContract.sol";

// import "hardhat/console.sol";

/// @title An ERC721 contract for handling SenseiStake Validators
/// @author Senseinode
/// @notice Serves as entrypoint for SenseiStake
/// @dev Serves as entrypoint for creating service contracts, depositing, withdrawing and dealing with non fungible token. Inherits the OpenZepplin ERC721, ERC721URIStorage and Ownable implentation
contract SenseistakeERC721 is ERC721, ERC721URIStorage, Ownable {
    using Address for address;
    using Address for address payable;

    string private _baseUri =
        "ipfs://QmWMi519m7BEEdNyxsmadLC214QzgXRemp3wa2pzw95Gm4/";

    uint256 private constant FULL_DEPOSIT_SIZE = 32 ether;
    uint32 private constant COMMISSION_RATE_SCALE = 1_000_000;

    address payable public servicesContractImpl;

    uint32 public commissionRate;

    // for only allowing mint once per salt
    mapping(bytes32 => bool) internal minted;

    event ServiceImplementationChanged(
        address newServiceContractImplementationAdddress
    );
    event CommissionRateChanged(uint32 newCommissionRate);
    event ContractCreated(bytes32 create2Salt);
    event ServiceContractDeposit(address indexed serviceContract);

    error CommissionRateScaleExceeded(uint32 rate);
    error CommisionRateTooHigh(uint32 rate);
    error SafeMintInvalid();
    error SafeMintAlreadyMade();
    error BurnInvalid();
    error ValueSentGreaterThanFullDeposit();
    error ValueSentLowerThanMinimumDeposit();
    error NotOwner();

    /// @notice Initializes the contract
    /// @dev Sets token name and symbol, also sets commissionRate and checks its validity
    /// @param name_ The token name
    /// @param symbol_ The token symbol
    /// @param commissionRate_ The service commission rate
    constructor(
        string memory name_,
        string memory symbol_,
        uint32 commissionRate_
    ) ERC721(name_, symbol_) {
        if (commissionRate_ > COMMISSION_RATE_SCALE) {
            revert CommissionRateScaleExceeded(commissionRate_);
        }
        if (commissionRate_ > (COMMISSION_RATE_SCALE / 2)) {
            revert CommisionRateTooHigh(commissionRate_);
        }
        commissionRate = commissionRate_;
        emit CommissionRateChanged(commissionRate_);
        servicesContractImpl = payable(new SenseistakeServicesContract());
        SenseistakeServicesContract(servicesContractImpl).initialize(
            0,
            address(0),
            "",
            ""
        );
        emit ServiceImplementationChanged(address(servicesContractImpl));
    }

    /// @notice Changes ipfs base uri
    /// @param baseUri_ The new base uri
    function changeBaseUri(string memory baseUri_) external onlyOwner {
        _baseUri = baseUri_;
    }

    /// @notice Mints a new NFT
    /// @dev Can only be called once, and only from any of our service contracts
    /// @param to_ Address to mint to
    /// @param salt_ Salt used for getting the service contract address
    function safeMint(address to_, bytes32 salt_) external {
        // if a safeMint -> burn -> safeMint cycle can be made unless this check added
        if (minted[salt_] == true) {
            revert SafeMintAlreadyMade();
        }
        // verify that caller is a service contract
        if (
            msg.sender !=
            Clones.predictDeterministicAddress(servicesContractImpl, salt_)
        ) {
            revert SafeMintInvalid();
        }
        // tokenId is the uint256(salt)
        _safeMint(to_, uint256(salt_));
        // concatenation of base uri and id
        _setTokenURI(
            uint256(salt_),
            string(abi.encodePacked(_baseUri, Strings.toString(uint256(salt_))))
        );
        minted[salt_] = true;
    }

    /// @notice Burns minted NFT
    /// @dev Can only be called from any of our service contracts
    /// @param salt_ Salt used for getting the service contract address
    function burn(bytes32 salt_) external {
        // verify that caller is a service contract
        if (
            msg.sender !=
            Clones.predictDeterministicAddress(servicesContractImpl, salt_)
        ) {
            revert BurnInvalid();
        }
        // burns token of salt
        _burn(uint256(salt_));
    }

    function changeCommissionRate(uint32 commissionRate_) external onlyOwner {
        if (commissionRate_ > COMMISSION_RATE_SCALE) {
            revert CommissionRateScaleExceeded(commissionRate_);
        }
        if (commissionRate_ > (COMMISSION_RATE_SCALE / 2)) {
            revert CommisionRateTooHigh(commissionRate_);
        }
        commissionRate = commissionRate_;
        emit CommissionRateChanged(commissionRate_);
    }

    function createContract(bytes32 salt_, bytes32 operatorDataCommitment_)
        external
        payable
        onlyOwner
    {
        if (msg.value >= FULL_DEPOSIT_SIZE) {
            revert ValueSentGreaterThanFullDeposit();
        }

        // TODO: verify operatorDataCommitment with signatures;

        bytes memory initData = abi.encodeWithSignature(
            "initialize(uint32,address,bytes32,bytes32)",
            commissionRate,
            owner(),
            operatorDataCommitment_,
            salt_
        );

        address proxy = Clones.cloneDeterministic(servicesContractImpl, salt_);
        if (initData.length > 0) {
            (bool success, ) = proxy.call(initData);
            require(success, "Proxy init failed");
        }
        emit ContractCreated(salt_);

        if (msg.value > 0) {
            SenseistakeServicesContract(payable(proxy)).depositFrom{
                value: msg.value
            }(msg.sender);
        }
    }

    function fundMultipleContracts(bytes32[] calldata salts_) external payable {
        if (msg.value < FULL_DEPOSIT_SIZE) {
            revert ValueSentLowerThanMinimumDeposit();
        }

        uint256 remaining = msg.value;
        address depositor = msg.sender;
        uint8 saltsLen = uint8(salts_.length);
        for (uint8 i; i < saltsLen; ) {
            if (remaining == 0) break;
            address proxy = Clones.predictDeterministicAddress(
                servicesContractImpl,
                bytes32(salts_[i])
            );
            if (proxy.isContract()) {
                SenseistakeServicesContract serviceContract = SenseistakeServicesContract(
                        payable(proxy)
                    );
                if (
                    serviceContract.state() ==
                    SenseistakeServicesContract.State.PreDeposit
                ) {
                    uint256 depositAmount = _min(
                        remaining,
                        FULL_DEPOSIT_SIZE - address(serviceContract).balance
                    );
                    if (depositAmount != 0) {
                        serviceContract.depositFrom{value: depositAmount}(
                            depositor
                        );
                        remaining -= depositAmount;
                        emit ServiceContractDeposit(address(serviceContract));
                    }
                }
            }
            unchecked {
                ++i;
            }
        }

        if (remaining > 0) {
            payable(msg.sender).sendValue(remaining);
        }
    }

    function withdraw(uint256 tokenId_) external {
        address proxy = Clones.predictDeterministicAddress(
            servicesContractImpl,
            bytes32(tokenId_)
        );
        SenseistakeServicesContract serviceContract = SenseistakeServicesContract(
                payable(proxy)
            );
        if (msg.sender != serviceContract.depositor()) {
            revert NotOwner();
        }
        serviceContract.withdrawTo(payable(msg.sender));
    }

    function getServiceContractAddress(bytes32 salt_)
        external
        view
        returns (address)
    {
        return Clones.predictDeterministicAddress(servicesContractImpl, salt_);
    }

    function saltToTokenId(bytes32 salt_) external pure returns (uint256 salt) {
        salt = uint256(salt_);
    }

    function tokenIdToSalt(uint256 tokenId_)
        external
        pure
        returns (bytes32 tokenId)
    {
        tokenId = bytes32(tokenId_);
    }

    function tokenURI(uint256 tokenId_)
        public
        view
        override(ERC721, ERC721URIStorage)
        returns (string memory)
    {
        return super.tokenURI(tokenId_);
    }

    // function _baseURI() internal view virtual override returns (string memory) {
    //     return "https://ipfs.io/ipfs/QmSiQuffUmDf3TsNRGApBiMkgTc8cLipAVcWM4V7kdTyBo?filename=";
    // }

    function _afterTokenTransfer(
        address from_,
        address to_,
        uint256 tokenId_
    ) internal virtual override(ERC721) {
        super._afterTokenTransfer(from_, to_, tokenId_);
        // transfer
        if (to_ != address(0) && from_ != address(0)) {
            address proxy = Clones.predictDeterministicAddress(
                servicesContractImpl,
                bytes32(tokenId_)
            );
            SenseistakeServicesContract(payable(proxy)).changeDepositor(
                from_,
                to_
            );
        }
    }

    function _burn(uint256 tokenId_)
        internal
        override(ERC721, ERC721URIStorage)
    {
        super._burn(tokenId_);
    }

    function _min(uint256 a_, uint256 b_) internal pure returns (uint256) {
        return a_ <= b_ ? a_ : b_;
    }
}
