// SPDX-License-Identifier: MIT
pragma solidity 0.8.4;

import "@openzeppelin/contracts/proxy/utils/Initializable.sol";
import {IDepositContract} from "./interfaces/IDepositContract.sol";
import {SenseiStake} from "./SenseiStake.sol";

/// @title A Service contract for handling SenseiStake Validators
/// @author Senseinode
/// @notice A service contract is where the deposits of a client are managed and all validator related tasks are performed. The ERC721 contract is the entrypoint for a client deposit, from there it is separeted into 32ETH chunks and then sent to different service contracts.
/// @dev This contract is the implementation for the proxy factory clones that are made on ERC721 contract function (createContract) (an open zeppelin solution to create the same contract multiple times with gas optimization). The openzeppelin lib: https://docs.openzeppelin.com/contracts/4.x/api/proxy#Clone
contract SenseistakeServicesContract is Initializable {
    using Address for address payable;

    /// @notice The life cycle of a services contract.
    enum State {
        NotInitialized,
        PreDeposit,
        PostDeposit,
        Withdrawn
    }

    /// @notice Used in conjuction with `COMMISSION_RATE_SCALE` for determining service fees
    /// @dev Is set up on the constructor and can be modified with provided setter aswell
    /// @return commissionRate the commission rate
    uint32 public commissionRate;

    /// @notice Scale for getting the commission rate (service fee)
    uint32 private constant COMMISSION_RATE_SCALE = 1_000_000;

    /// @notice Used for determining from when the user deposit can be withdrawn.
    /// @dev The call of endOperatorServices function is the first step to withdraw the deposit. It changes the state to Withdrawn
    /// @return exitDate the exit date
    uint64 public exitDate;

    /// @notice The tokenId used to create this contract using the proxy clone
    uint256 public tokenId;

    /// @notice Operator Address
    /// @return operatorAddress operator address
    address public operatorAddress;

    /// @notice The amount of eth the operator can claim
    /// @return state the operator claimable amount (in eth)
    uint256 public operatorClaimable;

    /// @notice The address for being able to deposit to the ethereum deposit contract
    /// @return depositContractAddress deposit contract address
    address public immutable depositContractAddress;

    /// @notice The address of Senseistakes ERC721 contract address
    /// @return tokenContractAddress the token contract address (erc721)
    address public immutable tokenContractAddress;

    /// @notice Depositor address for determining if user deposited
    /// @return depositor the address of the depositor
    address public depositor;

    /// @notice Fixed amount of the deposit
    uint256 private constant FULL_DEPOSIT_SIZE = 32 ether;

    /// @notice Max second in exit queue, used when a user calls endOperatorServices
    uint256 private constant MAX_SECONDS_IN_EXIT_QUEUE = 360 days;

    /// @notice The state of the lifecyle of the service contract. This allows or forbids to make any action.
    /// @dev This uses the State enum
    /// @return state the state
    State public state;

    bytes private _validatorPubKey;
    bytes private _depositSignature;
    bytes32 private _depositDataRoot;

    event Claim(address receiver, uint256 amount);
    event Deposit(address from, uint256 amount);
    event DepositorChanged(address indexed from, address indexed to);
    event ServiceEnd();
    event Transfer(address indexed from, address indexed to, uint256 amount);
    event ValidatorDeposited(bytes pubkey);
    event Withdrawal(address indexed to, uint256 value);

    error CannotEndZeroBalance();
    error CommissionRateScaleExceeded(uint32 rate);
    error CommissionRateTooHigh(uint32 rate);
    error DepositedAmountLowerThanFullDeposit();
    error DepositNotOwned();
    error InvalidDepositSignature();
    error NotAllowedAtCurrentTime();
    error NotAllowedInCurrentState();
    error NotEarlierThanOriginalDate();
    error NotEnoughBalance();
    error NotOperator();
    error NotTokenContract();
    error TransferNotEnabled();
    error ValidatorAlreadyCreated();
    error ValidatorIsActive();
    error ValidatorNotActive();

    /// @notice Only the operator access.
    modifier onlyOperator() {
        if (msg.sender != operatorAddress) {
            revert NotOperator();
        }
        _;
    }

    /// @notice Initializes the contract
    /// @dev Sets the eth deposit contract address
    /// @param ethDepositContractAddress_ The eth deposit contract address for creating validator
    constructor(address ethDepositContractAddress_) {
        tokenContractAddress = msg.sender;
        depositContractAddress = ethDepositContractAddress_;
    }

    /// @notice This is the receive function called when a user performs a transfer to this contract address
    receive() external payable {
        if (state == State.PreDeposit) {
            revert TransferNotEnabled();
        }
    }

    /// @notice Initializes the contract
    /// @dev Sets the commission rate, the operator address, operator data commitment and the tokenId
    /// @param commissionRate_  The service commission rate
    /// @param operatorAddress_ The operator address
    /// @param tokenId_ The token id that is used
    /// @param validatorPubKey_ The validator public key
    /// @param depositSignature_ The deposit_data.json signature
    /// @param depositDataRoot_ The deposit_data.json data root
    /// @param exitDate_ The exit date
    function initialize(
        uint32 commissionRate_,
        address operatorAddress_,
        uint256 tokenId_,
        bytes calldata validatorPubKey_,
        bytes calldata depositSignature_,
        bytes32 depositDataRoot_,
        uint64 exitDate_
    ) external initializer {
        state = State.PreDeposit;
        commissionRate = commissionRate_;
        operatorAddress = operatorAddress_;
        tokenId = tokenId_;
        _validatorPubKey = validatorPubKey_;
        _depositSignature = depositSignature_;
        _depositDataRoot = depositDataRoot_;
        exitDate = exitDate_;
    }

    /// @notice Used for handling client deposits
    /// @dev The ERC721 contract calls this method using fundMultipleContract. Its current State must be PreDeposit for allowing deposit
    /// @param depositor_ The ETH depositor
    function depositFrom(address depositor_) external payable {
        if (state != State.PreDeposit) {
            revert ValidatorAlreadyCreated();
        }
        _handleDeposit(depositor_);
    }

    /// @notice This creates the validator sending ethers to the deposit contract.
    function createValidator() external {
        if (msg.sender != tokenContractAddress) {
            revert NotTokenContract();
        }
        if (state != State.PreDeposit) {
            revert ValidatorAlreadyCreated();
        }
        state = State.PostDeposit;

        IDepositContract(depositContractAddress).deposit{
            value: FULL_DEPOSIT_SIZE
        }(
            _validatorPubKey,
            abi.encodePacked(uint96(0x010000000000000000000000), address(this)),
            _depositSignature,
            _depositDataRoot
        );

        emit ValidatorDeposited(_validatorPubKey);
    }

    /// @notice Allows user to start the withdrawal process
    /// @dev After a withdrawal is made in the validator, the receiving address is set to this contract address, so there will be funds available in here. This function needs to be called for being able to withdraw current balance
    function endOperatorServices() external {
        uint256 balance = address(this).balance;
        if (balance == 0) {
            revert CannotEndZeroBalance();
        }
        if (state != State.PostDeposit) {
            revert NotAllowedInCurrentState();
        }
        if (
            (msg.sender == operatorAddress && block.timestamp < exitDate) ||
            (msg.sender == SenseiStake(tokenContractAddress).ownerOf(tokenId) &&
                block.timestamp < exitDate + MAX_SECONDS_IN_EXIT_QUEUE) ||
            (msg.sender == tokenContractAddress &&
                block.timestamp < exitDate + MAX_SECONDS_IN_EXIT_QUEUE)
        ) {
            revert NotAllowedAtCurrentTime();
        }

        state = State.Withdrawn;

        if (balance > 32 ether) {
            uint256 profit = balance - 32 ether;
            uint256 finalCommission = (profit * commissionRate) /
                COMMISSION_RATE_SCALE;
            operatorClaimable += finalCommission;
        }

        emit ServiceEnd();
    }

    /// @notice Transfers to operator the claimable amount of eth
    /// @return amount of eth the operator received
    function operatorClaim() external onlyOperator returns (uint256) {
        uint256 claimable = operatorClaimable;
        if (claimable > 0) {
            operatorClaimable = 0;
            payable(operatorAddress).sendValue(claimable);

            emit Claim(operatorAddress, claimable);
        }

        return claimable;
    }

    /// @notice For updating the exitDate
    /// @dev The exit date must be after the current exit date and it's only possible in PostDeposit state
    /// @param exitDate_ The new exit date
    function updateExitDate(uint64 exitDate_) external onlyOperator {
        if (state != State.PostDeposit) {
            revert ValidatorNotActive();
        }
        if (exitDate_ < exitDate) {
            revert NotEarlierThanOriginalDate();
        }
        exitDate = exitDate_;
    }

    /// @notice Withdraw the deposit to a beneficiary
    /// @dev The beneficiary must have deposted before. Is not possible to withdraw in PostDeposit state. Can only be called from the ERC721 contract
    /// @param beneficiary_ Who will receive the deposit
    function withdrawTo(address beneficiary_) external {
        // callable only from senseistake erc721 contract
        if (msg.sender != tokenContractAddress) {
            revert NotTokenContract();
        }
        if (state == State.PostDeposit) {
            revert ValidatorIsActive();
        }
        _executeWithdrawal(beneficiary_);
    }

    /// @notice Get withdrawable amount of a user
    /// @return amount the depositor is allowed withdraw
    function getWithdrawableAmount() external view returns (uint256) {
        if (state == State.PostDeposit) {
            return 0;
        }

        return address(this).balance - operatorClaimable;
    }

    /// @notice Sends ethers to a beneficiary
    /// @dev The transfer is made here and after that the NTF burn method is called only if in Withdrawn State.
    /// @param beneficiary_ who can receive the deposit
    function _executeWithdrawal(address beneficiary_) internal {
        emit Withdrawal(
            beneficiary_,
            address(this).balance - operatorClaimable
        );
        payable(beneficiary_).sendValue(
            address(this).balance - operatorClaimable
        );
    }

    /// @notice This is the main part of the deposit process.
    /// @param depositor_ is the user who made the deposit
    function _handleDeposit(address depositor_) internal {
        if (msg.value < FULL_DEPOSIT_SIZE) {
            revert DepositedAmountLowerThanFullDeposit();
        }

        uint256 surplus = (address(this).balance > 32 ether)
            ? (address(this).balance - 32 ether)
            : 0;

        uint256 acceptedDeposit = msg.value - surplus;
        depositor = depositor_;
        emit Deposit(depositor_, acceptedDeposit);

        if (surplus > 0) {
            payable(depositor_).sendValue(surplus);
        }
    }
}
