// SPDX-License-Identifier: MIT
pragma solidity 0.8.17;

import {Address} from "@openzeppelin/contracts/utils/Address.sol";
import {SenseiStake} from "./SenseiStake.sol";
import {IERC721Receiver} from "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";

contract ExtSenseiStake is IERC721Receiver {
    using Address for address;

    SenseiStake public SenseiStakeContract;

    error InvalidAddress();
    error InvalidDepositAmount(uint256 value);
    error NotEnoughValidatorsAvailable(uint256 value);

    constructor(address contract_) {
        if (contract_ == address(0)) {
            revert InvalidAddress();
        }
        SenseiStakeContract = SenseiStake(contract_);
    }

    function createMultipleContracts() external payable {
        // check that ethers amount provided is multiple of 32
        if (msg.value % 32 ether != 0) {
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
        // mint token and transfer to user
        for (uint256 i = 0; i < amount; ) {
            // mint first
            SenseiStakeContract.createContract{value: 32 ether}();
            // this is checked in case there was another mint in between this function call
            // called from the original SenseiStake contract
            bool success = false;
            while (!success) {
                if (address(this) == SenseiStakeContract.ownerOf(tokenId + 1)) {
                    SenseiStakeContract.safeTransferFrom(
                        address(this),
                        msg.sender,
                        tokenId + 1
                    );
                    success = true;
                }
                unchecked {
                    ++tokenId;
                }
            }
            unchecked {
                ++i;
            }
        }
    }

    function onERC721Received(
        address from,
        address to,
        uint256 tokenId,
        bytes memory data
    ) external pure override returns (bytes4) {
        return IERC721Receiver.onERC721Received.selector;
    }
}
