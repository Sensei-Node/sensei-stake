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

    event ValidatorVersionMigration(uint256 indexed oldTokenId, uint256 indexed newTokenId);
    event OldValidatorRewardsClaimed(uint256 amount);
    event Withdrawal(address indexed to, uint256 value);

    error NotAllowedAtCurrentTime();
    error CannotEndZeroBalance();

    function setUp() public {
        alice = makeAddr("alice");
        deal(alice, 100 ether);
        depositContract = new MockDepositContract();
        senseistake = new SenseiStake(
            "SenseiStake Ethereum Validator",
            "SSEV",
            100_000,
            address(depositContract)
        );
        senseistakeV2 = new SenseiStakeV2(
            "SenseiStake Ethereum Validator",
            "SSEV",
            100_000,
            address(depositContract),
            address(senseistake)
        );
        senseistake.addValidator(1, new bytes(48), new bytes(96), bytes32(0));
        senseistakeV2.addValidator(1, new bytes(48), new bytes(96), bytes32(0));
    }

    // should fail because exit date not elapsed
    function testCannotMigrateOnCurrentExitDate() public {
        uint256 tokenId = 0;
        vm.startPrank(alice);
        senseistake.createContract{value: 32 ether}();
        tokenId += 1;
        senseistake.safeTransferFrom(address(alice), address(senseistakeV2), tokenId);
        vm.expectRevert(NotAllowedAtCurrentTime.selector);
        senseistakeV2.versionMigration(tokenId);
        vm.stopPrank();
    }

    // should do nothing because not money in the service contract
    function testCannotMigrateOnZeroBalance() public {
        uint256 tokenId = 0;
        vm.startPrank(alice);
        senseistake.createContract{value: 32 ether}();
        tokenId += 1;
        senseistake.safeTransferFrom(address(alice), address(senseistakeV2), tokenId);
        vm.warp(360 days);
        vm.expectRevert(CannotEndZeroBalance.selector);
        senseistakeV2.versionMigration(tokenId);
        vm.stopPrank();
    }

    // should migrate validator from v1 to v2
    function testMigrateComplete() public {
        uint256 tokenId = 0;
        vm.startPrank(alice);
        senseistake.createContract{value: 32 ether}();
        vm.warp(360 days);
        tokenId += 1;
        senseistake.safeTransferFrom(address(alice), address(senseistakeV2), tokenId);
        deal(senseistake.getServiceContractAddress(tokenId), 100 ether);
        vm.expectEmit(true, false, false, false);
        emit OldValidatorRewardsClaimed((100 ether - 32 ether) * 0.1); // minus 10% of fee
        vm.expectEmit(true, true, false, false);
        emit ValidatorVersionMigration(tokenId, tokenId);
        senseistakeV2.versionMigration(tokenId);
        vm.stopPrank();
    }
}
