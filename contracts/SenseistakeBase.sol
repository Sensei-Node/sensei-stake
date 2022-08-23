pragma solidity 0.8.4;

// SPDX-License-Identifier: GPL-3.0-only

import "./interfaces/ISenseistakeStorage.sol";
import "hardhat/console.sol";

/// @title Base settings / modifiers for each contract in Sensei Stake
/// @author Senseistake

abstract contract SenseistakeBase {

    // Calculate using this as the base
    uint256 constant calcBase = 1 ether;

    // Version of the contract
    uint8 public version;

    // The main storage contract where primary persistant storage is maintained
    ISenseistakeStorage senseistakeStorage; //=ISenseistakeStorage(address(0));


    /*** Modifiers **********************************************************/

    // /**
    // * @dev Throws if called by any sender that doesn't match a Sensei Node network contract
    // */
    // modifier onlyLatestNetworkContract() {
    //     require(getBool(keccak256(abi.encodePacked("contract.exists", msg.sender))), "Invalid or outdated network contract");
    //     _;
    // }

    /**
    * @dev Throws if called by any sender that doesn't match one of the supplied contract or is the latest version of that contract
    */
    modifier onlyLatestContract(string memory _contractName, address _contractAddress) {
        require(_contractAddress == getAddress(keccak256(abi.encodePacked("contract.address", _contractName))), "Invalid or outdated contract");
        _;
    }

    /**
    * @dev Throws if called by any account other than a guardian account (temporary account allowed access to settings before DAO is fully enabled)
    */
    modifier onlyGuardian() {
        require(msg.sender == senseistakeStorage.getGuardian(), "Account is not a temporary guardian");
        _;
    }

    /**
    * @dev Throws if explicitly specified that a function in a smart contract is disabled
    */
    modifier functionDisabled(string memory _contractFunction, address _contractAddress) {
        require(false == getBool(keccak256(abi.encodePacked(_contractFunction, _contractAddress))), "Function disabled");
        _;
    }


    /*** Methods **********************************************************/

    /// @dev Set the main Senseistake Storage address
    // constructor(ISenseistakeStorage _senseistakeStorageAddress) {
    //     // Update the contract address
    //     senseistakeStorage = ISenseistakeStorage(_senseistakeStorageAddress);
    // }

    function initializeSenseistakeStorage(
        address _senseistakeStorageAddress
    )
        internal
    {
        require(address(senseistakeStorage) == address(0), "Cannot re-initialize.");
        senseistakeStorage = ISenseistakeStorage(_senseistakeStorageAddress);
    }


    /// @dev Get the address of a network contract by name
    function getContractAddress(string memory _contractName) internal view returns (address) {
        // Get the current contract address
        address contractAddress = getAddress(keccak256(abi.encodePacked("contract.address", _contractName)));
        // Check it
        require(contractAddress != address(0x0), "Contract not found");
        // Return
        return contractAddress;
    }


    /// @dev Get the address of a network contract by name (returns address(0x0) instead of reverting if contract does not exist)
    function getContractAddressUnsafe(string memory _contractName) internal view returns (address) {
        // Get the current contract address
        address contractAddress = getAddress(keccak256(abi.encodePacked("contract.address", _contractName)));
        // Return
        return contractAddress;
    }


    /// @dev Get the name of a network contract by address
    function getContractName(address _contractAddress) internal view returns (string memory) {
        // Get the contract name
        string memory contractName = getString(keccak256(abi.encodePacked("contract.name", _contractAddress)));
        // Check it
        require(bytes(contractName).length > 0, "Contract not found");
        // Return
        return contractName;
    }

    /// @dev Get revert error message from a .call method
    function getRevertMsg(bytes memory _returnData) internal pure returns (string memory) {
        // If the _res length is less than 68, then the transaction failed silently (without a revert message)
        if (_returnData.length < 68) return "Transaction reverted silently";
        assembly {
            // Slice the sighash.
            _returnData := add(_returnData, 0x04)
        }
        return abi.decode(_returnData, (string)); // All that remains is the revert string
    }



    /*** Senseistake Storage Methods ****************************************/

    // Note: Unused helpers have been removed to keep contract sizes down

    /// @dev Storage get methods
    function getAddress(bytes32 _key) internal view returns (address) { return senseistakeStorage.getAddress(_key); }
    function getUint(bytes32 _key) internal view returns (uint) { return senseistakeStorage.getUint(_key); }
    function getString(bytes32 _key) internal view returns (string memory) { return senseistakeStorage.getString(_key); }
    function getBytes(bytes32 _key) internal view returns (bytes memory) { return senseistakeStorage.getBytes(_key); }
    function getBool(bytes32 _key) internal view returns (bool) { return senseistakeStorage.getBool(_key); }
    function getInt(bytes32 _key) internal view returns (int) { return senseistakeStorage.getInt(_key); }
    function getBytes32(bytes32 _key) internal view returns (bytes32) { return senseistakeStorage.getBytes32(_key); }

    /// @dev Storage set methods
    function setAddress(bytes32 _key, address _value) internal { senseistakeStorage.setAddress(_key, _value); }
    function setUint(bytes32 _key, uint _value) internal { senseistakeStorage.setUint(_key, _value); }
    function setString(bytes32 _key, string memory _value) internal { senseistakeStorage.setString(_key, _value); }
    function setBytes(bytes32 _key, bytes memory _value) internal { senseistakeStorage.setBytes(_key, _value); }
    function setBool(bytes32 _key, bool _value) internal { senseistakeStorage.setBool(_key, _value); }
    function setInt(bytes32 _key, int _value) internal { senseistakeStorage.setInt(_key, _value); }
    function setBytes32(bytes32 _key, bytes32 _value) internal { senseistakeStorage.setBytes32(_key, _value); }

    /// @dev Storage delete methods
    function deleteAddress(bytes32 _key) internal { senseistakeStorage.deleteAddress(_key); }
    function deleteUint(bytes32 _key) internal { senseistakeStorage.deleteUint(_key); }
    function deleteString(bytes32 _key) internal { senseistakeStorage.deleteString(_key); }
    function deleteBytes(bytes32 _key) internal { senseistakeStorage.deleteBytes(_key); }
    function deleteBool(bytes32 _key) internal { senseistakeStorage.deleteBool(_key); }
    function deleteInt(bytes32 _key) internal { senseistakeStorage.deleteInt(_key); }
    function deleteBytes32(bytes32 _key) internal { senseistakeStorage.deleteBytes32(_key); }

    /// @dev Storage arithmetic methods
    function addUint(bytes32 _key, uint256 _amount) internal { senseistakeStorage.addUint(_key, _amount); }
    function subUint(bytes32 _key, uint256 _amount) internal { senseistakeStorage.subUint(_key, _amount); }
}
