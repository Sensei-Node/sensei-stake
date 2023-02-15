pragma solidity 0.8.17;

import "forge-std/Test.sol";
import "forge-std/console.sol";
import {MockDepositContract} from "./MockDepositContract.sol";
import {SenseiStakeV2} from "../../contracts/SenseiStakeV2.sol";
import {SenseiStake} from "../../contracts/SenseiStake.sol";

contract SenseiStakeTest is Test {
    address private alice;
    SenseiStakeV2 private senseistakeV2;
    SenseiStake private senseistake;
    MockDepositContract private depositContract;

    function setUp() public {
        alice = makeAddr("alice");
        emit log_address(alice);
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
        senseistake.addValidator(
            1,
            new bytes(48),
            new bytes(96),
            bytes32(0)
        );

        senseistakeV2.addValidator(
            1,
            new bytes(48),
            new bytes(96),
            bytes32(0)
        );
        
    }

    function testMint() public {
        assertEq(senseistake.tokenIdCounter(), 0);
        vm.startPrank(alice);
        senseistake.createContract{value: 32 ether}();
        vm.stopPrank();
        assertEq(senseistake.tokenIdCounter(), 1);
    }

    function testFailMigrate() public {
        uint256 tokenId = 0;
        vm.startPrank(alice);
        senseistake.createContract{value: 32 ether}();
        senseistake.safeTransferFrom(address(alice), address(senseistakeV2), tokenId + 1 );
        senseistakeV2.versionMigration(tokenId + 1);
        vm.stopPrank();
    }

    function testMigrate() public {
        uint256 tokenId = 0;
        vm.startPrank(alice);
        console.log(block.timestamp);
        senseistake.createContract{value: 32 ether}();
        vm.warp(360 days);
        tokenId += 1;
        senseistake.safeTransferFrom(address(alice), address(senseistakeV2), tokenId );
        deal(senseistake.getServiceContractAddress(tokenId), 100 ether);
        uint256 salida = senseistakeV2.versionMigration(tokenId);
        vm.stopPrank();
    }
}
