pragma solidity 0.8.17;

import "forge-std/Test.sol";
import "forge-std/console.sol";
import {MockDepositContract} from "./MockDepositContract.sol";
import {SenseiStakeV2} from "../../contracts/SenseiStakeV2.sol";
import {SenseistakeServicesContractV2 as SenseistakeServicesContract} from
    "../../contracts/SenseistakeServicesContractV2.sol";
import {SenseiStake} from "../../contracts/SenseiStake.sol";
import {SenseistakeMetadata} from "../../contracts/SenseistakeMetadata.sol";

contract SenseiStakeV2Test is Test {
    address private alice;
    address private bob;
    SenseiStakeV2 private senseistakeV2;
    SenseistakeMetadata private metadata;
    SenseiStake private senseistake;
    MockDepositContract private depositContract;

    event ValidatorVersionMigration(uint256 indexed oldTokenId, uint256 indexed newTokenId);
    event OldValidatorRewardsClaimed(uint256 amount);
    event Withdrawal(address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed approved, uint256 indexed tokenId);

    error NotAllowedAtCurrentTime();
    error CannotEndZeroBalance();
    error NotOwner();
    error NotEnoughBalance();

    function setUp() public {
        alice = makeAddr("alice");
        deal(alice, 100 ether);
        bob = makeAddr("bob");
        deal(bob, 100 ether);
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
            address(senseistake),
            address(metadata)
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
        vm.expectRevert(NotAllowedAtCurrentTime.selector);
        senseistake.safeTransferFrom(address(alice), address(senseistakeV2), tokenId);
        // senseistakeV2.versionMigration(tokenId);
        vm.stopPrank();
    }

    // should do nothing because not money in the service contract
    function testCannotMigrateOnZeroBalance() public {
        uint256 tokenId = 0;
        vm.startPrank(alice);
        senseistake.createContract{value: 32 ether}();
        tokenId += 1;
        vm.warp(360 days);
        vm.expectRevert(CannotEndZeroBalance.selector);
        senseistake.safeTransferFrom(address(alice), address(senseistakeV2), tokenId);
        // senseistakeV2.versionMigration(tokenId);
        vm.stopPrank();
    }

    function testMigrate() public {
        uint256 tokenId = 0;
        vm.startPrank(alice);
        senseistake.createContract{value: 32 ether}();
        vm.warp(360 days);
        tokenId += 1;
        deal(senseistake.getServiceContractAddress(tokenId), 100 ether);
        vm.expectEmit(true, false, false, false);
        emit OldValidatorRewardsClaimed((100 ether - 32 ether) * 0.1); // minus 10% of fee
        vm.expectEmit(true, true, false, false);
        emit ValidatorVersionMigration(tokenId, tokenId);
        senseistake.safeTransferFrom(address(alice), address(senseistakeV2), tokenId);
        bool isAliceOwner = senseistakeV2.isApprovedOrOwner(address(alice), tokenId);
        assertEq(isAliceOwner, true);
        vm.stopPrank();
    }

    function testMigrateAllowedOwner() public {
        uint256 tokenId = 0;

        vm.startPrank(alice);
        senseistake.createContract{value: 32 ether}();
        vm.warp(360 days);
        tokenId += 1;
        deal(senseistake.getServiceContractAddress(tokenId), 100 ether);
        // le damos aprove a bob
        vm.expectEmit(true, true, true, false);
        emit Approval(address(alice), address(bob), tokenId);
        senseistake.approve(address(bob), tokenId);
        vm.stopPrank();

        vm.startPrank(bob);
        vm.expectEmit(true, false, false, false);
        emit OldValidatorRewardsClaimed((100 ether - 32 ether) * 0.1); // minus 10% of fee
        vm.expectEmit(true, true, false, false);
        emit ValidatorVersionMigration(tokenId, tokenId);
        senseistake.safeTransferFrom(address(alice), address(senseistakeV2), tokenId);
        bool isAliceOwner = senseistakeV2.isApprovedOrOwner(address(alice), tokenId);
        assertEq(isAliceOwner, true);
        bool isBobOwner = senseistakeV2.isApprovedOrOwner(address(bob), tokenId);
        assertEq(isBobOwner, false);
        vm.stopPrank();
    }

    // should migrate validator from v1 to v2
    function testMigrateComplete() public {
        uint256 tokenId = 0;
        vm.startPrank(alice);
        senseistake.createContract{value: 32 ether}();
        vm.warp(360 days);
        tokenId += 1;
        deal(senseistake.getServiceContractAddress(tokenId), 100 ether);
        vm.expectEmit(true, false, false, false);
        emit OldValidatorRewardsClaimed((100 ether - 32 ether) * 0.1); // minus 10% of fee
        vm.expectEmit(true, true, false, false);
        emit ValidatorVersionMigration(tokenId, tokenId);
        senseistake.safeTransferFrom(address(alice), address(senseistakeV2), tokenId);
        // senseistakeV2.versionMigration(tokenId);
        vm.stopPrank();
    }

    // shouldn't 3rd person migrate validator from v1 to v2
    function testCannotCallMigrateUnknownUser() public {
        uint256 tokenId = 0;
        vm.startPrank(alice);
        senseistake.createContract{value: 32 ether}();
        vm.warp(360 days);
        tokenId += 1;
        deal(senseistake.getServiceContractAddress(tokenId), 100 ether);
        vm.stopPrank();

        vm.startPrank(bob);
        vm.expectRevert(bytes("ERC721: caller is not token owner or approved"));
        senseistake.safeTransferFrom(address(alice), address(senseistakeV2), tokenId);
        vm.stopPrank();
    }

    // shouldn't migrate a unknown tokenid of validator from v1 to v2
    function testCannotVersionMigrationWithTokenIndexUnknown() public {
        uint256 tokenId = 0;
        vm.startPrank(alice);
        senseistake.createContract{value: 32 ether}();
        vm.warp(360 days);
        tokenId += 1;
        deal(senseistake.getServiceContractAddress(tokenId), 100 ether);
        vm.expectRevert(bytes("ERC721: invalid token ID"));
        senseistake.safeTransferFrom(address(alice), address(senseistakeV2), tokenId + 5);
        vm.stopPrank();
    }
}
