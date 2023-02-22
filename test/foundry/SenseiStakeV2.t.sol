pragma solidity 0.8.17;

import "forge-std/Test.sol";
import "forge-std/console.sol";
import {MockDepositContract} from "./MockDepositContract.sol";
import {SenseiStakeV2} from "../../contracts/SenseiStakeV2.sol";
import {SenseistakeServicesContractV2 as SenseistakeServicesContract} from
    "../../contracts/SenseistakeServicesContractV2.sol";
import {SenseiStake} from "../../contracts/SenseiStake.sol";

contract SenseiStakeV2Test is Test {
    address private alice;
    SenseiStakeV2 private senseistakeV2;
    SenseiStake private senseistake;
    MockDepositContract private depositContract;

    event OldValidatorRewardsClaimed(uint256 amount);
    event Withdrawal(address indexed to, uint256 value);

    error NotAllowedAtCurrentTime();
    error CannotEndZeroBalance();

    function setUp() public {
        alice = makeAddr("alice");
        deal(alice, 100 ether);
        depositContract = new MockDepositContract();
        senseistakeV2 = new SenseiStakeV2(
            "SenseiStake Ethereum Validator",
            "SSEV",
            100_000,
            address(depositContract),
            address(senseistake)
        );
        senseistakeV2.addValidator(1, new bytes(48), new bytes(96), bytes32(0));
    }

    // test completo minteo, retiros parciales, retiro total
    function testMintWithdrawComplete() public {
        vm.startPrank(alice);
        uint256 tokenId = senseistakeV2.mintValidator{value: 32 ether}();

        vm.warp(1 days); // let pass 1 day just for fun

        // simulamos validator rewards income
        deal(senseistakeV2.getServiceContractAddress(tokenId), 0.132 ether);

        // partial withdraw
        vm.expectEmit(true, true, false, false);
        emit Withdrawal(address(alice), 0.132 ether);
        senseistakeV2.withdraw(tokenId);

        // simulamos validator rewards income
        deal(senseistakeV2.getServiceContractAddress(tokenId), 0.32132 ether);

        // total withdraw after some more time (not that it even does something)
        vm.warp(29 days);

        // simulamos que terminamos el validador y nos devielve 32 + un poquito de rewards
        deal(senseistakeV2.getServiceContractAddress(tokenId), 32.0132 ether);

        // complete withdraw
        address sc_addr = senseistakeV2.getServiceContractAddress(tokenId);
        SenseistakeServicesContract servicecontract = SenseistakeServicesContract(payable(sc_addr));
        uint256 claimable = servicecontract.getWithdrawableAmount();

        // total withdraw
        vm.expectEmit(true, true, false, false);
        emit Withdrawal(address(alice), claimable);
        senseistakeV2.withdraw(tokenId);
        vm.stopPrank();

        vm.startPrank(alice);
        // check that service contract exited == true
        uint256 exitedAt = servicecontract.exitedAt();
        assertGt(exitedAt, 0);
        vm.stopPrank();
    }

    function testMintedAndExitedAt() public {
        vm.startPrank(alice);
        uint256 tokenId = senseistakeV2.mintValidator{value: 32 ether}();
        address scaddr = senseistakeV2.getServiceContractAddress(tokenId);
        SenseistakeServicesContract sscc = SenseistakeServicesContract(payable(scaddr));
        deal(senseistakeV2.getServiceContractAddress(tokenId), 33 ether);
        assertEq(sscc.createdAt(), block.timestamp); // minted at this block.timestamp
        vm.warp(1 days);
        senseistakeV2.withdraw(tokenId);
        assertEq(sscc.exitedAt(), block.timestamp); // exited at this block.timestamp
        vm.stopPrank();
    }
}
