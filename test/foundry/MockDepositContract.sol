// SPDX-License-Identifier: GPL-3.0-only

pragma solidity 0.8.17;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract MockDepositContract is Ownable {
    bool public deposited;
    bytes private _pubkey;
    bytes private _withdrawal_credentials;
    bytes private _signature;
    bytes32 private _deposit_data_root;
    uint256 private _amount;

    mapping(address => bool) public whitelisted;

    event Whitelisted(address);
    event Deposited(address, uint256);

    IERC20 public immutable stake_token;

    constructor(address _token) {
        stake_token = IERC20(_token);
    }

    function deposit(
        bytes calldata pubkey,
        bytes calldata withdrawal_credentials,
        bytes calldata signature,
        bytes32 deposit_data_root,
        uint256 amount
    ) external payable {
        deposited = true;
        _pubkey = pubkey;
        _withdrawal_credentials = withdrawal_credentials;
        _signature = signature;
        _deposit_data_root = deposit_data_root;
        _amount = amount;
        emit Deposited(msg.sender, amount);
    }

    function whitelist(address user) external onlyOwner {
        whitelisted[user] = true;
        emit Whitelisted(user);
    }
}
