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

/// @notice Manages the deployment of services contracts
interface ISenseistakeServicesContractFactory {
    /// @notice Emitted when a proxy contract of the services contract is created
    event ServiceContractDeposit(
        address indexed serviceContract
    );

    /// @notice Emitted when a proxy contract of the services contract is created
    event ContractCreated(
        bytes32 create2Salt
    );

    /// @notice Emitted when operator service commission rate is set or changed.
    event CommissionRateChanged(
        uint256 newCommissionRate
    );

    /// @notice Emitted when operator address is set or changed.
    event OperatorChanged(
        address newOperatorAddress
    );

    /// @notice Emitted when minimum deposit amount is changed.
    event MinimumDepositChanged(
        uint256 newMinimumDeposit
    );

    /// @notice Updates the operator service commission rate.
    /// @dev Emits a {CommissionRateChanged} event.
    function changeCommissionRate(uint24 newCommissionRate) external;

    /// @notice Updates address of the operator.
    /// @dev Emits a {OperatorChanged} event.
    function changeOperatorAddress(address newAddress) external;

    /// @notice Updates the minimum size of deposit allowed.
    /// @dev Emits a {MinimumDeposiChanged} event.
    function changeMinimumDeposit(uint256 newMinimumDeposit) external;

    /// @notice Deploys a proxy contract of the services contract at a deterministic address.
    /// @dev Emits a {ContractCreated} event.
    function createContract(bytes32 saltValue, bytes32 operatorDataCommitmet) external payable returns (address);

    /// @notice Deploys multiple proxy contracts of the services contract at deterministic addresses.
    /// @dev Emits a {ContractCreated} event for each deployed proxy contract.
    function createMultipleContracts(uint256 baseSaltValue, bytes32[] calldata operatorDataCommitmets) external payable;

    /// @notice Funds multiple services contracts in order.
    /// @dev The surplus will be returned to caller if all services contracts are filled up.
    /// Using salt instead of address to prevent depositing into malicious contracts.
    /// @param saltValues The salts that are used to deploy services contracts.
    /// when it has more than `MINIMUM_DEPOSIT` ETH of capacity.
    /// @return surplus The amount of returned ETH.
    function fundMultipleContracts(bytes32[] calldata saltValues) external payable returns (uint256);

    /// @notice Returns the address of the operator.
    function getOperatorAddress() external view returns (address);

    /// @notice Returns the operator service commission rate.
    function getCommissionRate() external view returns (uint24);

    /// @notice Returns the address of implementation of services contract.
    function getServicesContractImpl() external view returns (address payable);

    /// @notice Returns the minimum deposit amount.
    function getMinimumDeposit() external view returns (uint256);

    /// @notice Get the balance of a address. This looks for in all the service contracts of the user. 
    function getBalanceOf(address user) external view returns (uint256);
    
    /// @notice Get the index position in the array of service contracts  
    // function getServiceContractListAt(uint256 index) external view returns (address);

    /// @notice Return the service contract list
    // function getServiceContractList() external view returns (address[] memory);

    /// @notice  get the last index of the service contract array
    // function getLastIndexServiceContract() external view returns (uint256);

    /// @notice make a withdraw the deposit of a service contract address
    function withdraw(address serviceContractAddress) external returns (bool);

    /// @notice withdraw all the deposits made
    function withdrawAll() external returns (bool);

    /// @notice Increase the whitdraw allowance before the withdraw
    function increaseWithdrawalAllowance(uint256 amount) external returns (bool);

     /// @notice transfer a service contract from an address to other address
    function transferDepositServiceContract(address serviceContractAddress, address from, address to) external;

     /// @notice Add a service contract to an array of sc
    function addDepositServiceContract(address serviceContractAddress, address to) external;

    /// @notice returns an array of service contract from a depositors
    function getDepositServiceContract(address depositor) external view returns (address[] memory);

    /// @notice return the index in array of the service contract of a depositor
    function getDepositServiceContractIndex(address depositor, address serviceContractAddress) external view returns (uint256);

    /// @notice get the deposit amount of a service contract of a user/
    function getDepositsAt(address serviceContract, address user) external view returns (uint256);

    /// @notice Return the withdraw allowance of a user
    function getWithdrawalAllowance() external view returns (uint256);
}
