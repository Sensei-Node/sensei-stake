// SPDX-License-Identifier: GPL-3.0-only

pragma solidity 0.8.17;

import "@openzeppelin/contracts/access/Ownable.sol";

contract MockDepositContract is Ownable {
    bool public deposited;
    bytes private _pubkey;
    bytes private _withdrawal_credentials;
    bytes private _signature;
    bytes32 private _deposit_data_root;

    mapping(address => bool) public whitelisted;

    event Whitelisted(address);

    function deposit(
        bytes calldata pubkey,
        bytes calldata withdrawal_credentials,
        bytes calldata signature,
        bytes32 deposit_data_root
    ) external payable {
        deposited = true;
        _pubkey = pubkey;
        _withdrawal_credentials = withdrawal_credentials;
        _signature = signature;
        _deposit_data_root = deposit_data_root;
    }

    function whitelist(address user) external onlyOwner {
        whitelisted[user] = true;
        emit Whitelisted(user);
    }
}
