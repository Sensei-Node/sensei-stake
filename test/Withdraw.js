const {deployments} = require('hardhat');
const {ethers} = require('hardhat');
const chai = require('chai');
require('solidity-coverage');
const expect = chai.expect;
const { network } = require("hardhat")

describe('Withdraw', () => {
  let owner, alice, operator, bob;
  let factoryContract, serviceContractIndex, tokenContract;
  let serviceContracts = [];

  beforeEach(async function () {
    if (network.config.type == 'local') await deployments.fixture();
    [owner, alice, operator, bob] = await ethers.getSigners();
    // get factory deployment
    const factoryDeployment = await deployments.get('SenseistakeServicesContractFactory')
    const contrFactory = await ethers.getContractFactory(
      'SenseistakeServicesContractFactory'
    );
    factoryContract = await contrFactory.attach(factoryDeployment.address);
    // get service contract index
    serviceContractIndex = await factoryContract.getLastIndexServiceContract()
    // get token deployment
    const tokenDeployment = await deployments.get('SenseistakeERC20Wrapper')
    const contrToken = await ethers.getContractFactory(
      'SenseistakeERC20Wrapper'
    );
    tokenContract = await contrToken.attach(tokenDeployment.address);
    // get all service contracts deployed
    for( let i = 1 ; i <= serviceContractIndex; i++) {
      const { address: salt } = await deployments.get('ServiceContractSalt'+i)
      const serviceDeployment = await deployments.get('SenseistakeServicesContract'+i)
      const contrService = await ethers.getContractFactory(
          'SenseistakeServicesContract'
      );
      serviceContracts.push({
        salt,
        sc: await contrService.attach(serviceDeployment.address)
      });
    }
  });

  it('1. should be able to withdraw 1 eth from service contract calling from factory', async function () {
    const { salt, sc } = serviceContracts[0];
    // first do the deposit
    let amount = "1000000000000000000"
    const tx = await factoryContract.connect(alice).fundMultipleContracts([salt], false, {
      value: amount
    });
    // then test the withdrawals
    let balances = {
      sc: {},
      token: {}
    }
    balances.sc.before = (await sc.getDeposit(alice.address)).toString()
    balances.token.before = (await tokenContract.balanceOf(alice.address)).toString()
    const withdrawAllowance = await factoryContract.connect(alice).increaseWithdrawalAllowance(amount);
    const withdraw = await factoryContract.connect(alice).withdraw(amount);
    balances.sc.after = (await sc.getDeposit(alice.address)).toString()
    balances.token.after = (await tokenContract.balanceOf(alice.address)).toString()
    expect(balances.sc.before - balances.sc.after).to.be.equal(parseInt(amount));
    expect(balances.token.before - balances.token.after).to.be.equal(parseInt(amount));
    expect(parseInt(balances.sc.after)).to.be.equal(0);
    expect(parseInt(balances.token.after)).to.be.equal(0);
  });

  it('2. should be able to withdraw 2eth/2eth (all) deposited into two different service contracts calling from factory', async function () {
    const { salt, sc } = serviceContracts[0];
    const { salt: salt2, sc: sc2 } = serviceContracts[1];
    // first do the deposit
    let amount = "1000000000000000000"
    const tx = await factoryContract.connect(alice).fundMultipleContracts([salt], false, {
      value: amount
    });
    const tx2 = await factoryContract.connect(alice).fundMultipleContracts([salt2], false, {
      value: amount
    });
    // then test the withdrawals
    let balances = {
      sc: {},
      token: {}
    }
    let withdraw_amount = "2000000000000000000"
    balances.sc.before = (await factoryContract.getBalanceOf(alice.address)).toString()
    balances.token.before = (await tokenContract.balanceOf(alice.address)).toString()
    const withdrawAllowance = await factoryContract.connect(alice).increaseWithdrawalAllowance(withdraw_amount);
    const withdraw = await factoryContract.connect(alice).withdraw(withdraw_amount);
    balances.sc.after = (await factoryContract.getBalanceOf(alice.address)).toString()
    balances.token.after = (await tokenContract.balanceOf(alice.address)).toString()
    expect(balances.sc.before - balances.sc.after).to.be.equal(parseInt(withdraw_amount));
    expect(balances.token.before - balances.token.after).to.be.equal(parseInt(withdraw_amount));
    expect(parseInt(balances.sc.after)).to.be.equal(0);
    expect(parseInt(balances.token.after)).to.be.equal(0);
  });

  it('3. should be able to withdraw not more than what was deposited into the service contract calling from factory', async function () {
    const { salt, sc } = serviceContracts[0];
    // first do the deposit
    let amount = "2000000000000000000"
    const tx = await factoryContract.connect(alice).fundMultipleContracts([salt], false, {
      value: amount
    });
    // then test the withdrawals
    let balances = {
      sc: {},
      token: {}
    }
    let withdraw_amount = "3000000000000000000"
    balances.sc.before = (await factoryContract.getBalanceOf(alice.address)).toString()
    balances.token.before = (await tokenContract.balanceOf(alice.address)).toString()
    const withdrawAllowance = await factoryContract.connect(alice).increaseWithdrawalAllowance(withdraw_amount);
    const withdraw = await factoryContract.connect(alice).withdraw(withdraw_amount);
    balances.sc.after = (await factoryContract.getBalanceOf(alice.address)).toString()
    balances.token.after = (await tokenContract.balanceOf(alice.address)).toString()
    expect(balances.sc.before - balances.sc.after).to.be.equal(parseInt(amount));
    expect(balances.token.before - balances.token.after).to.be.equal(parseInt(amount));
    expect(parseInt(balances.sc.after)).to.be.equal(parseInt(0));
    expect(parseInt(balances.token.after)).to.be.equal(parseInt(0));
  });

  it('4. should be able to withdraw 3eth/4eth (partial) deposited into two different service contracts calling from factory', async function () {
    const { salt, sc } = serviceContracts[0];
    const { salt: salt2, sc: sc2 } = serviceContracts[1];
    // first do the deposit
    let amount = "2000000000000000000"
    const tx = await factoryContract.connect(alice).fundMultipleContracts([salt], false, {
      value: amount
    });
    const tx2 = await factoryContract.connect(alice).fundMultipleContracts([salt2], false, {
      value: amount
    });
    // then test the withdrawals
    let balances = {
      sc: {},
      token: {}
    }
    let withdraw_amount = "3000000000000000000"
    balances.sc.before = (await factoryContract.getBalanceOf(alice.address)).toString()
    balances.token.before = (await tokenContract.balanceOf(alice.address)).toString()
    const withdrawAllowance = await factoryContract.connect(alice).increaseWithdrawalAllowance(withdraw_amount);
    const withdraw = await factoryContract.connect(alice).withdraw(withdraw_amount);
    balances.sc.after = (await factoryContract.getBalanceOf(alice.address)).toString()
    balances.token.after = (await tokenContract.balanceOf(alice.address)).toString()
    expect(balances.sc.before - balances.sc.after).to.be.equal(parseInt(withdraw_amount));
    expect(balances.token.before - balances.token.after).to.be.equal(parseInt(withdraw_amount));
    let left_with = "1000000000000000000"
    expect(parseInt(balances.sc.after)).to.be.equal(parseInt(left_with));
    expect(parseInt(balances.token.after)).to.be.equal(parseInt(left_with));
  });

  it('5. should be revert because the allowance is not setted before', async function () {
    const { salt, sc } = serviceContracts[0];
    const { salt: salt2, sc: sc2 } = serviceContracts[1];
    // first do the deposit
    let amount = "2000000000000000000"
    const tx = await factoryContract.connect(alice).fundMultipleContracts([salt], false, {
      value: amount
    });
    let withdraw_amount = "3000000000000000000"
    // Try to make a withdraw without allowance
    const withdraw =  factoryContract.connect(alice).withdraw(withdraw_amount);
    await expect(withdraw).to.be.revertedWith("NotEnoughBalance");
  });
});