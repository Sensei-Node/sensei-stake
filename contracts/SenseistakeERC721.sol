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

/// @title An ERC721 contract for handling SenseiStake Services
/// @author Senseinode
/// @notice Serves as entrypoint for SenseiStake
/// @dev Serves as entrypoint for creating service contracts, depositing, withdrawing and dealing with non fungible token. Inherits the OpenZepplin ERC721, ERC721URIStorage and Ownable implentation
contract SenseistakeERC721 is ERC721, ERC721URIStorage, Ownable {
    using Address for address;
    using Address for address payable;

    /// @notice Used in conjuction with `COMMISSION_RATE_SCALE` for determining service fees
    /// @dev Is set up on the constructor and can be modified with provided setter aswell
    /// @return commissionRate the commission rate
    uint32 public commissionRate;

    /// @notice Template service contract implementation address
    /// @dev It is used for generating clones, using hardhats proxy clone
    /// @return servicesContractImpl where the service contract template is implemented
    address payable public servicesContractImpl;

    /// @notice IPFS base uri
    string private _baseUri =
        "ipfs://QmWMi519m7BEEdNyxsmadLC214QzgXRemp3wa2pzw95Gm4/";

    /// @notice Fixed amount of the deposit
    uint256 private constant FULL_DEPOSIT_SIZE = 32 ether;

    /// @notice Scale for getting the commission rate (service fee)
    uint32 private constant COMMISSION_RATE_SCALE = 1_000_000;

    /// @notice Determines if a certain tokenId was minted
    /// @dev For allowing only a single mint per service contract
    mapping(bytes32 => bool) private minted;

    event CommissionRateChanged(uint32 newCommissionRate);
    event ContractCreated(bytes32 create2Salt);
    event ServiceContractDeposit(address indexed serviceContract);
    event ServiceImplementationChanged(
        address newServiceContractImplementationAdddress
    );

    error BurnInvalid();
    error CommissionRateScaleExceeded(uint32 rate);
    error CommisionRateTooHigh(uint32 rate);
    error NotOwner();
    error SafeMintAlreadyMade();
    error SafeMintInvalid();
    error ValueSentGreaterThanFullDeposit();
    error ValueSentLowerThanMinimumDeposit();

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
        _burn(uint256(salt_));
    }

    /// @notice Changes ipfs base uri
    /// @param baseUri_ The new base uri
    function changeBaseUri(string memory baseUri_) external onlyOwner {
        _baseUri = baseUri_;
    }

    /// @notice Changes commission rate (senseistake service fees)
    /// @dev Cannot be more than 50% commission
    /// @param commissionRate_ New commission rate
    function changeCommissionRate(uint32 commissionRate_) external onlyOwner {
        if (commissionRate_ > (COMMISSION_RATE_SCALE / 2)) {
            revert CommisionRateTooHigh(commissionRate_);
        }
        commissionRate = commissionRate_;
        emit CommissionRateChanged(commissionRate_);
    }

    /// @notice Creates service contract based on implementation
    /// @dev Performs a clone of the implementation contract, a service contract handles logic for managing user deposit, withdraw and validator
    /// @param salt_ Service contract salt
    /// @param operatorDataCommitment_ Operator data commitment
    function createContract(bytes32 salt_, bytes32 operatorDataCommitment_)
        external
        payable
        onlyOwner
    {
        if (msg.value > FULL_DEPOSIT_SIZE) {
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

    /// @notice Allows deposits into different service contracts
    /// @dev According to salts and `msg.value` provided it will be performing deposits up untill no more ether left (or salts)
    /// @param salts_ Salts that derive in service contracts addresses
    function fundMultipleContracts(bytes32[] calldata salts_) external payable {
        if (msg.value < FULL_DEPOSIT_SIZE) {
            revert ValueSentLowerThanMinimumDeposit();
        }

        uint256 remaining = msg.value;
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
                            msg.sender
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

    /// @notice Performs withdraw of balance in service contract
    /// @dev The `tokenId_` is a cast of the salt, and thus we can access the service contract from which the owner can perform a withdraw (if possible)
    /// @param tokenId_ Is the salt casted to uint256
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

    /// @notice Gets service contract address
    /// @dev For getting the service contract address of a given salt
    /// @param salt_ Is the service contract salt
    /// @return Address of a service contract
    function getServiceContractAddress(bytes32 salt_)
        external
        view
        returns (address)
    {
        return Clones.predictDeterministicAddress(servicesContractImpl, salt_);
    }

    /// @notice Casts bytes32 salt to uint256 tokenId
    /// @param salt_ Is the service contract salt
    /// @return tokenId Is the salt casted to uint256
    function saltToTokenId(bytes32 salt_)
        external
        pure
        returns (uint256 tokenId)
    {
        tokenId = uint256(salt_);
    }

    /// @notice Casts uint256 tokenId to bytes32 salt
    /// @param tokenId_ Is the uint256 casted salt
    /// @return salt Is the tokenId casted to bytes32
    function tokenIdToSalt(uint256 tokenId_)
        external
        pure
        returns (bytes32 salt)
    {
        salt = bytes32(tokenId_);
    }

    /// @notice Gets token uri where the metadata of NFT is stored
    /// @param tokenId_ Is the uint256 casted salt
    /// @return Token uri of the tokenId provided
    function tokenURI(uint256 tokenId_)
        public
        view
        override(ERC721, ERC721URIStorage)
        returns (string memory)
    {
        return super.tokenURI(tokenId_);
    }

    /// @notice Lifecycle hook for every transfer, mint or burn done of the erc721 token
    /// @dev Only needed to change the depositor address on transfers, for mint/burn this is handled in the service contract
    /// @param from_ Address of the owner
    /// @param to_ Address of the receiver
    /// @param tokenId_ Is the uint256 casted salt
    function _afterTokenTransfer(
        address from_,
        address to_,
        uint256 tokenId_
    ) internal virtual override(ERC721) {
        super._afterTokenTransfer(from_, to_, tokenId_);
        // transfer operation
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

    /// @notice For removing ownership of an NFT from a wallet address
    /// @param tokenId_ Is the uint256 casted salt
    function _burn(uint256 tokenId_)
        internal
        override(ERC721, ERC721URIStorage)
    {
        super._burn(tokenId_);
    }

    /// @notice Returns min value of two provided (if equality returns first)
    /// @param a_ The first value
    /// @param b_ The second value
    function _min(uint256 a_, uint256 b_) internal pure returns (uint256) {
        return a_ <= b_ ? a_ : b_;
    }
}
