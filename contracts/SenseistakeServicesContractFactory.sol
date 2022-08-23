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

pragma solidity 0.8.4;

import "./SenseistakeBase.sol";
import "./interfaces/ISenseistakeStorage.sol";
import "./interfaces/ISenseistakeServicesContract.sol";
import "./interfaces/ISenseistakeServicesContractFactory.sol";
import "./libraries/ProxyFactory.sol";
import "./libraries/Address.sol";
import "@openzeppelin/contracts/utils/Counters.sol";
import "./SenseistakeServicesContract.sol";
import "./SenseistakeERC20Wrapper.sol";
import "hardhat/console.sol";

contract SenseistakeServicesContractFactory is SenseistakeBase, ProxyFactory, ISenseistakeServicesContractFactory {
    using Address for address;
    using Address for address payable;

    uint256 private constant FULL_DEPOSIT_SIZE = 32 ether;
    uint256 private constant COMMISSION_RATE_SCALE = 1000000;

    // Start to receive 32 or multiplo
    //uint256 private _minimumDeposit = 0.1 ether;
    uint256 private _minimumDeposit = 32 ether;
    address payable private _servicesContractImpl;
    address private _operatorAddress;
    uint24 private _commissionRate;

    using Counters for Counters.Counter;
    Counters.Counter private _tokenIdCounter;

    // address private _tokenContractAddr;

    mapping(address => address[]) private _depositServiceContracts;
    mapping(address => mapping(address => uint256)) private _depositServiceContractsIndices;

    // uint256 private _lastIndexServiceContract;

    // address[] private _serviceContractList;

    modifier onlyOperator() {
        require(msg.sender == _operatorAddress);
        _;
    }

    constructor(uint24 commissionRate, address senseistakeStorageAddress)
    {
        require(uint256(commissionRate) <= COMMISSION_RATE_SCALE, "Commission rate exceeds scale");

        _operatorAddress = msg.sender;
        _commissionRate = commissionRate;
        _servicesContractImpl = payable(new SenseistakeServicesContract());
        SenseistakeServicesContract(_servicesContractImpl).initialize(0, address(0), "", address(0));
        initializeSenseistakeStorage(senseistakeStorageAddress);

        emit OperatorChanged(msg.sender);
        emit CommissionRateChanged(commissionRate);
    }

    function changeOperatorAddress(address newAddress)
        external
        override
        onlyOperator
    {
        require(newAddress != address(0), "Address can't be zero address");
        _operatorAddress = newAddress;

        emit OperatorChanged(newAddress);
    }

    function changeCommissionRate(uint24 newCommissionRate)
        external
        override
        onlyOperator
    {
        require(uint256(newCommissionRate) <= COMMISSION_RATE_SCALE, "Commission rate exceeds scale");
        _commissionRate = newCommissionRate;

        emit CommissionRateChanged(newCommissionRate);
    }

    function changeMinimumDeposit(uint256 newMinimumDeposit)
        external
        override
        onlyOperator
    {
        _minimumDeposit = newMinimumDeposit;

        emit MinimumDepositChanged(newMinimumDeposit);
    }

    function createContract(
        bytes32 saltValue,
        bytes32 operatorDataCommitment
    )
        external
        payable
        override
        returns (address)
    {
        require (msg.value <= FULL_DEPOSIT_SIZE);

        address senseistakeStorageAddress = address(senseistakeStorage);

        bytes memory initData =
            abi.encodeWithSignature(
                "initialize(uint24,address,bytes32,address)",
                _commissionRate,
                _operatorAddress,
                operatorDataCommitment,
                senseistakeStorageAddress
            );

        address proxy = _createProxyDeterministic(_servicesContractImpl, initData, saltValue);
        // _serviceContractList.push(proxy);
        // _lastIndexServiceContract += 1;
        emit ContractCreated(saltValue);

        if (msg.value > 0) {
            ISenseistakeServicesContract(payable(proxy)).depositOnBehalfOf{value: msg.value}(msg.sender);
        }

        return proxy;
    }

    function createMultipleContracts(
        uint256 baseSaltValue,
        bytes32[] calldata operatorDataCommitments
    )
        external
        payable
        override
    {
        uint256 remaining = msg.value;

        for (uint256 i = 0; i < operatorDataCommitments.length; i++) {
            bytes32 salt = bytes32(baseSaltValue + i);
            address senseistakeStorageAddress = address(senseistakeStorage);

            bytes memory initData =
                abi.encodeWithSignature(
                    "initialize(uint24,address,bytes32,address)",
                    _commissionRate,
                    _operatorAddress,
                    operatorDataCommitments[i],
                    senseistakeStorageAddress
                );

            address proxy = _createProxyDeterministic(
                _servicesContractImpl,
                initData,
                salt
            );

            emit ContractCreated(salt);

            uint256 depositSize = _min(remaining, FULL_DEPOSIT_SIZE);
            if (depositSize > 0) {
                ISenseistakeServicesContract(payable(proxy)).depositOnBehalfOf{value: depositSize}(msg.sender);
                remaining -= depositSize;
            }
        }

        if (remaining > 0) {
            payable(msg.sender).sendValue(remaining);
        }
    }

    function fundMultipleContracts(
        bytes32[] calldata saltValues
    )
        external
        payable
        override
        returns (uint256)
    {
        require(msg.value >= _minimumDeposit, "Deposited amount should be greater than minimum deposit");
        uint256 remaining = msg.value;
        address depositor = msg.sender;
        //TODO ver donde lo cargamos la url del nft
        string memory tokenURI = "https://www.aisland.store/img/cryptocurrencies/ethereum.png";

        for (uint256 i = 0; i < saltValues.length; i++) {
            if (remaining == 0)
                break;
            address proxy = _getDeterministicAddress(_servicesContractImpl, saltValues[i]);
            if (proxy.isContract()) {
                ISenseistakeServicesContract sc = ISenseistakeServicesContract(payable(proxy));
                if (sc.getState() == ISenseistakeServicesContract.State.PreDeposit) {
                    uint256 depositAmount = _min(remaining, FULL_DEPOSIT_SIZE - address(sc).balance);
                    if (depositAmount != 0) {
                        _tokenIdCounter.increment();
                        console.log("1TokenId in fundMultipleContracts", _tokenIdCounter.current() );
                        uint256 tokenId = _tokenIdCounter.current();
                        sc.setTokenId(tokenId);
                        sc.setTokenURI(tokenURI);
                        console.log("after setTokenId ", tokenId);
                        sc.depositOnBehalfOf{value: depositAmount}(depositor);
                        _addDepositServiceContract(address(sc), depositor);
                        remaining -= depositAmount;
                        emit ServiceContractDeposit(address(sc));
                    }
                    
                }
            }
        }

        if (remaining > 0) {
            payable(msg.sender).sendValue(remaining);
        }

        
        return remaining;
    }

    function getOperatorAddress()
        external
        view
        override
        returns (address)
    {
        return _operatorAddress;
    }

    function getCommissionRate()
        external
        view
        override
        returns (uint24)
    {
        return _commissionRate;
    }

    function getServicesContractImpl()
        external
        view
        override
        returns (address payable)
    {
        return _servicesContractImpl;
    }

    function getMinimumDeposit()
        external
        view
        override
        returns (uint256)
    {
        return _minimumDeposit;
    }

    function _min(uint256 a, uint256 b) pure internal returns (uint256) {
        return a <= b ? a : b;
    }

    function getDepositServiceContract(
        address depositor
    ) external override view returns (address[] memory) {
        return _depositServiceContracts[depositor];
    }

    function getDepositServiceContractIndex(
        address depositor,
        address serviceContractAddress
    ) external override view returns (uint256) {
        return _depositServiceContractsIndices[depositor][serviceContractAddress];
    }

    // this method is used when the whole amount deposited from a user (in a service contract)
    // is given to another user
    function transferDepositServiceContract(
        address serviceContractAddress,
        address from,
        address to
    ) external override onlyLatestContract("SenseistakeERC721", msg.sender) {
        // get the index for the service contract
        uint256 index = _depositServiceContractsIndices[from][serviceContractAddress];
        // add it to the other user
        _addDepositServiceContract(serviceContractAddress, to);
        // remove the service contract from original user
        _deleteDepositServiceContract(index, from);
    }

    // this method is used when only a part of the amount deposited from a user (in a service contract)
    // is give to another user, and some other part is kept for the original user
    function addDepositServiceContract(
        address serviceContractAddress,
        address to
    ) external override onlyLatestContract("SenseistakeERC20Wrapper", msg.sender) {
        _addDepositServiceContract(serviceContractAddress, to);
    }

    // just for adding the smart contract to the storage, without duplicates
    function _addDepositServiceContract(
        address serviceContractAddress,
        address depositor
    ) internal {
        // we want to disable usage of zero position, because will generate problems with
        // dupe check for index == 0 later on
        if (_depositServiceContracts[depositor].length == 0) {
            _depositServiceContracts[depositor].push(address(0));
            _depositServiceContractsIndices[depositor][address(0)] = 0;
        }
        if (_depositServiceContractsIndices[depositor][serviceContractAddress] == 0) {
            _depositServiceContracts[depositor].push(serviceContractAddress);
            _depositServiceContractsIndices[depositor][serviceContractAddress] = _depositServiceContracts[depositor].length - 1;
        }
    }

    // for putting the last element in the array of the mapping _depositServiceContractsIndices
    // into a certain index, so that we can have the array length decreased
    function _replaceFromDepositServiceContracts(uint256 index, address user) internal {
        delete _depositServiceContractsIndices[user][_depositServiceContracts[user][index]];
        _depositServiceContracts[user].pop();
    }

    function withdrawAll() 
        external 
        override 
        returns (bool) 
    {
        require(_depositServiceContracts[msg.sender].length > 1, "Client should have deposited");
        uint256 totalContracts = _depositServiceContracts[msg.sender].length;
        int256[] memory removeIndices = new int256[](totalContracts);
        for (uint256 i = 1; i < totalContracts; i++) {
            // we start it with -1 so that we can later check all those that are not -1 for removal
            removeIndices[i] = -1; 
        }
        for (uint256 i = 1; i < totalContracts; i++) {
            address addr = _depositServiceContracts[msg.sender][i];
            ISenseistakeServicesContract sc = ISenseistakeServicesContract(payable(addr));
            sc.withdrawAllOnBehalfOf(payable(msg.sender));
            uint256 idx = _depositServiceContractsIndices[msg.sender][addr];
            removeIndices[i] = int256(idx);
        }
        // remove from depositor the service contract where he does not have more deposits
        for (uint256 i = totalContracts; i > 1; i--) {
            if (removeIndices[i-1] != -1) {
                _replaceFromDepositServiceContracts(uint256(removeIndices[i-1]), msg.sender);
            }
        }
        return true;
    }

    /*function withdraw(
       address serviceContractAddress
    ) external override returns (bool) {
        require(serviceContractAddress != address(0),"Should be a valid service contract");
        uint256 indexSC = _depositServiceContractsIndices[msg.sender][serviceContractAddress];
        require(
            _depositServiceContracts[msg.sender][indexSC] == serviceContractAddress, 
            "Client should have deposited"
        );
        ISenseistakeServicesContract sc = ISenseistakeServicesContract(payable(serviceContractAddress));
        sc.withdrawAllOnBehalfOf(payable(msg.sender));
        // remove from depositor the service contract where he does not have more deposits
        _deleteDepositServiceContract(uint256(indexSC), msg.sender);
        return true;
    }*/

    // this method is used when the whole amount deposited from a user (in a service contract) is deleted
    function _deleteDepositServiceContract(
        uint256 index,
        address user
    ) internal {
        if (index != _depositServiceContracts[user].length - 1) {
            address last_value = _depositServiceContracts[user][_depositServiceContracts[user].length - 1];
            delete _depositServiceContractsIndices[user][_depositServiceContracts[user][index]]; // remove index of service contract to be deleted
            _depositServiceContracts[user].pop(); // remove last element and decrease length
            _depositServiceContracts[user][index] = last_value; // put last element in desired index
            _depositServiceContractsIndices[user][last_value] = index; // change also indices mapping
        } else {
            delete _depositServiceContractsIndices[user][_depositServiceContracts[user][index]];
            _depositServiceContracts[user].pop();
        }
    }

    function increaseWithdrawalAllowance(
        uint256 amount
    ) external override returns (bool) {
        require(_depositServiceContracts[msg.sender].length > 1, "Client should have deposited");
        uint256 remaining = amount;
        for (uint256 i = 1; i < _depositServiceContracts[msg.sender].length; i++) {
            address addr = _depositServiceContracts[msg.sender][i];
            ISenseistakeServicesContract sc = ISenseistakeServicesContract(payable(addr));
            uint256 withdrawAmount = _min(remaining, sc.getDeposit(msg.sender));
            sc.increaseWithdrawalAllowanceFromFactory(payable(msg.sender), withdrawAmount); // le doy
            remaining -= withdrawAmount;
            if (remaining == 0) { break; }
        }
        if (remaining > 0) {
            // perhaps revert, for now it withdraws the maximum it can if more than available is sent
            return false;
        }
        return true;
    }

    function getWithdrawalAllowance() 
        external 
        view
        override 
        returns (uint256) 
    {
        uint256 allowance = 0;
        for (uint256 i = 1; i < _depositServiceContracts[msg.sender].length; i++) {
            address addr = _depositServiceContracts[msg.sender][i];
            ISenseistakeServicesContract sc = ISenseistakeServicesContract(payable(addr));
            allowance += sc.withdrawalAllowance(msg.sender, address(this));
        }
        return allowance;
    }

    // function getLastIndexServiceContract() external override view returns (uint256) {
    //     return _lastIndexServiceContract;
    // }

    // function getServiceContractList() external override view returns (address[] memory) {
    //     return _serviceContractList;
    // }

    // function getServiceContractListAt(uint256 index) external override view returns (address) {
    //     return _serviceContractList[index];
    // }

    function getBalanceOf(address user) external override view returns (uint256) {
        uint256 balance;
        for (uint256 index = 1; index < _depositServiceContracts[user].length; index++) {
            balance += this.getDepositsAt(_depositServiceContracts[user][index], user);
        }
        return balance;
    }

    function getDepositsAt(address serviceContract, address user) external override view returns (uint256) {
        ISenseistakeServicesContract sc = ISenseistakeServicesContract(serviceContract);
        uint256 balance = sc.getDeposit(user);
        return balance;
    }
}
