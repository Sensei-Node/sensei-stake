pragma solidity 0.8.17;

import "forge-std/Test.sol";
import "forge-std/console.sol";
import {MockDepositContract} from "./MockDepositContract.sol";
import {SenseiStakeV2} from "../../contracts/SenseiStakeV2.sol";
import {SenseistakeServicesContractV2 as SenseistakeServicesContract} from
    "../../contracts/SenseistakeServicesContractV2.sol";
import {SenseiStake} from "../../contracts/SenseiStake.sol";
import {SenseistakeMetadata} from "../../contracts/SenseistakeMetadata.sol";
import {ServiceTransactions} from "../../contracts/ServiceTransactions.sol";

contract SenseistakeServicesContractV2Test is Test, ServiceTransactions {
    address private alice;
    address private bob;
    SenseiStakeV2 private senseistakeV2;
    SenseiStake private senseistake;
    SenseistakeMetadata private metadata;
    MockDepositContract private depositContract;

    uint256 tokenId;
    SenseistakeServicesContract sscc;

    event OldValidatorRewardsClaimed(uint256 amount);
    event ValidatorMinted(uint256 tokenIdServiceContract);
    event Withdrawal(address indexed to, uint256 value);
    event Whitelisted(address);

    error CallerNotSenseiStake();
    error CallerNotAllowed();
    error NotOperator();
    error EmptyClaimableForOperator();

    receive() external payable {}

    function setUp() public {
        alice = makeAddr("alice");
        deal(alice, 100 ether);
        bob = makeAddr("bob");
        depositContract = new MockDepositContract();
        metadata = new SenseistakeMetadata();
        senseistakeV2 = new SenseiStakeV2(
            "SenseiStake Ethereum Validator",
            "SSEV",
            100_000,
            address(depositContract),
            address(senseistake),
            address(metadata)
        );
        senseistakeV2.addValidator(1, new bytes(48), new bytes(96), bytes32(0));

        vm.startPrank(alice);
        tokenId = senseistakeV2.mintValidator{value: 32 ether}();
        vm.stopPrank();

        address sscc_addr = senseistakeV2.getServiceContractAddress(tokenId);
        sscc = SenseistakeServicesContract(payable(sscc_addr));
    }

    function testCannotWithdraw(address caller) public {
        vm.startPrank(caller);
        vm.expectRevert(CallerNotAllowed.selector);
        sscc.withdrawTo(caller);
        vm.stopPrank();
    }

    function testOperatorClaim() public {
        deal(address(sscc), 33 ether);

        vm.startPrank(alice);
        vm.expectEmit(true, false, false, false);
        emit Withdrawal(address(alice), 0.1 ether);
        senseistakeV2.withdraw(tokenId);
        vm.stopPrank();

        sscc.operatorClaim();
    }

    function testOperatorClaim_NotOperator(address caller) public {
        deal(address(sscc), 33 ether);

        vm.startPrank(alice);
        vm.expectEmit(true, false, false, false);
        emit Withdrawal(address(alice), 0.1 ether);
        senseistakeV2.withdraw(tokenId);
        vm.stopPrank();

        vm.startPrank(caller);
        vm.expectRevert(NotOperator.selector);
        sscc.operatorClaim();
        vm.stopPrank();
    }

    function testCannotOperatorClaim_EmptyClaimable() public {
        deal(address(sscc), 33 ether);
        vm.expectRevert(EmptyClaimableForOperator.selector);
        sscc.operatorClaim();
    }

    // only owner function
    function testSubmitTransaction() public {
        Operation memory transaction =
            Operation(address(depositContract), 0, abi.encodeWithSignature("whitelist(address)", alice));
        vm.expectEmit(true, true, false, false);
        emit SubmitTransaction(1, "Testing Get Depositor Address");
        sscc.submitTransaction(transaction, "Testing Get Depositor Address");
    }

    // if called by another user that is not contract
    function testCannotSubmitTransaction(address caller) public {
        vm.startPrank(caller);
        Operation memory transaction =
            Operation(address(depositContract), 0, abi.encodeWithSignature("whitelist(address)", alice));
        vm.expectRevert(NotOperator.selector);
        sscc.submitTransaction(transaction, "Testing Get Depositor Address");
        vm.stopPrank();
    }

    // the NFT owner can confirm the transaction
    function testConfirmTransaction() public {
        Operation memory transaction =
            Operation(address(depositContract), 0, abi.encodeWithSignature("whitelist(address)", alice));
        vm.expectEmit(true, true, false, false);
        emit SubmitTransaction(1, "Testing Get Depositor Address");
        sscc.submitTransaction(transaction, "Testing Get Depositor Address");

        vm.startPrank(alice);
        vm.expectEmit(true, false, false, false);
        emit ConfirmTransaction(0);
        sscc.confirmTransaction(0);
        vm.stopPrank();
    }

    // other callers should not be able to confirm transaction
    function testCannotConfirmTransaction(address caller) public {
        Operation memory transaction =
            Operation(address(depositContract), 0, abi.encodeWithSignature("whitelist(address)", alice));
        vm.expectEmit(true, true, false, false);
        emit SubmitTransaction(1, "Testing Get Depositor Address");
        sscc.submitTransaction(transaction, "Testing Get Depositor Address");

        vm.assume(caller != address(0));
        vm.startPrank(caller);
        vm.expectRevert(CallerNotAllowed.selector);
        sscc.confirmTransaction(0);
        vm.stopPrank();
    }

    // only the operator can execute transaction confirmed by user
    function testExecuteTransaction() public {
        Operation memory transaction =
            Operation(address(depositContract), 0, abi.encodeWithSignature("whitelisted(address)", alice));
        vm.expectEmit(true, true, false, false);
        emit SubmitTransaction(1, "Testing Get Depositor Address");
        sscc.submitTransaction(transaction, "Testing Get Depositor Address");

        vm.startPrank(alice);
        vm.expectEmit(true, false, false, false);
        emit ConfirmTransaction(0);
        sscc.confirmTransaction(0);
        vm.stopPrank();

        vm.expectEmit(true, false, false, false);
        emit ExecuteTransaction(0);
        sscc.executeTransaction(0);
    }

    // only the operator can execute transaction confirmed by user
    // ! esto es un problema donde hay un check de segundo nivel al caller, va a fallar, siempre
    function testCannotExecuteTransaction() public {
        Operation memory transaction =
            Operation(address(depositContract), 0, abi.encodeWithSignature("whitelist(address)", alice));
        vm.expectEmit(true, true, false, false);
        emit SubmitTransaction(1, "Testing Get Depositor Address");
        sscc.submitTransaction(transaction, "Testing Get Depositor Address");

        vm.startPrank(alice);
        vm.expectEmit(true, false, false, false);
        emit ConfirmTransaction(0);
        sscc.confirmTransaction(0);
        vm.stopPrank();

        vm.expectRevert(TransactionCallFailed.selector);
        sscc.executeTransaction(0);
    }

    // only the operator can execute transaction confirmed by user
    function testCancelTransaction() public {
        Operation memory transaction =
            Operation(address(depositContract), 0, abi.encodeWithSignature("whitelist(address)", alice));
        vm.expectEmit(true, true, false, false);
        emit SubmitTransaction(1, "Testing Get Depositor Address");
        sscc.submitTransaction(transaction, "Testing Get Depositor Address");

        // vm.startPrank(alice);
        // vm.expectEmit(true, false, false, false);
        // emit ConfirmTransaction(0);
        // sscc.confirmTransaction(0);
        // vm.stopPrank();

        vm.expectEmit(true, false, false, false);
        emit CancelTransaction(0);
        sscc.cancelTransaction(0);
    }

    // only the operator can execute transaction confirmed by user
    // ! esto es un problema donde hay un check de segundo nivel al caller, va a fallar, siempre
    function testCannotCancelTransaction_AlreadyExecuted() public {
        Operation memory transaction =
            Operation(address(depositContract), 0, abi.encodeWithSignature("whitelisted(address)", alice));
        vm.expectEmit(true, true, false, false);
        emit SubmitTransaction(1, "Testing Get Depositor Address");
        sscc.submitTransaction(transaction, "Testing Get Depositor Address");

        vm.startPrank(alice);
        vm.expectEmit(true, false, false, false);
        emit ConfirmTransaction(0);
        sscc.confirmTransaction(0);
        vm.stopPrank();

        vm.expectEmit(true, false, false, false);
        emit ExecuteTransaction(0);
        sscc.executeTransaction(0);

        vm.expectRevert(TransactionAlreadyExecuted.selector);
        sscc.cancelTransaction(0);
    }
}
