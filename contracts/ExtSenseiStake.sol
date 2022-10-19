// SPDX-License-Identifier: MIT
pragma solidity 0.8.17;

import {Address} from "@openzeppelin/contracts/utils/Address.sol";
import {SenseiStake} from "./SenseiStake.sol";
import {IERC721Receiver} from "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/security/ReentrancyGuard.sol";

contract ExtSenseiStake is IERC721Receiver, ReentrancyGuard {
    using Address for address;

    SenseiStake public immutable SenseiStakeContract;

    error InvalidAddress();
    error InvalidDepositAmount(uint256 value);
    error NotEnoughValidatorsAvailable(uint256 value);

    constructor(address contract_) {
        if (contract_ == address(0)) {
            revert InvalidAddress();
        }
        SenseiStakeContract = SenseiStake(contract_);
    }

    function createMultipleContracts() external payable nonReentrant {
        // check that ethers amount provided is multiple of 32
        if (msg.value == 0 || msg.value % 32 ether != 0) {
            revert InvalidDepositAmount(msg.value);
        }
        uint256 amount = msg.value / 32 ether;
        uint256 tokenId = SenseiStakeContract.tokenIdCounter();
        // pre-check that we have enough validators loaded
        (bytes memory validatorPubKey, , ) = SenseiStakeContract.validators(
            tokenId + amount
        );
        if (validatorPubKey.length == 0) {
            revert NotEnoughValidatorsAvailable(amount);
        }
        tokenId++; // tokenId that will be minted
        // mint token and transfer to user
        for (uint256 i = 0; i < amount; ) {
            // mint first
            SenseiStakeContract.createContract{value: 32 ether}();
            // transfer to user
            SenseiStakeContract.safeTransferFrom(
                address(this),
                msg.sender,
                tokenId + i
            );
            unchecked {
                ++i;
            }
        }
    }

    function onERC721Received(
        address,
        address,
        uint256,
        bytes memory
    ) external pure override returns (bytes4) {
        return IERC721Receiver.onERC721Received.selector;
    }
}
