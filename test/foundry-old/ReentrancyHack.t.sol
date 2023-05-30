pragma solidity 0.8.17;

import "forge-std/Test.sol";
import "forge-std/console.sol";
import {MockDepositContract} from "./MockDepositContract.sol";
import {SenseiStakeV2} from "../../contracts/SenseiStakeV2.sol";
import {SenseistakeServicesContractV2 as SenseistakeServicesContract} from
    "../../contracts/SenseistakeServicesContractV2.sol";
import {SenseiStake} from "../../contracts/SenseiStake.sol";
import {SenseistakeMetadata} from "../../contracts/SenseistakeMetadata.sol";

contract ReentrantHacker {
    SenseiStakeV2 senseistake;
    bool minted;

    constructor(address senseistakeAddress_) {
        senseistake = SenseiStakeV2(payable(senseistakeAddress_));
    }

    function onERC721Received(address, address, uint256, bytes calldata) external returns (bytes4) {
        if (!minted) {
            minted = true;
            senseistake.mintValidator{value: 32 ether}();
        }
        return this.onERC721Received.selector;
    }

    function mint() external {
        senseistake.mintValidator{value: 32 ether}();
    }
}

contract SenseiStakeV2Test is Test {
    SenseiStakeV2 private senseistakeV2;
    SenseiStake private senseistake;
    SenseistakeMetadata private metadata;
    MockDepositContract private depositContract;
    ReentrantHacker private hacker;

    function setUp() public {
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
        for (uint256 i = 1; i <= 5; i++) {
            senseistakeV2.addValidator(i, abi.encodePacked(new bytes(16), i), new bytes(96), bytes32(0));
        }
        hacker = new ReentrantHacker(address(senseistakeV2));
        deal(address(hacker), 33 ether);
    }

    // tira que el error es "ERC721: transfer to non ERC721Receiver implementer" pero en realidad internamente
    // falla porque se queda sin fondos
    function testCannotHack() public {
        // │   │   │   │   └─ ← "EvmError: OutOfFund"
        // │   │   │   └─ ← "EvmError: Revert"
        // │   │   └─ ← "ERC721: transfer to non ERC721Receiver implementer"
        // │   └─ ← "ERC721: transfer to non ERC721Receiver implementer"
        vm.expectRevert(abi.encodePacked("ERC721: transfer to non ERC721Receiver implementer"));
        hacker.mint();
    }
}
