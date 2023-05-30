pragma solidity 0.8.17;

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
        deal(alice, 100 ether);

        depositContract = new MockDepositContract();
        senseistake = new SenseiStake(
            "SenseiStake Ethereum Validator",
            "SSEV",
            100_000,
            address(depositContract)
        );
    }

    function testCreateContract() public {
        senseistake.addValidator(
            1,
            new bytes(48),
            new bytes(96),
            bytes32(0)
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
            bytes32(0)
        );
        vm.startPrank(alice);
        senseistake.createContract{value: 32 ether}();
        vm.stopPrank();
    }
}
