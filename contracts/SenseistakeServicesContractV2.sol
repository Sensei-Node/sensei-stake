// SPDX-License-Identifier: MIT
pragma solidity >=0.8.17;

import {Address} from "@openzeppelin/contracts/utils/Address.sol";
import {Initializable} from "@openzeppelin/contracts/proxy/utils/Initializable.sol";
import {IDepositContract} from "./interfaces/IDepositContract.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {SenseiStakeV2} from "./SenseiStakeV2.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/// @title A Service contract for handling SenseiStake Validators
/// @author Senseinode
/// @notice A service contract is where the deposits of a client are managed and all validator related tasks are performed. The ERC721 contract is the entrypoint for a client deposit, from there it is separeted into 32ETH chunks and then sent to different service contracts.
/// @dev This contract is the implementation for the proxy factory clones that are made on ERC721 contract function (createContract) (an open zeppelin solution to create the same contract multiple times with gas optimization). The openzeppelin lib: https://docs.openzeppelin.com/contracts/4.x/api/proxy#Clone
contract SenseistakeServicesContractV2 is Initializable {
    using Address for address payable;

    /// @notice Used in conjuction with `COMMISSION_RATE_SCALE` for determining service fees
    /// @dev Is set up on the constructor and can be modified with provided setter aswell
    /// @return commissionRate the commission rate
    uint32 public commissionRate;

    /// @notice Used for determining when a validator has ended (balance withdrawn from service contract too)
    /// @return exitedAt block timestamp at which the user has withdrawn all from validator
    uint64 public exitedAt;

    /// @notice Used for determining when the service contract was created
    /// @return createdAt block timestamp at which the contract was created
    uint64 public createdAt;

    /// @notice Scale for getting the commission rate (service fee)
    uint32 private constant COMMISSION_RATE_SCALE = 1_000_000;

    /// @notice The address for being able to deposit to the ethereum deposit contract
    /// @return depositContractAddress deposit contract address
    address public depositContractAddress;

    /// @notice The address of the GNO token contract
    address public gnoContractAddress;

    /// @notice The amount of eth the operator can claim
    /// @return state the operator claimable amount (in eth)
    uint256 public operatorClaimable;

    /// @notice The address of Senseistakes ERC721 contract address
    /// @return tokenContractAddress the token contract address (erc721)
    address public tokenContractAddress;

    /// @notice The tokenId used to create this contract using the proxy clone
    /// @return tokenId of the NFT related to the service contract
    uint256 public tokenId;

    /// @notice The amount of eth in wei that owner has withdrawn
    /// @return withdrawnAmount amount withdrawn by owner given that ETH validator withdrawals are available after shanghai
    uint256 public withdrawnAmount;

    /// @notice Fixed amount of the deposit
    uint256 private constant FULL_DEPOSIT_SIZE = 1 ether;

    event Claim(address indexed receiver, uint256 amount);
    event Withdrawal(address indexed to, uint256 value);

    error CallerNotAllowed();
    error EmptyClaimableForOperator();
    error NotOperator();

    /// @notice Only the operator access.
    modifier onlyOperator() {
        if (msg.sender != Ownable(tokenContractAddress).owner()) {
            revert NotOperator();
        }
        _;
    }

    /// @notice Initializes the contract and creates validator
    /// @dev Sets the commission rate, the operator address, operator data commitment, the tokenId and creates the validator
    /// @param commissionRate_  The service commission rate
    /// @param tokenId_ The token id that is used
    /// @param ethDepositContractAddress_ The ethereum deposit contract address for validator creation
    function initialize(
        uint32 commissionRate_,
        uint256 tokenId_,
        address ethDepositContractAddress_
    ) external initializer {
        commissionRate = commissionRate_;
        tokenId = tokenId_;
        tokenContractAddress = msg.sender;
        gnoContractAddress = SenseiStakeV2(tokenContractAddress)
            .gnoContractAddress();
        depositContractAddress = ethDepositContractAddress_;
        createdAt = uint64(block.timestamp);
    }

    /// @notice Transfers to operator the claimable amount of eth
    function operatorClaim() external onlyOperator {
        if (operatorClaimable == 0) {
            revert EmptyClaimableForOperator();
        }
        uint256 claimable = operatorClaimable;
        operatorClaimable = 0;
        address _owner = Ownable(tokenContractAddress).owner();
        emit Claim(_owner, claimable);
        IERC20(gnoContractAddress).transfer(_owner, claimable);
    }

    /// @notice Withdraw the deposit to a beneficiary
    /// @param beneficiary_ Who will receive the deposit
    function withdrawTo(address beneficiary_) external {
        // callable only from senseistake erc721 contract
        if (msg.sender != tokenContractAddress) {
            revert CallerNotAllowed();
        }
        uint256 balance = IERC20(gnoContractAddress).balanceOf(address(this));
        if ((balance + withdrawnAmount) >= FULL_DEPOSIT_SIZE) {
            unchecked {
                uint256 profit = balance + withdrawnAmount - FULL_DEPOSIT_SIZE;
                operatorClaimable =
                    (profit * commissionRate) /
                    COMMISSION_RATE_SCALE;
            }
            exitedAt = uint64(block.timestamp);
        }
        uint256 amount = balance - operatorClaimable;
        withdrawnAmount += amount;
        emit Withdrawal(beneficiary_, amount);
        IERC20(gnoContractAddress).transfer(beneficiary_, amount);
    }

    /// @notice Get withdrawable amount of a user
    /// @return amount the depositor is allowed withdraw
    function getWithdrawableAmount() external view returns (uint256) {
        uint256 balance = IERC20(gnoContractAddress).balanceOf(address(this));
        return balance - operatorClaimable;
    }
}
