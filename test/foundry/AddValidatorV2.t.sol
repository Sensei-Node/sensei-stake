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

    error TokenIdAlreadyMinted();
    error InvalidPublicKey();
    error InvalidDepositSignature();
    error ValidatorAlreadyAdded();

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
    }

    // shouldn't add existing tokenId validator
    function testCannotExistTokenId() public {
        senseistake.addValidator(1, new bytes(48), new bytes(96), bytes32(0));
        senseistakeV2.addValidator(1, new bytes(48), new bytes(96), bytes32(0));
        uint256 tokenId = 0;
        vm.startPrank(alice);
        senseistake.createContract{value: 32 ether}();
        tokenId += 1;
        deal(senseistake.getServiceContractAddress(tokenId), 100 ether);
        vm.warp(360 days);
        senseistake.safeTransferFrom(address(alice), address(senseistakeV2), tokenId);
        vm.stopPrank();
        vm.expectRevert(TokenIdAlreadyMinted.selector);
        senseistakeV2.addValidator(1, new bytes(48), new bytes(96), bytes32(0));
    }

    // shouldn't add existing pubkey
    function testCannotExistValidator() public {
        senseistakeV2.addValidator(1, new bytes(48), new bytes(96), bytes32(0));
        vm.expectRevert(ValidatorAlreadyAdded.selector);
        senseistakeV2.addValidator(1, new bytes(48), new bytes(96), bytes32(0));
    }

    // shouldn't add invalid pub key
    function testCannotInvalidPublicKey() public {
        vm.expectRevert(InvalidPublicKey.selector);
        senseistakeV2.addValidator(1, new bytes(49), new bytes(96), bytes32(0));
    }


    // shouldn't add invalid pub key
    function testCannotInvalidDepositSignature() public {
        vm.expectRevert(InvalidDepositSignature.selector);
        senseistakeV2.addValidator(1, new bytes(48), new bytes(97), bytes32(0));
    }

    
    
}