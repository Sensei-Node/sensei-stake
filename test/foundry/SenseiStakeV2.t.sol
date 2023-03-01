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
    SenseiStake private senseistake;
    SenseistakeMetadata private metadata;
    MockDepositContract private depositContract;

    event OldValidatorRewardsClaimed(uint256 amount);
    event ValidatorMinted(uint256 tokenIdServiceContract);
    event Withdrawal(address indexed to, uint256 value);
    event MetadataAddressChanged(address newAddress);

    error CallerNotSenseiStake();
    error CannotEndZeroBalance();
    error InvalidMigrationRecepient();
    error NoMoreValidatorsLoaded();
    error NotAllowedAtCurrentTime();
    error NotOwner();
    error ValueSentDifferentThanFullDeposit();
    error NotSenseistakeMetadata();

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
        senseistakeV2.tokenURI(tokenId);
    }

    function testMintedAndExitedAt() public {
        vm.startPrank(alice);
        uint256 tokenId = senseistakeV2.mintValidator{value: 32 ether}();
        address scaddr = senseistakeV2.getServiceContractAddress(tokenId);
        SenseistakeServicesContract sscc = SenseistakeServicesContract(payable(scaddr));
        deal(senseistakeV2.getServiceContractAddress(tokenId), 32 ether);
        assertEq(sscc.createdAt(), block.timestamp); // minted at this block.timestamp
        vm.warp(1 days);
        senseistakeV2.withdraw(tokenId);
        assertEq(sscc.exitedAt(), block.timestamp); // exited at this block.timestamp
        vm.stopPrank();
    }

    //should not mint a validator with no eth
    function testCannotMintMultipleValidatorsValueSentDifferentThanFullDeposit() public {
        vm.startPrank(alice);
        vm.expectRevert(ValueSentDifferentThanFullDeposit.selector);
        senseistakeV2.mintMultipleValidators{value: 1 ether}();
        vm.stopPrank();
    }

    function testMintMultipleValidatorsNoMoreValidatorLoaded() public {
        vm.startPrank(alice);
        vm.expectRevert(NoMoreValidatorsLoaded.selector);
        senseistakeV2.mintMultipleValidators{value: 64 ether}();
        vm.stopPrank();
    }

    function testMintMultipleValidatorsJustOne() public {
        vm.startPrank(alice);
        vm.expectEmit(true, false, false, false);
        emit ValidatorMinted(1);
        senseistakeV2.mintMultipleValidators{value: 32 ether}();
        vm.stopPrank();
    }

    function testMintMultipleValidators1000Validators() public {
        uint256 validators_count = 1000;
        deal(alice, validators_count * 32 ether);
        for (uint256 i = 1; i <= validators_count; i++) {
            senseistakeV2.addValidator(i, abi.encodePacked(new bytes(16), i), new bytes(96), bytes32(0));
        }
        vm.startPrank(alice);
        for (uint256 i = 1; i <= validators_count; i++) {
            vm.expectEmit(true, false, false, false);
            emit ValidatorMinted(i);
        }
        senseistakeV2.mintMultipleValidators{value: validators_count * 32 ether}();
        vm.stopPrank();
    }

    function testTokenUri() public {
        vm.startPrank(alice);
        vm.expectEmit(true, false, false, false);
        emit ValidatorMinted(1);
        senseistakeV2.mintValidator{value: 32 ether}();
        vm.stopPrank();
        senseistakeV2.tokenURI(1);
    }

    function testCannotMint() public {
        vm.startPrank(alice);
        vm.expectRevert(ValueSentDifferentThanFullDeposit.selector);
        senseistakeV2.mintValidator{value: 1 ether}();
        vm.stopPrank();
    }

    function testCannotMintToNoEnaughEth() public {
        vm.startPrank(alice);
        vm.expectRevert(ValueSentDifferentThanFullDeposit.selector);
        senseistakeV2.mintValidatorTo{value: 1 ether}(bob);
        vm.stopPrank();
    }

    function testMintValidatorTo() public {
        vm.startPrank(alice);
        vm.expectEmit(true, false, false, false);
        emit ValidatorMinted(1);
        senseistakeV2.mintValidatorTo{value: 32 ether}(address(bob));
        vm.stopPrank();
    }

    function testCannotMintValidatorTo() public {
        vm.startPrank(alice);
        vm.expectEmit(true, false, false, false);
        emit ValidatorMinted(1);
        senseistakeV2.mintValidatorTo{value: 32 ether}(address(bob));
        vm.expectRevert(NoMoreValidatorsLoaded.selector);
        senseistakeV2.mintValidatorTo{value: 32 ether}(address(bob));
        vm.stopPrank();
    }

    //onERC721Received
    function testCannotonERC721Received_CallerNotSenseiStake() public {
        vm.startPrank(alice);
        vm.expectRevert(CallerNotSenseiStake.selector);
        senseistakeV2.onERC721Received(address(alice), address(alice), 1, "");
        vm.stopPrank();
    }

    // si un contrato mintea un NFT y pone como destinatario SenseiStake
    function testCannotOnERC721Received_CallerNotSenseiStake() public {
        SenseiStakeV2 anotherSenseistake = new SenseiStakeV2(
            "SenseiStake Ethereum Validato HACK",
            "SSEV_HACK",
            100_000,
            address(depositContract),
            address(senseistake),
            address(metadata)
        );
        anotherSenseistake.addValidator(1, new bytes(48), new bytes(96), bytes32(0));
        // alicia mintea en el contrato FAKE y le pone como destinatario al ORIGINAL
        vm.startPrank(alice);
        vm.expectRevert(CallerNotSenseiStake.selector);
        anotherSenseistake.mintValidatorTo{value: 32 ether}(address(senseistakeV2));
        vm.stopPrank();
    }

    function testCannotWitdraw_NotOwner() public {
        vm.startPrank(alice);
        vm.expectEmit(true, false, false, false);
        emit ValidatorMinted(1);
        senseistakeV2.mintValidator{value: 32 ether}();
        vm.stopPrank();
        vm.startPrank(bob);
        vm.expectRevert(NotOwner.selector);
        senseistakeV2.withdraw(1);
        vm.stopPrank();
    }

    function testValidatorAvailable() public {
        bool validatorAvailable = senseistakeV2.validatorAvailable();
        assertTrue(validatorAvailable);
    }

    function testMetadataContractChanged() public {
        SenseistakeMetadata newMetadata = new SenseistakeMetadata();
        vm.expectEmit(true, false, false, false);
        emit MetadataAddressChanged(address(newMetadata));
        senseistakeV2.setMetadataAddress(address(newMetadata));
    }
}
