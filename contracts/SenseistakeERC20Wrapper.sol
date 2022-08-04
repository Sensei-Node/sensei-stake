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
import "./interfaces/IERC20.sol";
import "./interfaces/ISenseistakeStorage.sol";
import "./interfaces/ISenseistakeServicesContractFactory.sol";
import "./interfaces/ISenseistakeERC20Wrapper.sol";
import "./interfaces/ISenseistakeServicesContract.sol";
// import "./libraries/ReentrancyGuard.sol";
import "./libraries/Initializable.sol";
import "hardhat/console.sol";

// TODO: add reentrancy guard because wont work with upgrades.deployProxy()

contract SenseistakeERC20Wrapper is SenseistakeBase, IERC20, Initializable, ISenseistakeERC20Wrapper {
    mapping(address => uint256) private _balances;
    mapping(address => mapping(address => uint256)) private _allowances;
    mapping(address => bool) private _allowedServiceContracts;

    // address payable private _serviceContract;
    string private _name;
    string private _symbol;
    uint256 private _totalSupply;
    uint256 private constant DECIMALS = 18;
    address private _operatorAddress;

    event Mint(address indexed sender, address indexed to, uint256 indexed amount);
    event Redeem(address indexed sender, address indexed to, uint256 indexed amount);
    event PreMint(address indexed serviceContract, address indexed person, uint256 indexed amount);
    event PreRedeem(address indexed serviceContract, address indexed person, uint256 indexed amount);

    modifier onlyOperator() {
        require(
            msg.sender == _operatorAddress,
            "Caller is not the operator"
        );
        _;
    }

    function initialize(
        string memory name_,
        string memory symbol_,
        address operatorAddress,
        address senseistakeStorageAddress
    ) public initializer {
        _name = name_;
        _symbol = symbol_;
        _operatorAddress = operatorAddress;
        initializeSenseistakeStorage(senseistakeStorageAddress);
    }
    
    // function getOperatorAddress()
    //     external
    //     view
    //     override
    //     returns (address)
    // {
    //     return _operatorAddress;
    // }

    function allowServiceContract(address sc) 
        public 
        override
        onlyOperator
    {
        require(sc != address(0), "Service Contract should not be zero address");
        require(_allowedServiceContracts[sc] == false, "Service Contract was previously allowed");
        _allowedServiceContracts[sc] = true;
    }

    function isServiceContractAllowed(address sc)
        public
        view
        override
        returns (bool)
    {
        return _allowedServiceContracts[sc];
    }

    // Wrapper functions

    function mintTo(address to, uint256 amount) public override {
        require(amount > 0, "Amount can't be 0");

        require(_allowedServiceContracts[msg.sender], "Service Smart Contract not allowed");
        uint256 amount_deposited = ISenseistakeServicesContract(payable(msg.sender)).getDeposit(
            to
        );
        require(amount_deposited > 0, "Not deposit made to Service Contract");

        _mint(to, amount);

        emit Mint(msg.sender, to, amount);
    }

    function mint(uint256 amount) external {
        mintTo(msg.sender, amount);
    }

    function redeemTo(address to, uint256 amount) public override {
        require(amount > 0, "Amount can't be 0");

        require(_allowedServiceContracts[msg.sender], "Service Smart Contract not allowed");
        uint256 amount_deposited = ISenseistakeServicesContract(payable(msg.sender)).getDeposit(
            to
        );
        require(amount_deposited > 0, "Not deposit made to Service Contract");

        _burn(to, amount);

        emit Redeem(msg.sender, to, amount);
    }

    function redeem(uint256 amount) external {
        redeemTo(msg.sender, amount);
    }

    // ERC20 functions

    // function transfer(address to, uint256 amount) external override returns (bool) {
    //     _transfer(msg.sender, to, amount);
    //     return true;
    // }
    function transfer(address to, uint256 amount) external override functionDisabled("transfer", address(this)) returns (bool) {
        ISenseistakeServicesContractFactory factory = ISenseistakeServicesContractFactory(
            getContractAddress("SenseistakeServicesContractFactory")
        );
        require(factory.getBalanceOf(msg.sender) >= amount, "Not enough balance");
        uint256 remaining = amount;
        address[] memory services_contracts = factory.getDepositServiceContract(msg.sender);
        address[] memory removeAddress = new address[](services_contracts.length);
        // first retrieve from all services contracts, and replace ownership
        for (uint256 i = 1; i < services_contracts.length; i++) {
            removeAddress[i] = address(0);
            // address addr = services_contracts[i];
            ISenseistakeServicesContract sc = ISenseistakeServicesContract(
                payable(services_contracts[i])
            );
            uint256 depositAmount = sc.getDeposit(msg.sender);
            uint256 withdrawAmount = _min(remaining, depositAmount);
            sc.increaseWithdrawalAllowanceFromToken(msg.sender, withdrawAmount);
            sc.transferDepositFrom(msg.sender, to, withdrawAmount); // replace deposits ownership
            if (withdrawAmount == depositAmount) {
                removeAddress[i] = services_contracts[i];
            } else {
                factory.addDepositServiceContract(services_contracts[i], to); // share ownership in _depositServiceContracts in factory
            }
            remaining -= withdrawAmount;
            if (remaining == 0) { break; }
        }
        _transfer(msg.sender, to, amount); // envio desde mis token al to.
        for (uint256 idx = services_contracts.length; idx > 0; idx--) {
            if (removeAddress[idx-1] != address(0)) {
                factory.transferDepositServiceContract(removeAddress[idx-1], msg.sender, to); // replace _depositServiceContracts in factory
            }
        }
        if (remaining > 0) {
            // perhaps revert, for now it withdraws the maximum it can if more than available is sent
            return false;
        }
        return true;
    }

    function transferFrom(
        address from,
        address to,
        uint256 amount
    ) external override returns (bool) {
        uint256 currentAllowance = _allowances[from][msg.sender];
        // It will revert if underflow
        _approve(from, msg.sender, currentAllowance - amount);
        _transfer(from, to, amount);
       
        return true;
    }

    function approve(address spender, uint256 amount) external override returns (bool) {
        _approve(msg.sender, spender, amount);
        return true;
    }

    function increaseAllowance(address spender, uint256 addedValue) external returns (bool) {
        _approve(msg.sender, spender, _allowances[msg.sender][spender] + addedValue);
        return true;
    }

    // function increaseWithdrawalAllowance(
    //     uint256 amount
    // ) external override returns (bool) {
    //     address factory_address = getContractAddress("SenseistakeServicesContractFactory");
    //     ISenseistakeServicesContractFactory factory = ISenseistakeServicesContractFactory(factory_address);
    //     uint256 balance_sender = factory.getBalanceOf(msg.sender);
    //     require(balance_sender >= amount, "Not enough balance");
    //     uint256 remaining = amount;
    //     address[] memory services_contracts = factory.getDepositServiceContract(msg.sender);
    //     // first retrieve from all services contracts, and replace ownership
    //     for (uint256 i = 0; i < services_contracts.length; i++) {
    //         address addr = services_contracts[i];
    //         ISenseistakeServicesContract sc = ISenseistakeServicesContract(payable(addr));
    //         uint256 withdrawAmount = _min(remaining, sc.getDeposit(msg.sender));
    //         sc.increaseWithdrawalAllowanceFromToken(payable(msg.sender), withdrawAmount);
    //         remaining -= withdrawAmount;
    //         if (remaining == 0) { break; }
    //     }
    //     if (remaining > 0) {
    //         // perhaps revert, for now it withdraws the maximum it can if more than available is sent
    //         return false;
    //     }
    //     return true;
    // }

    function decreaseAllowance(address spender, uint256 subtractedValue) external returns (bool) {
        _approve(msg.sender, spender, _allowances[msg.sender][spender] - subtractedValue);
        return true;
    }

    function forceDecreaseAllowance(address spender, uint256 subtractedValue) external returns (bool) {
        uint256 currentAllowance = _allowances[msg.sender][spender];
        _approve(msg.sender, spender, currentAllowance - _min(subtractedValue, currentAllowance));
        return true;
    }

    function decimals() public pure returns (uint256) {
        return DECIMALS;
    }

    function name() public view returns (string memory) {
        return _name;    
    }

    function symbol() public view returns (string memory) {
        return _symbol;    
    }

    function totalSupply() public view override returns (uint256) {
        return _totalSupply;
    }

    function balanceOf(address owner) public view override returns (uint256) {
        return _balances[owner];
    } 

    function allowance(address owner, address spender) public view override returns (uint256) {
        return _allowances[owner][spender];
    }

    function _transfer(
        address from,
        address to,
        uint256 amount
    ) internal {
        require(to != address(0), "Transfer to the zero address");

        _balances[from] -= amount;
        _balances[to] += amount;

        emit Transfer(from, to, amount);
    }

    function _approve(
        address owner,
        address spender,
        uint256 amount
    ) internal {
        require(spender != address(0), "Approve to the zero address");
        
        _allowances[owner][spender] = amount;
        emit Approval(owner, spender, amount);
    }

    function _mint(address owner, uint256 amount) internal {
        require(owner != address(0), "Mint to the zero address");

        _totalSupply += amount;
        _balances[owner] += amount;

        emit Transfer(address(0), owner, amount);
    }

    function _burn(address owner, uint256 amount) internal {
        require(owner != address(0), "Burn from the zero address");

        _totalSupply -= amount;
        _balances[owner] -= amount;

        emit Transfer(owner, address(0), amount);
    }

    function _min(
        uint256 a,
        uint256 b
    )
        internal
        pure
        returns (uint256)
    {
        return a < b ? a : b;
    }
}
