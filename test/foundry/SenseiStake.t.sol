pragma solidity 0.8.4;

import "forge-std/Test.sol";
import "forge-std/console.sol";
import {MockDepositContract} from "./MockDepositContract.sol";
import {SenseiStake} from "../../contracts/SenseiStake.sol";

contract SenseiStakeTest is Test {
    address private alice;
    SenseiStake private senseistake;
    MockDepositContract private depositContract;

    function setUp() public {
        alice = makeAddr("alice");
        emit log_address(alice);
        deal(alice, 100 ether);

        depositContract = new MockDepositContract();
        senseistake = new SenseiStake(
            "SENSEI",
            "SNSV",
            100_000,
            address(depositContract)
        );
    }

    function testCreateContract() public {
        senseistake.addValidator(
            1,
            new bytes(48),
            new bytes(96),
            bytes32(0),
            uint64(block.timestamp + 2 days)
        );
        vm.startPrank(alice);
        senseistake.createContract{value: 32 ether}();
        vm.stopPrank();
    }

    function test() public {
        senseistake.addValidator(
            1,
            new bytes(48),
            new bytes(96),
            bytes32(0),
            uint64(block.timestamp + 2 days)
        );
        vm.startPrank(alice);
        senseistake.createContract{value: 32 ether}();
        vm.stopPrank();
    }
}
