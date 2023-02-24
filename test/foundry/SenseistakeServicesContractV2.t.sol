pragma solidity 0.8.17;

import "forge-std/Test.sol";
import "forge-std/console.sol";
import {MockDepositContract} from "./MockDepositContract.sol";
import {SenseiStakeV2} from "../../contracts/SenseiStakeV2.sol";
import {SenseistakeServicesContractV2 as SenseistakeServicesContract} from
    "../../contracts/SenseistakeServicesContractV2.sol";
import {SenseiStake} from "../../contracts/SenseiStake.sol";
import {SenseistakeMetadata} from "../../contracts/SenseistakeMetadata.sol";

contract SenseistakeServicesContractV2Test is Test {
    address private alice;
    address private bob;
    SenseiStakeV2 private senseistakeV2;
    SenseiStake private senseistake;
    SenseistakeMetadata private metadata;
    MockDepositContract private depositContract;

    event OldValidatorRewardsClaimed(uint256 amount);
    event ValidatorMinted(uint256 tokenIdServiceContract);
    event Withdrawal(address indexed to, uint256 value);
    
    error CallerNotSenseiStake();
    

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
    }

}
