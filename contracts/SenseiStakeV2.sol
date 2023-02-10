// SPDX-License-Identifier: MIT
pragma solidity 0.8.17;

import {Address} from "@openzeppelin/contracts/utils/Address.sol";
import {Base64} from "@openzeppelin/contracts/utils/Base64.sol";
import {Clones} from "@openzeppelin/contracts/proxy/Clones.sol";
import {Counters} from "@openzeppelin/contracts/utils/Counters.sol";
import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {IERC721Receiver} from "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {SenseistakeServicesContractV2} from "./SenseistakeServicesContractV2.sol";
import {Strings} from "@openzeppelin/contracts/utils/Strings.sol";
import {SenseiStake as SenseiStakeV1} from "./SenseiStake.sol";

/// @title Main contract for handling SenseiStake Services
/// @author Senseinode
/// @notice Serves as entrypoint for SenseiStake
/// @dev Serves as entrypoint for creating service contracts, depositing, withdrawing and dealing with non fungible token. Inherits the OpenZepplin ERC721 and Ownable implentation
contract SenseiStakeV2 is ERC721, IERC721Receiver, Ownable {
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
    /// @return commissionRate the commission rate
    uint32 public commissionRate;

    /// @notice The address for being able to deposit to the ethereum deposit contract
    /// @return depositContractAddress deposit contract address
    address public immutable depositContractAddress;

    /// @notice Token counter for handling NFT
    SenseiStakeV1 public senseiStakeV1;

    /// @notice Token counter for handling NFT
    Counters.Counter public tokenIdCounter;

    /// @notice Stores data used for creating the validator
    mapping(uint256 => Validator) public validators;

    /// @notice For knowing ownership of v1 NFT
    /// @dev Since migration is a 2 part deal, we need to store ownership of transferred NFT
    mapping(uint256 => address) public migratedValidatorsOwner;

    /// @notice Template service contract implementation address
    /// @dev It is used for generating clones, using hardhats proxy clone
    /// @return servicesContractImpl where the service contract template is implemented
    address public immutable servicesContractImpl;

    /// @notice Scale for getting the commission rate (service fee)
    uint32 private constant COMMISSION_RATE_SCALE = 1_000_000;

    /// @notice Fixed amount of the deposit
    uint256 private constant FULL_DEPOSIT_SIZE = 32 ether;

    /// @notice Period of time for setting the exit date
    uint256 private constant EXIT_DATE_PERIOD = 180 days;

    event ContractCreated(uint256 tokenIdServiceContract);
    event ValidatorAdded(
        uint256 indexed tokenId,
        bytes indexed validatorPubKey
    );

    error ValidatorAlreadyAdded();
    error CommisionRateTooHigh(uint32 rate);
    error InvalidDepositSignature();
    error InvalidPublicKey();
    error NoMoreValidatorsLoaded();
    // error NotEarlierThanOriginalDate();
    error NotOwner();
    error TokenIdAlreadyMinted();
    error ValueSentDifferentThanFullDeposit();

    /// @notice Initializes the contract
    /// @dev Sets token name and symbol, also sets commissionRate and checks its validity
    /// @param name_ The token name
    /// @param symbol_ The token symbol
    /// @param commissionRate_ The service commission rate
    /// @param ethDepositContractAddress_ The ethereum deposit contract address for validator creation
    constructor(
        string memory name_,
        string memory symbol_,
        uint32 commissionRate_,
        address ethDepositContractAddress_,
        address senseistakeV1Address_
    ) ERC721(name_, symbol_) {
        if (commissionRate_ > (COMMISSION_RATE_SCALE / 2)) {
            revert CommisionRateTooHigh(commissionRate_);
        }
        commissionRate = commissionRate_;
        depositContractAddress = ethDepositContractAddress_;
        servicesContractImpl = address(new SenseistakeServicesContractV2());
        senseiStakeV1 = SenseiStakeV1(senseistakeV1Address_);
    }

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
        Validator memory validator = Validator(
            validatorPubKey_,
            depositSignature_,
            depositDataRoot_
        );
        addedValidators[validatorPubKey_] = true;
        validators[tokenId_] = validator;
        emit ValidatorAdded(tokenId_, validatorPubKey_);
    }

    /// @notice Creates service contract based on implementation
    /// @dev Performs a clone of the implementation contract, a service contract handles logic for managing user deposit, withdraw and validator
    function createContract() external payable returns (uint256) {
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
            "initialize(uint32,uint256,uint64,bytes,bytes,bytes32,address)",
            commissionRate,
            tokenId,
            block.timestamp + EXIT_DATE_PERIOD,
            validator.validatorPubKey,
            validator.depositSignature,
            validator.depositDataRoot,
            depositContractAddress
        );
        address proxy = Clones.cloneDeterministic(
            servicesContractImpl,
            bytes32(tokenId)
        );
        (bool success, ) = proxy.call{value: msg.value}(initData);
        require(success, "Proxy init failed");

        emit ContractCreated(tokenId);

        // mint the NFT
        _safeMint(msg.sender, tokenId);

        return tokenId;
    }

    /// @notice Creates service contract based on implementation
    /// @dev Performs a clone of the implementation contract, a service contract handles logic for managing user deposit, withdraw and validator
    function createMultipleContracts() external payable {
        if (msg.value == 0 || msg.value % FULL_DEPOSIT_SIZE != 0) {
            revert ValueSentDifferentThanFullDeposit();
        }
        uint256 validators_amount = msg.value / FULL_DEPOSIT_SIZE;
        for (uint256 i = 0; i < validators_amount; ) {    
            // increment tokenid counter
            tokenIdCounter.increment();
            uint256 tokenId = tokenIdCounter.current();
            Validator memory validator = validators[tokenId];
            // check that validator exists
            if (validator.validatorPubKey.length == 0) {
                revert NoMoreValidatorsLoaded();
            }
            bytes memory initData = abi.encodeWithSignature(
                "initialize(uint32,uint256,uint64,bytes,bytes,bytes32,address)",
                commissionRate,
                tokenId,
                block.timestamp + EXIT_DATE_PERIOD,
                validator.validatorPubKey,
                validator.depositSignature,
                validator.depositDataRoot,
                depositContractAddress
            );
            address proxy = Clones.cloneDeterministic(
                servicesContractImpl,
                bytes32(tokenId)
            );
            (bool success, ) = proxy.call{value: msg.value}(initData);
            require(success, "Proxy init failed");

            emit ContractCreated(tokenId);

            // mint the NFT
            _safeMint(msg.sender, tokenId);

            unchecked {
                ++i;
            }
        }
    }

    /// @notice Allows user or contract owner to start the withdrawal process
    /// @dev Calls end operator services in service contract
    /// @param tokenId_ the token id to end
    // function endOperatorServices(uint256 tokenId_) external {
    //     if (
    //         !_isApprovedOrOwner(msg.sender, tokenId_) && msg.sender != owner()
    //     ) {
    //         revert NotOwner();
    //     }
    //     address proxy = Clones.predictDeterministicAddress(
    //         servicesContractImpl,
    //         bytes32(tokenId_)
    //     );
    //     SenseistakeServicesContract serviceContract = SenseistakeServicesContract(
    //             payable(proxy)
    //         );
    //     serviceContract.endOperatorServices();
    // }

    /// @notice Redefinition of internal function `_isApprovedOrOwner`
    /// @dev Returns whether `spender` is allowed to manage `tokenId`.
    /// @param spender_: the address to check if it has approval or ownership of tokenId
    /// @param tokenId_: the asset to check
    /// @return bool whether it is approved or owner of the token
    function isApprovedOrOwner(address spender_, uint256 tokenId_)
        external
        view
        returns (bool)
    {
        address owner = ERC721.ownerOf(tokenId_);
        return (spender_ == owner ||
            isApprovedForAll(owner, spender_) ||
            getApproved(tokenId_) == spender_);
    }

    /// @notice Whenever an {IERC721} `tokenId` token is transferred to this contract via {IERC721-safeTransferFrom}
    /// @param operator_: person that calls safeTransferFrom()
    /// @param from_: owner of the tokenId_
    /// @param tokenId_: token id of the NFT transfered
    /// @param data_: it is empty string if called from safeTransferFrom(from, to, tokenId)
    /// @return bytes4 must return its Solidity selector to confirm the token transfer.
    function onERC721Received(
        address operator_,
        address from_,
        uint256 tokenId_,
        bytes calldata data_
    ) external override returns (bytes4) {
        // ! check that tokenId sent was from this collection, and from_ is the owner/approved user
        if (senseiStakeV1.isApprovedOrOwner(from_, tokenId_)) {
            migratedValidatorsOwner[tokenId_] = from_;
            // TODO: perhaps include here an event 'validatorReceived
            return IERC721Receiver.onERC721Received.selector;
        }
        // TODO: check if I need to return something or not
    }

    /// @notice Accepting NFT reception for migrating contract v1 to v2
    /// @dev Used for migrating senseistake contract from v1 to v2
    /// @param oldTokenId_: token id of the NFT transfered from v1
    function versionMigration(
        uint256 oldTokenId_
    ) external returns (uint256) { 
        /*
        El objetivo seria que el cliente de el ownership de su NFT a este contrato, para poder
        finalizar el validador y luego claimear los ETH, finalmente mintear uno nuevo y 
        transferirselo al usuario nuevamente
        
        Debemos verificar primero que el contrato de servicio tenga mas de 32 ETH (para poder mintear de nuevo)

        1. Al recibir el nft con la funcion `senseistakev1.safeTransferFrom(from_, address(this), tokenId_, "")` se llama aqui
        2. Vamos a hacer el `senseistakev1.endOperatorServices(tokenId_)`
        3. Vamos a retirar los ETH del service contract viejo `senseistakev1.withdraw(tokenId_)` y van a quedar aqui temporalmente
        4. Vamos a mintear un nuevo NFT con la version 2 `createContract()` (retornara newTokenId)
        5. Vamos a transferir ese NFT al from_ `safeTransferFrom(address(this), from_, newTokenId)

        NOTA: senseistakev1 == SenseStake(operator_)
        */

        address proxy = Clones.predictDeterministicAddress(
            senseiStakeV1.servicesContractImpl(),
            bytes32(oldTokenId_)
        );
        SenseistakeServicesContractV2 serviceContract = SenseistakeServicesContractV2(
            payable(proxy)
        );
        if (address(serviceContract).balance >= FULL_DEPOSIT_SIZE) {
            senseiStakeV1.endOperatorServices(oldTokenId_);
            senseiStakeV1.withdraw(oldTokenId_);
            uint256 newTokenId = this.createContract();
            this.safeTransferFrom(address(this), migratedValidatorsOwner[oldTokenId_], newTokenId);
            return newTokenId;
        }
        // TODO: determine if we need to emit some event
    }


    /// @notice Performs withdraw of balance in service contract
    /// @dev The `tokenId_` is used for deterining the the service contract from which the owner can perform a withdraw (if possible)
    /// @param tokenId_ Is the token Id
    function withdraw(uint256 tokenId_) external {
        if (!_isApprovedOrOwner(msg.sender, tokenId_)) {
            revert NotOwner();
        }
        address proxy = Clones.predictDeterministicAddress(
            servicesContractImpl,
            bytes32(tokenId_)
        );
        SenseistakeServicesContractV2 serviceContract = SenseistakeServicesContractV2(
                payable(proxy)
            );
        // _burn(tokenId_);
        serviceContract.withdrawTo(msg.sender);
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
        address proxy = Clones.predictDeterministicAddress(
            servicesContractImpl,
            bytes32(tokenId_)
        );
        SenseistakeServicesContractV2 serviceContract = SenseistakeServicesContractV2(
                payable(proxy)
            );
        return
            string(
                abi.encodePacked(
                    "data:application/json;base64,",
                    Base64.encode(
                        bytes(
                            abi.encodePacked(
                                '{"name":"ETH Validator #',
                                Strings.toString(tokenId_),
                                '","description":"Sensei Stake is a non-custodial staking platform for Ethereum 2.0, that uses a top-performance node infrastructure provided by Sensei Node. Each NFT of this collection certifies the ownership receipt for one active ETH2 Validator and its accrued proceeds from protocol issuance and transaction processing fees. These nodes are distributed across the Latin American region, on local or regional hosting service providers, outside centralized global cloud vendors. Together we are fostering decentralization and strengthening the Ethereum ecosystem. One node at a time. Decentralization matters.",',
                                '"external_url":"https://dashboard.senseinode.com/redirsenseistake?v=',
                                _bytesToHexString(
                                    validators[tokenId_].validatorPubKey
                                ),
                                '","minted_at":',
                                Strings.toString(block.timestamp),
                                ',"image":"',
                                "ipfs://bafybeifgh6572j2e6ioxrrtyxamzciadd7anmnpyxq4b33wafqhpnncg7m",
                                '","attributes": [{"trait_type": "Validator Address","value":"',
                                _bytesToHexString(
                                    validators[tokenId_].validatorPubKey
                                ),
                                '"},{',
                                '"trait_type":"Exit Date","display_type":"date","value":"',
                                Strings.toString(serviceContract.exitDate()),
                                '"},{',
                                '"trait_type": "Commission Rate","display_type":"string","value":"',
                                Strings.toString(
                                    (COMMISSION_RATE_SCALE / commissionRate)
                                ),
                                '%"}]}'
                            )
                        )
                    )
                )
            );
    }

    /// @notice For checking that there is a validator available for creation
    /// @return bool true if next validator is available or else false
    function validatorAvailable() external view returns (bool) {
        return
            validators[tokenIdCounter.current() + 1].validatorPubKey.length > 0;
    }

    /// @notice For removing ownership of an NFT from a wallet address
    /// @param tokenId_ Is the token id
    function _burn(uint256 tokenId_) internal override(ERC721) {
        super._burn(tokenId_);
    }

    /// @notice Helper function for converting bytes to hex string
    /// @param buffer_ bytes data to convert
    /// @return string converted buffer
    function _bytesToHexString(bytes memory buffer_)
        internal
        pure
        returns (string memory)
    {
        // Fixed buffer size for hexadecimal convertion
        bytes memory converted = new bytes(buffer_.length * 2);
        bytes memory _base = "0123456789abcdef";
        for (uint256 i = 0; i < buffer_.length; ) {
            converted[i * 2] = _base[uint8(buffer_[i]) / _base.length];
            converted[i * 2 + 1] = _base[uint8(buffer_[i]) % _base.length];
            unchecked {
                ++i;
            }
        }
        return string(abi.encodePacked("0x", converted));
    }
}
