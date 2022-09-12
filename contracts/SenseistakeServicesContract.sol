// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.

// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details.

// You should have received a copy of the GNU General Public License
// along with this program.  If not, see <http://www.gnu.org/licenses/>.

// SPDX-License-Identifier: GPL-3.0-only

pragma solidity 0.8.4;

import "@openzeppelin/contracts/proxy/utils/Initializable.sol";
import "./interfaces/deposit_contract.sol";
// import "./SenseistakeERC721.sol";
import * as ERC721Contract  from "./SenseistakeERC721.sol";

import "hardhat/console.sol";

contract SenseistakeServicesContract is Initializable {

    /// @notice The life cycle of a services contract.
    enum State {
        NotInitialized,
        PreDeposit,
        PostDeposit,
        Withdrawn
    }
    using Address for address payable;

    uint256 private constant YEAR = 360 days;
    uint256 private constant MAX_SECONDS_IN_EXIT_QUEUE = 1 * YEAR;
    uint256 private constant COMMISSION_RATE_SCALE = 100;
    uint256 private constant FULL_DEPOSIT_SIZE = 32 ether;
    bytes32 private _salt;

    // Packed into a single slot
    address public operatorAddress;
    uint8 public commissionRate;
    uint64 public exitDate;
    State public state;

    bytes32 public operatorDataCommitment;

    uint256 public operatorClaimable;

    // for being able to deposit to the ethereum deposit contracts
    address public depositContractAddress;

    // for getting the token contact address and then calling mint/burn methods
    address public tokenContractAddress;

    // depositor address and deposited amount
    uint256 public deposits;
    address public depositor;

    modifier onlyOperator() {
        require(
            msg.sender == operatorAddress,
            "Caller is not the operator"
        );
        _;
    }

    error NotEnoughBalance();
    error CommissionRateScaleExceeded(uint8 rate);
    error CommisionRateTooHigh(uint8 rate);

    event ValidatorDeposited(
        bytes pubkey // 48 bytes
    );

    event ServiceEnd();

    event Claim(
        address receiver,
        uint256 amount
    );

    event Withdrawal(
        address indexed owner,
        address indexed to,
        uint256 value
    );

    event Deposit(
        address from,
        uint256 amount
    );

    event Transfer(
        address indexed from,
        address indexed to,
        uint256 amount
    );

    function initialize(
        uint8 _commissionRate,
        address _operatorAddress,
        bytes32 _operatorDataCommitment,
        bytes32 salt
    )
        external
        initializer
    {
        if (_commissionRate > COMMISSION_RATE_SCALE) { revert CommissionRateScaleExceeded(_commissionRate); }
        if (_commissionRate > (_commissionRate / COMMISSION_RATE_SCALE * 2)) { revert CommisionRateTooHigh(_commissionRate); }
        state = State.PreDeposit;
        commissionRate = _commissionRate;
        operatorAddress = _operatorAddress;
        operatorDataCommitment = _operatorDataCommitment;
        _salt = salt;
    }

    receive() payable external {
        if (state == State.PreDeposit) {
            revert("Plain Ether transfer not allowed");
        }
    }

    function setEthDepositContractAddress(address ethDepositContractAddress) 
        external
        onlyOperator
    {
        require(depositContractAddress == address(0), "Already set up ETH deposit contract address");
        depositContractAddress = ethDepositContractAddress;
    }

    function setTokenContractAddress(address _tokenContractAddress) 
        external
        onlyOperator
    {
        require(tokenContractAddress == address(0), "Already set up token contract address");
        tokenContractAddress = _tokenContractAddress;
    }

    function updateExitDate(uint64 newExitDate)
        external
        onlyOperator
    {
        require(
            state == State.PostDeposit,
            "Validator is not active"
        );

        require(
            newExitDate < exitDate,
            "Not earlier than the original value"
        );

        exitDate = newExitDate;
    }

    error notDepositor();

    function createValidator(
        bytes calldata validatorPubKey, // 48 bytes
        bytes calldata depositSignature, // 96 bytes
        bytes32 depositDataRoot,
        uint64 _exitDate
    )
        external
    {
        if (msg.sender != depositor) { revert notDepositor(); }
        require(state == State.PreDeposit, "Validator has been created");
        state = State.PostDeposit;

        require(validatorPubKey.length == 48, "Invalid validator public key");
        require(depositSignature.length == 96, "Invalid deposit signature");
        require(operatorDataCommitment == keccak256(
            abi.encodePacked(
                address(this),
                validatorPubKey,
                depositSignature,
                depositDataRoot,
                _exitDate
            )
        ), "Data doesn't match commitment");

        exitDate = _exitDate;

        IDepositContract(depositContractAddress).deposit{value: FULL_DEPOSIT_SIZE}(
            validatorPubKey,
            abi.encodePacked(uint96(0x010000000000000000000000), address(this)),
            depositSignature,
            depositDataRoot
        );

        ERC721Contract.SenseistakeERC721(tokenContractAddress).safeMint(msg.sender, _salt);

        emit ValidatorDeposited(validatorPubKey);
    }

    // function deposit()
    //     external
    //     payable
    // {
    //     require(
    //         state == State.PreDeposit,
    //         "Validator already created"
    //     );

    //     _handleDeposit(msg.sender);
    // }

    function depositFrom(address _depositor)
        external
        payable
    {
        require(
            state == State.PreDeposit,
            "Validator already created"
        );
        _handleDeposit(_depositor);
    }

    function endOperatorServices()
        external
    {
        uint256 balance = address(this).balance;
        require(balance > 0, "Can't end with 0 balance");
        require(state == State.PostDeposit, "Not allowed in the current state");
        require((msg.sender == operatorAddress && block.timestamp > exitDate) ||
                (deposits > 0 && block.timestamp > exitDate + MAX_SECONDS_IN_EXIT_QUEUE), "Not allowed at the current time");

        state = State.Withdrawn;

        if (balance > 32 ether) {
            uint256 profit = balance - 32 ether;
            uint256 finalCommission = profit * commissionRate / COMMISSION_RATE_SCALE;
            operatorClaimable += finalCommission;
        }

        emit ServiceEnd();
    }

    function operatorClaim()
        external
        onlyOperator
        returns (uint256)
    {
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

    function withdrawTo(
        address payable beneficiary
    )
        external
    {
        // callable only from senseistake erc721 contract
        if (msg.sender != tokenContractAddress) { revert notTokenContract(); }
        require(state != State.PostDeposit, WITHDRAWALS_NOT_ALLOWED);
        _executeWithdrawal(beneficiary, payable(beneficiary), FULL_DEPOSIT_SIZE);
    }

    function getWithdrawableAmount()
        external
        view
        returns (uint256)
    {
        if (state == State.PostDeposit) {
            return 0;
        }

        return address(this).balance - operatorClaimable;
    }

    function _executeWithdrawal(
        address _depositor,
        address payable beneficiary, 
        uint256 amount
    ) 
        internal
    {
        require(amount > 0, "Amount shouldn't be zero");

        deposits = 0;
        depositor = _depositor;

        emit Withdrawal(depositor, beneficiary, amount);
        beneficiary.sendValue(amount);

        if (state == State.Withdrawn) {
            ERC721Contract.SenseistakeERC721(tokenContractAddress).burn(_salt);
        }
    }

    error DepositedAmountLowerThanFullDeposit();

    function _handleDeposit(address _depositor)
        internal
    {
        if (msg.value < FULL_DEPOSIT_SIZE) { revert DepositedAmountLowerThanFullDeposit(); }
        
        uint256 surplus = (address(this).balance > 32 ether) ?
            (address(this).balance - 32 ether) : 0;

        uint256 acceptedDeposit = msg.value - surplus;

        deposits += acceptedDeposit;
        depositor = _depositor;
        
        emit Deposit(_depositor, acceptedDeposit);
        
        if (surplus > 0) {
            payable(_depositor).sendValue(surplus);
        }
    }

    function _transfer(
        address from,
        address to,
        uint256 amount
    )
        internal
    {
        require(to != address(0), "Transfer to the zero address");

        depositor = to;

        emit Transfer(from, to, amount);
    }

    function _min(
        uint256 a,
        uint256 b
    )
        internal
        pure
        returns (uint256)
    {
        return a < b ? a : b;
    }
}
