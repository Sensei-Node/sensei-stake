pragma solidity 0.8.17;

import "forge-std/Test.sol";
import "forge-std/console.sol";
import {DepositContract} from "../../contracts/mock/DepositContract.sol";
import {SenseiStakeV2} from "../../contracts/SenseiStakeV2.sol";
import {SenseistakeServicesContractV2 as SenseistakeServicesContract} from
    "../../contracts/SenseistakeServicesContractV2.sol";
import {SenseiStake} from "../../contracts/SenseiStake.sol";
import {SenseistakeMetadata} from "../../contracts/SenseistakeMetadata.sol";
import {GNOContract} from "../../contracts/mock/GNOContract.sol";

contract SenseiStakeGnosisTest is Test {
    address private alice;
    address private bob;
    SenseiStakeV2 private senseistakeV2;
    GNOContract private gnoContract;
    SenseistakeMetadata private metadata;
    DepositContract private depositContract;

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
        gnoContract = new GNOContract("Gnosis Token", "GNO");
        gnoContract.mint(alice, 2 ether);
        depositContract = new DepositContract(address(gnoContract));
        metadata = new SenseistakeMetadata();
        senseistakeV2 = new SenseiStakeV2(
            "SenseiStake Gnosis Validator",
            "SSGV",
            100_000,
            address(depositContract),
            address(metadata),
            address(gnoContract)
        );

        // token id, public key, deposit signature, deposit data root
        senseistakeV2.addValidator(1, new bytes(48), new bytes(96), bytes32(0));
    }

    // test completo minteo, retiros parciales, retiro total
    function testMintCompleteGnosis() public {
        vm.startPrank(alice);
        gnoContract.approve(address(senseistakeV2), 1 ether);
        senseistakeV2.mintValidators(1 ether, alice);

        // vm.warp(1 days); // let pass 1 day just for fun

        // // simulamos validator rewards income
        // deal(senseistakeV2.getServiceContractAddress(tokenId), 0.132 ether);

        // // partial withdraw
        // vm.expectEmit(true, true, false, false);
        // emit Withdrawal(address(alice), 0.132 ether);
        // senseistakeV2.withdraw(tokenId);

        // // simulamos validator rewards income
        // deal(senseistakeV2.getServiceContractAddress(tokenId), 0.32132 ether);

        // // total withdraw after some more time (not that it even does something)
        // vm.warp(29 days);

        // // simulamos que terminamos el validador y nos devielve 32 + un poquito de rewards
        // deal(senseistakeV2.getServiceContractAddress(tokenId), 32.0132 ether);

        // // complete withdraw
        // address sc_addr = senseistakeV2.getServiceContractAddress(tokenId);
        // SenseistakeServicesContract servicecontract = SenseistakeServicesContract(payable(sc_addr));
        // uint256 claimable = servicecontract.getWithdrawableAmount();

        // // total withdraw
        // vm.expectEmit(true, true, false, false);
        // emit Withdrawal(address(alice), claimable);
        // senseistakeV2.withdraw(tokenId);
        // vm.stopPrank();

        // vm.startPrank(alice);
        // // check that service contract exited == true
        // uint256 exitedAt = servicecontract.exitedAt();
        // assertGt(exitedAt, 0);
        // vm.stopPrank();
        // senseistakeV2.tokenURI(tokenId);
    }
}
