pragma solidity 0.8.17;

import "forge-std/Test.sol";
import "forge-std/console.sol";
import {MockDepositContract} from "./MockDepositContract.sol";
import {SenseiStakeV2} from "../../contracts/SenseiStakeV2.sol";
import {SenseistakeServicesContractV2 as SenseistakeServicesContract} from
    "../../contracts/SenseistakeServicesContractV2.sol";
import {SenseiStake} from "../../contracts/SenseiStake.sol";
import {SenseistakeMetadata} from "../../contracts/SenseistakeMetadata.sol";

contract MintValidatorTest is Test {
    address private alice;
    SenseiStakeV2 private senseistakeV2;
    SenseiStake private senseistake;
    SenseistakeMetadata private metadata;
    MockDepositContract private depositContract;

    event ValidatorVersionMigration(uint256 indexed oldTokenId, uint256 indexed newTokenId);
    event OldValidatorRewardsClaimed(uint256 amount);
    event Withdrawal(address indexed to, uint256 value);

    error NoMoreValidatorsLoaded();

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
            address(senseistake),
            address(metadata)
        );
    }

    // should fail because there isn't more validator available
    function testCannotMintValidatorIfNoValidatorAvaliable() public {
        vm.startPrank(alice);
        vm.expectRevert(NoMoreValidatorsLoaded.selector);
        senseistakeV2.mintValidator{value: 32 ether}();
        vm.stopPrank();
    }
}
