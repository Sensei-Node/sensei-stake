// SPDX-License-Identifier: MIT
pragma solidity 0.8.4;

import "@openzeppelin/contracts/proxy/utils/Initializable.sol";
import "./interfaces/deposit_contract.sol";
import "./SenseistakeERC721.sol";

// import "hardhat/console.sol";

contract SenseistakeServicesContract is Initializable {
    /// @notice The life cycle of a services contract.
    enum State {
        NotInitialized,
        PreDeposit,
        PostDeposit,
        Withdrawn
    }

    using Address for address payable;

    uint256 private constant MAX_SECONDS_IN_EXIT_QUEUE = 360 days;
    uint32 private constant COMMISSION_RATE_SCALE = 1_000_000;
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

    modifier onlyOperator() {
        require(msg.sender == operatorAddress, "Caller is not the operator");
        _;
    }

    error NotEnoughBalance();
    error CommissionRateScaleExceeded(uint32 rate);
    error CommisionRateTooHigh(uint32 rate);

    event ValidatorDeposited(
        bytes pubkey // 48 bytes
    );

    event ServiceEnd();

    event Claim(address receiver, uint256 amount);

    event Withdrawal(address indexed to, uint256 value);

    event Deposit(address from, uint256 amount);

    event Transfer(address indexed from, address indexed to, uint256 amount);

    function initialize(
        uint32 commissionRate_,
        address operatorAddress_,
        bytes32 operatorDataCommitment_,
        bytes32 salt_
    ) external initializer {
        if (commissionRate_ > COMMISSION_RATE_SCALE) {
            revert CommissionRateScaleExceeded(commissionRate_);
        }
        if (commissionRate_ > (COMMISSION_RATE_SCALE / 2)) {
            revert CommisionRateTooHigh(commissionRate_);
        }
        state = State.PreDeposit;
        commissionRate = commissionRate_;
        operatorAddress = operatorAddress_;
        operatorDataCommitment = operatorDataCommitment_;
        _salt = salt_;
    }

    receive() external payable {
        if (state == State.PreDeposit) {
            revert("Plain Ether transfer not allowed");
        }
    }

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

    function updateExitDate(uint64 exitDate_) external onlyOperator {
        require(state == State.PostDeposit, "Validator is not active");

        require(exitDate_ < exitDate, "Not earlier than the original value");

        exitDate = exitDate_;
    }

    error notDepositor();

    function createValidator(
        bytes calldata validatorPubKey_, // 48 bytes
        bytes calldata depositSignature_, // 96 bytes
        bytes32 depositDataRoot_,
        uint64 exitDate_
    ) external {
        if (msg.sender != depositor) {
            revert notDepositor();
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

    function depositFrom(address depositor_) external payable {
        require(state == State.PreDeposit, "Validator already created");
        _handleDeposit(depositor_);
    }

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

    function operatorClaim() external onlyOperator returns (uint256) {
        uint256 claimable = operatorClaimable;
        if (claimable > 0) {
            operatorClaimable = 0;
            payable(operatorAddress).sendValue(claimable);

            emit Claim(operatorAddress, claimable);
        }

        return claimable;
    }

    string private constant WITHDRAWALS_NOT_ALLOWED =
        "Not allowed when validator is active";

    error notTokenContract();

    function withdrawTo(address beneficiary_) external {
        // callable only from senseistake erc721 contract
        if (msg.sender != tokenContractAddress) {
            revert notTokenContract();
        }
        require(state != State.PostDeposit, WITHDRAWALS_NOT_ALLOWED);
        _executeWithdrawal(beneficiary_);
    }

    function getWithdrawableAmount() external view returns (uint256) {
        if (state == State.PostDeposit) {
            return 0;
        }

        return address(this).balance - operatorClaimable;
    }

    function _executeWithdrawal(address beneficiary_) internal {
        depositor = address(0);
        emit Withdrawal(beneficiary_, FULL_DEPOSIT_SIZE);
        payable(beneficiary_).sendValue(FULL_DEPOSIT_SIZE);
        if (state == State.Withdrawn) {
            SenseistakeERC721(tokenContractAddress).burn(_salt);
        }
    }

    error DepositedAmountLowerThanFullDeposit();

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

    // function _transfer(
    //     address from_,
    //     address to_,
    //     uint256 amount_
    // )
    //     internal
    // {
    //     require(to_ != address(0), "Transfer to the zero address");
    //     depositor = to_;
    //     emit Transfer(from_, to_, amount_);
    // }

    function getDeposit(address depositor_)
        external
        view
        returns (uint256 amount)
    {
        if (depositor == depositor_) amount = 32 ether;
    }

    event DepositorChanged(address indexed from, address indexed to);

    error DepositNotOwned();

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

    function _min(uint256 a_, uint256 b_) internal pure returns (uint256) {
        return a_ <= b_ ? a_ : b_;
    }
}
