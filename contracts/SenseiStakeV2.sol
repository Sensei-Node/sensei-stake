// SPDX-License-Identifier: MIT
pragma solidity >=0.8.17;

import {Address} from "@openzeppelin/contracts/utils/Address.sol";
import {Base64} from "@openzeppelin/contracts/utils/Base64.sol";
import {Clones} from "@openzeppelin/contracts/proxy/Clones.sol";
import {Counters} from "@openzeppelin/contracts/utils/Counters.sol";
import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {SenseistakeServicesContractV2 as SenseistakeServicesContract} from "./SenseistakeServicesContractV2.sol";
import {SenseistakeServicesContract as SenseistakeServicesContractV1} from "./SenseistakeServicesContract.sol";
import {Strings} from "@openzeppelin/contracts/utils/Strings.sol";
import {SenseiStake as SenseiStakeV1} from "./SenseiStake.sol";
import {SenseistakeMetadata} from "./SenseistakeMetadata.sol";

/// @title Main contract for handling SenseiStake Services
/// @author Senseinode
/// @notice Serves as entrypoint for SenseiStake
/// @dev Serves as entrypoint for creating service contracts, depositing, withdrawing and dealing with non fungible token. Inherits the OpenZepplin ERC721 and Ownable implentation
contract SenseiStakeV2 is ERC721, Ownable {
    using Address for address;
    using Address for address payable;
    using Counters for Counters.Counter;

    /// @notice Struct that specifies values that a service contract needs for creation
    /// @dev The token id for uniqueness proxy implementation generation and the operatorDataCommitment for the validator
    struct Validator {
        bytes validatorPubKey;
        bytes depositSignature;
        bytes32 depositDataRoot;
    }

    /// @notice For determining if a validator pubkey was already added or not
    mapping(bytes => bool) public addedValidators;

    /// @notice Used in conjuction with `COMMISSION_RATE_SCALE` for determining service fees
    /// @dev Is set up on the constructor and can be modified with provided setter aswell
    uint32 public commissionRate;

    /// @notice The address for being able to deposit to the ethereum deposit contract
    address public immutable depositContractAddress;

    /// @notice Contract for getting the metadata as base64
    /// @dev stored separately due to contract size restrictions
    SenseistakeMetadata public metadata;

    /// @notice Template service contract implementation address
    /// @dev It is used for generating clones, using hardhats proxy clone
    address public immutable servicesContractImpl;

    /// @notice Token counter for handling NFT
    SenseiStakeV1 public immutable senseiStakeV1;

    /// @notice Token counter for handling NFT
    Counters.Counter public tokenIdCounter;

    /// @notice Stores data used for creating the validator
    mapping(uint256 => Validator) public validators;

    /// @notice Scale for getting the commission rate (service fee)
    uint32 private constant COMMISSION_RATE_SCALE = 1_000_000;

    /// @notice Fixed amount of the deposit
    uint256 private constant FULL_DEPOSIT_SIZE = 32 ether;

    event ValidatorMinted(uint256 tokenIdServiceContract);
    event NFTReceived(uint256 indexed tokenId);
    event ValidatorAdded(uint256 indexed tokenId, bytes indexed validatorPubKey);
    event ValidatorVersionMigration(uint256 indexed oldTokenId, uint256 indexed newTokenId);
    event OldValidatorRewardsClaimed(uint256 amount);
    event MetadataAddressChanged(address newAddress);

    error CallerNotSenseiStake();
    error CommisionRateTooHigh(uint32 rate);
    error InvalidDepositSignature();
    error InvalidMigrationRecepient();
    error InvalidPublicKey();
    error NoMoreValidatorsLoaded();
    error NotAllowedAtCurrentTime();
    error NotEnoughBalance();
    error NotOwner();
    error TokenIdAlreadyMinted();
    error ValidatorAlreadyAdded();
    error ValueSentDifferentThanFullDeposit();

    /// @notice Initializes the contract
    /// @dev Sets token name and symbol, also sets commissionRate and checks its validity
    /// @param name_ The token name
    /// @param symbol_ The token symbol
    /// @param commissionRate_ The service commission rate
    /// @param ethDepositContractAddress_ The ethereum deposit contract address for validator creation
    /// @param senseistakeV1Address_ Address of the v1 senseistake contract
    constructor(
        string memory name_,
        string memory symbol_,
        uint32 commissionRate_,
        address ethDepositContractAddress_,
        address senseistakeV1Address_,
        address senseistakeMetadataAddress_
    ) ERC721(name_, symbol_) {
        if (commissionRate_ > (COMMISSION_RATE_SCALE / 2)) {
            revert CommisionRateTooHigh(commissionRate_);
        }
        commissionRate = commissionRate_;
        depositContractAddress = ethDepositContractAddress_;
        servicesContractImpl = address(new SenseistakeServicesContract());
        senseiStakeV1 = SenseiStakeV1(senseistakeV1Address_);
        metadata = SenseistakeMetadata(senseistakeMetadataAddress_);
        emit MetadataAddressChanged(senseistakeMetadataAddress_);
    }

    /// @notice This is the receive function called when a user performs a transfer to this contract address
    receive() external payable {}

    /// @notice Adds validator info to validators mapping
    /// @dev Stores the tokenId and operatorDataCommitment used for generating new service contract
    /// @param tokenId_ the token Id
    /// @param validatorPubKey_ the validator public key
    /// @param depositSignature_ the deposit_data.json signature
    /// @param depositDataRoot_ the deposit_data.json data root
    function addValidator(
        uint256 tokenId_,
        bytes calldata validatorPubKey_,
        bytes calldata depositSignature_,
        bytes32 depositDataRoot_
    ) external onlyOwner {
        if (tokenId_ <= tokenIdCounter.current()) {
            revert TokenIdAlreadyMinted();
        }
        if (addedValidators[validatorPubKey_]) {
            revert ValidatorAlreadyAdded();
        }
        if (validatorPubKey_.length != 48) {
            revert InvalidPublicKey();
        }
        if (depositSignature_.length != 96) {
            revert InvalidDepositSignature();
        }
        Validator memory validator = Validator(validatorPubKey_, depositSignature_, depositDataRoot_);
        emit ValidatorAdded(tokenId_, validatorPubKey_);
        addedValidators[validatorPubKey_] = true;
        validators[tokenId_] = validator;
    }

    /// @notice Method for changing metadata contract
    /// @param newAddress_ address of the new metadata contract
    function setMetadataAddress(address newAddress_) external onlyOwner {
        metadata = SenseistakeMetadata(newAddress_);
        emit MetadataAddressChanged(newAddress_);
    }

    /// @notice Creates service contract based on implementation
    /// @dev Performs a clone of the implementation contract, a service contract handles logic for managing user deposit, withdraw and validator
    function mintValidator() external payable returns (uint256) {
        if (msg.value != FULL_DEPOSIT_SIZE) {
            revert ValueSentDifferentThanFullDeposit();
        }
        // increment tokenid counter
        tokenIdCounter.increment();
        uint256 tokenId = tokenIdCounter.current();
        Validator memory validator = validators[tokenId];
        // check that validator exists
        if (validator.validatorPubKey.length == 0) {
            revert NoMoreValidatorsLoaded();
        }
        bytes memory initData = abi.encodeWithSignature(
            "initialize(uint32,uint256,bytes,bytes,bytes32,address)",
            commissionRate,
            tokenId,
            validator.validatorPubKey,
            validator.depositSignature,
            validator.depositDataRoot,
            depositContractAddress
        );
        address proxy = Clones.cloneDeterministic(servicesContractImpl, bytes32(tokenId));
        (bool success,) = proxy.call{value: msg.value}(initData);
        require(success, "Proxy init failed");

        emit ValidatorMinted(tokenId);

        // mint the NFT
        _safeMint(msg.sender, tokenId);

        return tokenId;
    }

    /// @notice Creates service contract based on implementation and gives NFT ownership to another user
    /// @dev Performs a clone of the implementation contract, a service contract handles logic for managing user deposit, withdraw and validator
    /// @param owner_ the address that will receive the minted NFT
    function mintValidatorTo(address owner_) external payable returns (uint256) {
        if (msg.value != FULL_DEPOSIT_SIZE) {
            revert ValueSentDifferentThanFullDeposit();
        }
        // increment tokenid counter
        tokenIdCounter.increment();
        uint256 tokenId = tokenIdCounter.current();
        Validator memory validator = validators[tokenId];
        // check that validator exists
        if (validator.validatorPubKey.length == 0) {
            revert NoMoreValidatorsLoaded();
        }
        bytes memory initData = abi.encodeWithSignature(
            "initialize(uint32,uint256,bytes,bytes,bytes32,address)",
            commissionRate,
            tokenId,
            validator.validatorPubKey,
            validator.depositSignature,
            validator.depositDataRoot,
            depositContractAddress
        );
        address proxy = Clones.cloneDeterministic(servicesContractImpl, bytes32(tokenId));
        (bool success,) = proxy.call{value: msg.value}(initData);
        require(success, "Proxy init failed");

        emit ValidatorMinted(tokenId);

        // mint the NFT
        _safeMint(owner_, tokenId);

        return tokenId;
    }

    /// @notice Creates service contract based on implementation
    /// @dev Performs a clone of the implementation contract, a service contract handles logic for managing user deposit, withdraw and validator
    function mintMultipleValidators() external payable {
        if (msg.value == 0 || msg.value % FULL_DEPOSIT_SIZE != 0) {
            revert ValueSentDifferentThanFullDeposit();
        }
        uint256 validators_amount = msg.value / FULL_DEPOSIT_SIZE;
        for (uint256 i = 0; i < validators_amount;) {
            // increment tokenid counter
            tokenIdCounter.increment();
            uint256 tokenId = tokenIdCounter.current();
            Validator memory validator = validators[tokenId];
            // check that validator exists
            if (validator.validatorPubKey.length == 0) {
                revert NoMoreValidatorsLoaded();
            }
            bytes memory initData = abi.encodeWithSignature(
                "initialize(uint32,uint256,bytes,bytes,bytes32,address)",
                commissionRate,
                tokenId,
                validator.validatorPubKey,
                validator.depositSignature,
                validator.depositDataRoot,
                depositContractAddress
            );
            address proxy = Clones.cloneDeterministic(servicesContractImpl, bytes32(tokenId));
            (bool success,) = proxy.call{value: FULL_DEPOSIT_SIZE}(initData);
            require(success, "Proxy init failed");

            emit ValidatorMinted(tokenId);

            // mint the NFT
            _safeMint(msg.sender, tokenId);

            unchecked {
                ++i;
            }
        }
    }

    /// @notice Redefinition of internal function `_isApprovedOrOwner`
    /// @dev Returns whether `spender` is allowed to manage `tokenId`.
    /// @param spender_: the address to check if it has approval or ownership of tokenId
    /// @param tokenId_: the asset to check
    /// @return bool whether it is approved or owner of the token
    function isApprovedOrOwner(address spender_, uint256 tokenId_) external view returns (bool) {
        address owner = ERC721.ownerOf(tokenId_);
        return (spender_ == owner || isApprovedForAll(owner, spender_) || getApproved(tokenId_) == spender_);
    }

    /// @notice Accepting NFT reception for migrating contract v1 to v2
    /// @dev Used for migrating senseistake contract from v1 to v2
    /// @param from_: owner of the tokenId_
    /// @param tokenId_: token id of the NFT transfered
    /// @return selector must return its Solidity selector to confirm the token transfer.
    function onERC721Received(address, address from_, uint256 tokenId_, bytes calldata) external returns (bytes4) {
        if (msg.sender != address(senseiStakeV1)) {
            revert CallerNotSenseiStake();
        }
        emit NFTReceived(tokenId_);

        SenseistakeServicesContractV1 serviceContract =
            SenseistakeServicesContractV1(payable(senseiStakeV1.getServiceContractAddress(tokenId_)));

        // check that exit date has elapsed (because we cannot do endOperatorServices otherwise)
        if (block.timestamp < serviceContract.exitDate()) {
            revert NotAllowedAtCurrentTime();
        }

        // we need to determine service fees and mark service contract as exited
        senseiStakeV1.endOperatorServices(tokenId_);

        // get withdrawable amount so that we determine what to do
        uint256 withdrawable = serviceContract.getWithdrawableAmount();

        // retrieve eth from old service contract
        senseiStakeV1.withdraw(tokenId_);

        // only withdraw available balance to nft owner because mint is not possible
        if (withdrawable < FULL_DEPOSIT_SIZE) {
            revert NotEnoughBalance();
        }
        uint256 reward = withdrawable - FULL_DEPOSIT_SIZE;
        emit OldValidatorRewardsClaimed(reward);
        if (reward > 0) {
            // if withdrawable is greater than FULL_DEPOSIT_SIZE we give nft owner the excess
            payable(from_).sendValue(reward);
        }

        // we can mint new validator to the owner
        uint256 newTokenId = this.mintValidatorTo{value: FULL_DEPOSIT_SIZE}(from_);
        emit ValidatorVersionMigration(tokenId_, newTokenId);

        return this.onERC721Received.selector;
    }

    /// @notice Performs withdraw of balance in service contract
    /// @dev The `tokenId_` is used for deterining the the service contract from which the owner can perform a withdraw (if possible)
    /// @param tokenId_ Is the token Id
    function withdraw(uint256 tokenId_) external {
        if (!_isApprovedOrOwner(msg.sender, tokenId_)) {
            revert NotOwner();
        }
        address proxy = Clones.predictDeterministicAddress(servicesContractImpl, bytes32(tokenId_));
        SenseistakeServicesContract serviceContract = SenseistakeServicesContract(payable(proxy));
        serviceContract.withdrawTo(msg.sender);
    }

    /// @notice Gets service contract address
    /// @dev For getting the service contract address of a given token id
    /// @param tokenId_ Is the token id
    /// @return Address of a service contract
    function getServiceContractAddress(uint256 tokenId_) external view returns (address) {
        return Clones.predictDeterministicAddress(servicesContractImpl, bytes32(tokenId_));
    }

    /// @notice Gets token uri where the metadata of NFT is stored
    /// @param tokenId_ Is the token id
    /// @return Token uri of the tokenId provided
    function tokenURI(uint256 tokenId_) public view override(ERC721) returns (string memory) {
        address proxy = Clones.predictDeterministicAddress(servicesContractImpl, bytes32(tokenId_));
        SenseistakeServicesContract serviceContract = SenseistakeServicesContract(payable(proxy));
        return metadata.getMetadata(
            Strings.toString(tokenId_),
            Strings.toString(serviceContract.createdAt()),
            Strings.toString((COMMISSION_RATE_SCALE / commissionRate)),
            validators[tokenId_].validatorPubKey,
            serviceContract.exitedAt()
        );
    }

    /// @notice For checking that there is a validator available for creation
    /// @return bool true if next validator is available or else false
    function validatorAvailable() external view returns (bool) {
        return validators[tokenIdCounter.current() + 1].validatorPubKey.length > 0;
    }
}
