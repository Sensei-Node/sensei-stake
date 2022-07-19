// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.

// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details.

// You should have received a copy of the GNU General Public License
// along with this program.  If not, see <http://www.gnu.org/licenses/>.

// SPDX-License-Identifier: GPL-3.0-only


pragma solidity ^0.8.0;

/// @notice Manages the deployment of token contract
interface ISenseistakeERC20Wrapper {
    /// @notice Emitted when token address is set or changed.
    // event TokenAddressChanged(
    //     address newTokenAddress
    // );

    /// @notice Updates address of the token contract.
    /// @dev Emits a {TokenAddressChanged} event.
    //function changeTokenAddress(address newAddress) external;

    /// @notice Returns the address of token address contract.
    //function getTokenAddress() external view returns (address);

    /// @notice .
    function mintTo(address to, uint256 amount) external;

    /// @notice .
    function redeemTo(address to, uint256 amount) external;

    /// @notice .
    function allowServiceContract(address serviceContract) external;
    
    /// @notice .
    function getOperatorAddress() external view returns (address);

    /// @notice .
    function isServiceContractAllowed(address serviceContract) external view returns (bool);

    // function increaseWithdrawalAllowance(uint256 amount) external returns (bool);
}
