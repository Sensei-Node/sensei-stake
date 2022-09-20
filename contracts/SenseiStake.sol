// SPDX-License-Identifier: MIT
pragma solidity 0.8.4;

import {Address} from "@openzeppelin/contracts/utils/Address.sol";
import {Base64} from "@openzeppelin/contracts/utils/Base64.sol";
import {Clones} from "@openzeppelin/contracts/proxy/Clones.sol";
import {Counters} from "@openzeppelin/contracts/utils/Counters.sol";
import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {SenseistakeServicesContract} from "./SenseistakeServicesContract.sol";
import {Strings} from "@openzeppelin/contracts/utils/Strings.sol";

// import {Helpers} from "./libraries/Helpers.sol";
import "hardhat/console.sol";

/// @title Main contract for handling SenseiStake Services
/// @author Senseinode
/// @notice Serves as entrypoint for SenseiStake
/// @dev Serves as entrypoint for creating service contracts, depositing, withdrawing and dealing with non fungible token. Inherits the OpenZepplin ERC721 and Ownable implentation
contract SenseiStake is ERC721, Ownable {
    using Address for address;
    using Address for address payable;
    using Counters for Counters.Counter;
    // using Helpers for bytes;

    /// @notice Struct that specifies values that a service contract needs for creation
    /// @dev The token id for uniqueness proxy implementation generation and the operatorDataCommitment for the validator
    struct Validator {
        bytes validatorPubKey;
        bytes depositSignature;
        bytes32 depositDataRoot;
        uint64 exitDate;
    }

    /// @notice Used in conjuction with `COMMISSION_RATE_SCALE` for determining service fees
    /// @dev Is set up on the constructor and can be modified with provided setter aswell
    /// @return commissionRate the commission rate
    uint32 public commissionRate;

    /// @notice Scale for getting the commission rate (service fee)
    uint32 private constant COMMISSION_RATE_SCALE = 1_000_000;

    /// @notice Template service contract implementation address
    /// @dev It is used for generating clones, using hardhats proxy clone
    /// @return servicesContractImpl where the service contract template is implemented
    address public servicesContractImpl;

    /// @notice Stores data used for creating the validator
    mapping(uint256 => Validator) public validators;

    /// @notice Fixed amount of the deposit
    uint256 private constant FULL_DEPOSIT_SIZE = 32 ether;

    /// @notice Current tokenId that needs to be minted
    Counters.Counter private _tokenIdCounter;

    event CommissionRateChanged(uint32 newCommissionRate);
    event ContractCreated(uint256 tokenIdServiceContract);
    event ServiceContractDeposit(address indexed serviceContract);
    event ServiceImplementationChanged(
        address newServiceContractImplementationAdddress
    );

    error BurnInvalid();
    error CommissionRateScaleExceeded(uint32 rate);
    error CommisionRateTooHigh(uint32 rate);
    error InvalidDepositSignature();
    error InvalidPublicKey();
    error NoMoreValidatorsLoaded();
    error NotEarlierThanOriginalDate();
    error NotOwner();
    error SafeMintAlreadyMade();
    error SafeMintInvalid();
    error ValueSentDifferentThanFullDeposit();
    error ValueSentLowerThanMinimumDeposit();

    /// @notice Initializes the contract
    /// @dev Sets token name and symbol, also sets commissionRate and checks its validity
    /// @param name_ The token name
    /// @param symbol_ The token symbol
    /// @param commissionRate_ The service commission rate
    /// @param commissionRate_ The service commission rate
    constructor(
        string memory name_,
        string memory symbol_,
        uint32 commissionRate_,
        address ethDepositContractAddress_
    ) ERC721(name_, symbol_) {
        if (commissionRate_ > (COMMISSION_RATE_SCALE / 2)) {
            revert CommisionRateTooHigh(commissionRate_);
        }
        commissionRate = commissionRate_;
        emit CommissionRateChanged(commissionRate_);
        servicesContractImpl = address(
            new SenseistakeServicesContract(ethDepositContractAddress_)
        );
        SenseistakeServicesContract(payable(servicesContractImpl)).initialize(
            0,
            address(0),
            0,
            0
        );
        emit ServiceImplementationChanged(address(servicesContractImpl));
    }

    /// @notice Adds validator info to validators mapping
    /// @dev Stores the tokenId and operatorDataCommitment used for generating new service contract
    /// @param tokenId_ the token Id
    /// @param validatorPubKey_ the validator public key
    /// @param depositSignature_ the deposit_data.json signature
    /// @param depositDataRoot_ the deposit_data.json data root
    /// @param exitDate_ the exit date
    function addValidator(
        uint256 tokenId_,
        bytes calldata validatorPubKey_,
        bytes calldata depositSignature_,
        bytes32 depositDataRoot_,
        uint64 exitDate_
    ) external onlyOwner {
        if (validatorPubKey_.length != 48) {
            revert InvalidPublicKey();
        }
        if (depositSignature_.length != 96) {
            revert InvalidDepositSignature();
        }
        if (block.timestamp + 1 days > exitDate_) {
            revert NotEarlierThanOriginalDate();
        }
        Validator memory validator = Validator(
            validatorPubKey_,
            depositSignature_,
            depositDataRoot_,
            exitDate_
        );
        validators[tokenId_] = validator;
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
    function createContract() external payable {
        if (msg.value != FULL_DEPOSIT_SIZE) {
            revert ValueSentDifferentThanFullDeposit();
        }

        // increment tokenid counter
        _tokenIdCounter.increment();
        uint256 tokenId = _tokenIdCounter.current();
        Validator memory validator = validators[tokenId];

        // check that validator exists
        if (validator.validatorPubKey.length == 0) {
            revert NoMoreValidatorsLoaded();
        }

        bytes memory initData = abi.encodeWithSignature(
            "initialize(uint32,address,uint256,uint64)",
            commissionRate,
            owner(),
            tokenId,
            validator.exitDate
        );

        address proxy = Clones.cloneDeterministic(
            servicesContractImpl,
            bytes32(tokenId)
        );
        if (initData.length > 0) {
            (bool success, ) = proxy.call(initData);
            require(success, "Proxy init failed");
        }
        emit ContractCreated(tokenId);

        // deposit to service contract
        SenseistakeServicesContract(payable(proxy)).depositFrom{
            value: msg.value
        }(msg.sender);

        // create validator
        SenseistakeServicesContract(payable(proxy)).createValidator(
            validator.validatorPubKey,
            validator.depositSignature,
            validator.depositDataRoot
        );

        // mint the NFT
        _safeMint(msg.sender, tokenId);
    }

    /// @notice Allows user to start the withdrawal process
    /// @dev Calls end operator services in service contract
    /// @param tokenId_ the token id to end
    function endOperatorServices(uint256 tokenId_) external {
        if (msg.sender != ownerOf(tokenId_)) {
            revert NotOwner();
        }

        address proxy = Clones.predictDeterministicAddress(
            servicesContractImpl,
            bytes32(tokenId_)
        );

        SenseistakeServicesContract serviceContract = SenseistakeServicesContract(
                payable(proxy)
            );
        serviceContract.endOperatorServices();
    }

    /// @notice Performs withdraw of balance in service contract
    /// @dev The `tokenId_` is used for deterining the the service contract from which the owner can perform a withdraw (if possible)
    /// @param tokenId_ Is the token Id
    function withdraw(uint256 tokenId_) external {
        if (msg.sender != ownerOf(tokenId_)) {
            revert NotOwner();
        }
        address proxy = Clones.predictDeterministicAddress(
            servicesContractImpl,
            bytes32(tokenId_)
        );

        SenseistakeServicesContract serviceContract = SenseistakeServicesContract(
                payable(proxy)
            );
        serviceContract.withdrawTo(payable(msg.sender));
        _burn(tokenId_);
    }

    /// @notice Gets service contract address
    /// @dev For getting the service contract address of a given token id
    /// @param tokenId_ Is the token id
    /// @return Address of a service contract
    function getServiceContractAddress(uint256 tokenId_)
        external
        view
        returns (address)
    {
        return
            Clones.predictDeterministicAddress(
                servicesContractImpl,
                bytes32(tokenId_)
            );
    }

    /// @notice Gets token uri where the metadata of NFT is stored
    /// @param tokenId_ Is the token id
    /// @return Token uri of the tokenId provided
    function tokenURI(uint256 tokenId_)
        public
        view
        override(ERC721)
        returns (string memory)
    {
        return
            string(
                abi.encodePacked(
                    "data:application/json;base64,",
                    Base64.encode(
                        bytes(
                            abi.encodePacked(
                                '{"name":"Validator #',
                                Strings.toString(tokenId_),
                                '","description":"SenseiStake Validator",',
                                '"external_url":"stake.senseinode.com",',
                                '"image":"',
                                "ipfs://bafybeic4e43syjzhjbticygjo75jgi4iouatxog377prtykapl5ehjgmpq",
                                '","attributes": [{"trait_type": "Validator Address", "value":"',
                                bytesToHexString(
                                    validators[tokenId_].validatorPubKey
                                ),
                                // validators[tokenId_].validatorPubKey.toHexString(),
                                '"}]}'
                            )
                        )
                    )
                )
            );
    }

    /// @notice For removing ownership of an NFT from a wallet address
    /// @param tokenId_ Is the token id
    function _burn(uint256 tokenId_) internal override(ERC721) {
        super._burn(tokenId_);
    }

    /// @notice Helper function for converting bytes to hex string
    /// @param buffer bytes data to convert
    /// @return string converted buffer
    function bytesToHexString(bytes memory buffer)
        public
        pure
        returns (string memory)
    {
        // Fixed buffer size for hexadecimal convertion
        bytes memory converted = new bytes(buffer.length * 2);
        bytes memory _base = "0123456789abcdef";
        for (uint256 i = 0; i < buffer.length; i++) {
            converted[i * 2] = _base[uint8(buffer[i]) / _base.length];
            converted[i * 2 + 1] = _base[uint8(buffer[i]) % _base.length];
        }
        return string(abi.encodePacked("0x", converted));
    }
}
