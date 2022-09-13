// SPDX-License-Identifier: MIT
pragma solidity 0.8.4;

import "@openzeppelin/contracts/proxy/utils/Initializable.sol";
import "./interfaces/deposit_contract.sol";
import "./SenseistakeERC721.sol";

// import "hardhat/console.sol";

/// @title A Service contract for handling SenseiStake Validators
/// @author Senseinode
/// @notice Serves like a middle point where the deposit is gone before the Validator is created. The deposit is made here to this contract till to create a validator. And in the same way from the deposit contract to the depositor this contract act as a middle point.
/// @dev This contract is a proxy factory clone (an open zeppelin solution to create the same contract multiple times with gas optimization).The openzeppelin lib : https://docs.openzeppelin.com/contracts/4.x/api/proxy#Clone
contract SenseistakeServicesContract is Initializable {
    /// @notice The life cycle of a services contract.
    enum State {
        NotInitialized,
        PreDeposit,
        PostDeposit,
        Withdrawn
    }

    using Address for address payable;

    /// @notice this literal is used in the withdrawal proccess
    string private constant WITHDRAWALS_NOT_ALLOWED =
        "Not allowed when validator is active";

    /// @notice Max second in exit queue
    uint256 private constant MAX_SECONDS_IN_EXIT_QUEUE = 360 days;

    /// @notice Scale for getting the commission rate (service fee)
    uint32 private constant COMMISSION_RATE_SCALE = 1_000_000;

    /// @notice Fixed amount of the deposit
    uint256 private constant FULL_DEPOSIT_SIZE = 32 ether;

    bytes32 private _salt;

    // Packed into a single slot
    address public operatorAddress;
    uint32 public commissionRate;
    uint64 public exitDate;
    State public state;

    bytes32 public operatorDataCommitment;

    uint256 public operatorClaimable;

    // for being able to deposit to the ethereum deposit contracts
    address public depositContractAddress;

    // for getting the token contact address and then calling mint/burn methods
    address public tokenContractAddress;

    // depositor address for determining if user deposited
    address public depositor;

    /// @notice Only the operator access.
    modifier onlyOperator() {
        require(msg.sender == operatorAddress, "Caller is not the operator");
        _;
    }

    event Claim(address receiver, uint256 amount);
    event Deposit(address from, uint256 amount);
    event DepositorChanged(address indexed from, address indexed to);
    event ServiceEnd();
    event Transfer(address indexed from, address indexed to, uint256 amount);
    event ValidatorDeposited(
        bytes pubkey /* 48 bytes */
    );
    event Withdrawal(address indexed to, uint256 value);

    error CommissionRateScaleExceeded(uint32 rate);
    error CommissionRateTooHigh(uint32 rate);
    error DepositedAmountLowerThanFullDeposit();
    error DepositNotOwned();
    error NotDepositor();
    error NotEnoughBalance();
    error NotTokenContract();

    /// @notice Initializes the contract
    /// @dev Sets the commission rate, the operator address, operator data commitment and the salt
    /// @param commissionRate_  The service commission rate
    /// @param operatorAddress_ The operator address
    /// @param operatorDataCommitment_ The operator data commitment
    /// @param salt_ The salt is used
    function initialize(
        uint32 commissionRate_,
        address operatorAddress_,
        bytes32 operatorDataCommitment_,
        bytes32 salt_
    ) external initializer {
        if (commissionRate_ > (COMMISSION_RATE_SCALE / 2)) {
            revert CommissionRateTooHigh(commissionRate_);
        }
        state = State.PreDeposit;
        commissionRate = commissionRate_;
        operatorAddress = operatorAddress_;
        operatorDataCommitment = operatorDataCommitment_;
        _salt = salt_;
    }

    /// @notice This is the receive payable (fallback) used to force to deposit using the deposit method.
    receive() external payable {
        if (state == State.PreDeposit) {
            revert("Plain Ether transfer not allowed");
        }
    }

    /// @notice The ERC721 call this method using fundMultipleContract. It's receive the ethers. This states to PreDeposit
    /// @param depositor_ The depositor of the eth
    function depositFrom(address depositor_) external payable {
        require(state == State.PreDeposit, "Validator already created");
        _handleDeposit(depositor_);
    }

    /// @notice Change the depositor of the contract when the tranfer is made.
    /// @param from_ The address who made the transfer
    /// @param to_ The receiver
    function changeDepositor(address from_, address to_) external {
        address owner = msg.sender;
        if (msg.sender == tokenContractAddress) {
            owner = from_;
        }
        if (owner != from_) {
            revert DepositNotOwned();
        }
        depositor = to_;
        emit DepositorChanged(from_, to_);
    }

    /// @notice This create the validator sending the ethers to the deposit contract.
    /// @param validatorPubKey_ The validator public key
    /// @param depositSignature_ The deposit signature
    /// @param depositDataRoot_ The deposit data root
    /// @param exitDate_ The exit date
    function createValidator(
        bytes calldata validatorPubKey_, // 48 bytes
        bytes calldata depositSignature_, // 96 bytes
        bytes32 depositDataRoot_,
        uint64 exitDate_
    ) external {
        if (msg.sender != depositor) {
            revert NotDepositor();
        }
        require(state == State.PreDeposit, "Validator has been created");
        state = State.PostDeposit;

        require(validatorPubKey_.length == 48, "Invalid validator public key");
        require(depositSignature_.length == 96, "Invalid deposit signature");
        require(
            operatorDataCommitment ==
                keccak256(
                    abi.encodePacked(
                        address(this),
                        validatorPubKey_,
                        depositSignature_,
                        depositDataRoot_,
                        exitDate_
                    )
                ),
            "Data doesn't match commitment"
        );

        exitDate = exitDate_;

        IDepositContract(depositContractAddress).deposit{
            value: FULL_DEPOSIT_SIZE
        }(
            validatorPubKey_,
            abi.encodePacked(uint96(0x010000000000000000000000), address(this)),
            depositSignature_,
            depositDataRoot_
        );

        SenseistakeERC721(tokenContractAddress).safeMint(msg.sender, _salt);

        emit ValidatorDeposited(validatorPubKey_);
    }

    /// @notice Run when the user want to withdraw after the create Validator. This states to Withdrawn if it is all ok.
    function endOperatorServices() external {
        uint256 balance = address(this).balance;
        require(balance > 0, "Can't end with 0 balance");
        require(state == State.PostDeposit, "Not allowed in the current state");
        require(
            (msg.sender == operatorAddress && block.timestamp > exitDate) ||
                (depositor != address(0) &&
                    block.timestamp > exitDate + MAX_SECONDS_IN_EXIT_QUEUE),
            "Not allowed at the current time"
        );

        state = State.Withdrawn;

        if (balance > 32 ether) {
            uint256 profit = balance - 32 ether;
            uint256 finalCommission = (profit * commissionRate) /
                COMMISSION_RATE_SCALE;
            operatorClaimable += finalCommission;
        }

        emit ServiceEnd();
    }

    /// @notice transfer to operator the claimable amount ot eth
    /// @return amount of eth the operator was claimed
    function operatorClaim() external onlyOperator returns (uint256) {
        uint256 claimable = operatorClaimable;
        if (claimable > 0) {
            operatorClaimable = 0;
            payable(operatorAddress).sendValue(claimable);

            emit Claim(operatorAddress, claimable);
        }

        return claimable;
    }

    /// @notice This sets the deposit contract address. This action could made once.
    /// @param ethDepositContractAddress_ The new deposit contract address
    function setEthDepositContractAddress(address ethDepositContractAddress_)
        external
        onlyOperator
    {
        require(
            depositContractAddress == address(0),
            "Already set up ETH deposit contract address"
        );
        depositContractAddress = ethDepositContractAddress_;
    }

    /// @notice  This sets the erc721 token address. This action could made once.
    /// @param tokenContractAddress_ The new erc721 address
    function setTokenContractAddress(address tokenContractAddress_)
        external
        onlyOperator
    {
        require(
            tokenContractAddress == address(0),
            "Already set up token contract address"
        );
        tokenContractAddress = tokenContractAddress_;
    }

    /// @notice This create the validator sending the ethers to the deposit contract.
    /// @param exitDate_ The new exit date
    /// @dev the exit date must be after the current exit date and it's only possible in postDeposit state
    function updateExitDate(uint64 exitDate_) external onlyOperator {
        require(state == State.PostDeposit, "Validator is not active");

        require(exitDate_ < exitDate, "Not earlier than the original value");

        exitDate = exitDate_;
    }

    /// @notice Withdraw the deposit to a beneficiary
    /// @param beneficiary_ who can receive the deposit
    /// @dev the beneficiary must have deposted before. Is not possible to withdraw in postDeposit state
    function withdrawTo(address beneficiary_) external {
        // callable only from senseistake erc721 contract
        if (msg.sender != tokenContractAddress) {
            revert NotTokenContract();
        }
        require(state != State.PostDeposit, WITHDRAWALS_NOT_ALLOWED);
        _executeWithdrawal(beneficiary_);
    }

    /// @notice Access to the deposit contract address
    /// @param depositor_ The deposit contract address
    function getDeposit(address depositor_)
        external
        view
        returns (uint256 amount)
    {
        if (depositor == depositor_) amount = 32 ether;
    }

    /// @notice get withdrawal amount
    /// @return amount the depositor is allowed withdraw
    function getWithdrawableAmount() external view returns (uint256) {
        if (state == State.PostDeposit) {
            return 0;
        }

        return address(this).balance - operatorClaimable;
    }

    /// @notice This is mainpart of the withdrawal process.
    /// @param beneficiary_ who can receive the deposit
    /// @dev The transfer is made here and after that the burn is call.
    function _executeWithdrawal(address beneficiary_) internal {
        depositor = address(0);
        emit Withdrawal(beneficiary_, FULL_DEPOSIT_SIZE);
        payable(beneficiary_).sendValue(FULL_DEPOSIT_SIZE);
        if (state == State.Withdrawn) {
            SenseistakeERC721(tokenContractAddress).burn(_salt);
        }
    }

    /// @notice This is the main part of the deposit process.
    /// @param depositor_ is the user who made the depositor
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

    /// @notice Returns min value of two provided (if equality returns first)
    /// @param a_ The first value
    /// @param b_ The second value
    function _min(uint256 a_, uint256 b_) internal pure returns (uint256) {
        return a_ <= b_ ? a_ : b_;
    }
}
