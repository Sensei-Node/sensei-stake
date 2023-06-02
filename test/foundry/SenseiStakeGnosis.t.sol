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
        // bytes memory pubk = abi.decode(bytes("91d2090299b374c5af6908d4f7f9005caf4959a667938e4a0e4a81f091500aa6e00132da2994fa29ff869273400c35d1"), (bytes));
        // bytes memory deps = abi.decode(bytes("ad7d73420cd2b2247e02490b22d3018a5393eede94d2dfd0530fbdcb0d8fdf140957d002e21a529fd1d4c3dcab86061615a2c69cd35ec47903b0c74f8ac42481bdc5ac4af6082312b0b43f6d6403f8ef55312d3947ee2554f5233bb4651d5330"), (bytes));
        // bytes32 ddroot;
        // assembly {
        //     ddroot := mload(add("a9e84ad521bdcfa95086b3988554713949c34a73a1faeb24b9867d28e3ad1ca9", 32))
        // }
        bytes memory pubk = hex"923b9258fb4ffc2f4cf3255f3560a8308d3cd1db9247d4f64a8e857b93abdfe89297e0b529f728f07e31c93d5600776c";
        bytes memory deps = hex"a8a1b13d238437e648f7a2e8c803f62052a581da8e6f6a7170b41f5b34f8e7f3fcf725a554c58f91c8622e6a13281ab617b56e5db131126754c058e044316a1566e5fa3a8995efb4f4dde88bfe79982ded4681c8faa52332d6bf953e89804f52";
        bytes32 ddroot = hex"04f01337181f78f517981599e117f7f6824c6b4d1b0aa24089685b0f8bc3dc2e";
        senseistakeV2.addValidator(1, pubk, deps, ddroot);
        // senseistakeV2.addValidator(1, new bytes(48), new bytes(96), bytes32(0));
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
