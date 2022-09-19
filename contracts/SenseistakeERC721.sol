// SPDX-License-Identifier: MIT
pragma solidity 0.8.4;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Strings} from "@openzeppelin/contracts/utils/Strings.sol";
import {Counters} from "@openzeppelin/contracts/utils/Counters.sol";
import {Clones} from "@openzeppelin/contracts/proxy/Clones.sol";
import {Address} from "@openzeppelin/contracts/utils/Address.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";
import {SenseistakeServicesContract} from "./SenseistakeServicesContract.sol";


/// @title An ERC721 contract for handling SenseiStake Services
/// @author Senseinode
/// @notice Serves as entrypoint for SenseiStake
/// @dev Serves as entrypoint for creating service contracts, depositing, withdrawing and dealing with non fungible token. Inherits the OpenZepplin ERC721 and Ownable implentation
contract SenseistakeERC721 is ERC721, Ownable {
    using Address for address;
    using Address for address payable;
    using Counters for Counters.Counter;

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

    /// @notice IPFS base uri
    string public _baseURI_ =
        "ipfs://bafybeiakelvegorvmexqb6rpwge22bk3tvg3j2jpvgvi6hgskis3zmdjti/";

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
            "000000000000000000000000000000000000000000000000",
            "000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000",
            "",
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
        Validator memory validator = Validator(
            validatorPubKey_,
            depositSignature_,
            depositDataRoot_,
            exitDate_
        );
        validators[tokenId_] = validator;
    }

    /// @notice Changes ipfs base uri
    /// @param baseURI_ The new base uri
    function changeBaseUri(string memory baseURI_) external onlyOwner {
        _baseURI_ = baseURI_;
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

        // TODO: validar que validator exista

        bytes memory initData = abi.encodeWithSignature(
            "initialize(uint32,address,uint256,bytes,bytes,bytes32,uint64)",
            commissionRate,
            owner(),
            tokenId,
            validator.validatorPubKey,
            validator.depositSignature,
            validator.depositDataRoot,
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
        SenseistakeServicesContract(payable(proxy)).createValidator();

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
        address proxy = getServiceContractAddress( tokenId_ );

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
        address proxy = getServiceContractAddress( tokenId_ );

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
        public 
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
        return super.tokenURI(tokenId_);
    }

    /// @notice IPFS base uri
    /// @dev Base URI for computing {tokenURI}. If set, the resulting URI for each token will be the concatenation of the `baseURI` and the `tokenId`.
    function _baseURI() internal view virtual override returns (string memory) {
        return _baseURI_;
    }

    /// @notice For removing ownership of an NFT from a wallet address
    /// @param tokenId_ Is the token id
    function _burn(uint256 tokenId_) internal override(ERC721) {
        super._burn(tokenId_);
    }
}
