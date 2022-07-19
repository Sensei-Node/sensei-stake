const {deployments} = require('hardhat');
const {ethers} = require('hardhat');
const chai = require('chai');
require('solidity-coverage');
const expect = chai.expect;
const { deploymentVariables } = require("../helpers/variables");
const { network } = require("hardhat")

describe('Deposit', () => {
  let owner, alice, operator, bob;
  let factoryContract, serviceContractIndex, tokenContract;
  let serviceContracts = [];

  // before(async () => {
  //   // get deployments made using hardhat-deploy
  //   const fixtures = await deployments.fixture();
  //   console.log('--------- Deployed SCs ------------');
  //   console.log(Object.keys(fixtures));
  //   console.log('-----------------------------------');
  // });

  beforeEach(async function () {
    // const fixtures = await deployments.fixture([
    //   'SenseistakeServicesContractFactory', 
    //   'SenseistakeERC20Wrapper',
    //   'SenseistakeServicesContract1',
    //   'ServiceContractSalt1',
    // ]);
    if (network.config.type == 'local') await deployments.fixture();
    [owner, alice, bob, operator] = await ethers.getSigners();
    // get factory deployment
    const factoryDeployment = await deployments.get('SenseistakeServicesContractFactory')
    const contrFactory = await ethers.getContractFactory(
      'SenseistakeServicesContractFactory'
    );
    factoryContract = await contrFactory.attach(factoryDeployment.address);
    // get service contract index
    // serviceContractIndex = await factoryContract.getLastIndexServiceContract()
    serviceContractIndex = deploymentVariables.servicesToDeploy;
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

  it('1. should be able to deposit 1 eth to service contract calling from factory', async function () {
    const { salt, sc } = serviceContracts[0];
    let balances = {
      sc: {},
      token: {}
    }
    let amount = "1000000000000000000"
    balances.sc.before = (await sc.getDeposit(alice.address)).toString()
    balances.token.before = (await tokenContract.balanceOf(alice.address)).toString()
    const tx = await factoryContract.connect(alice).fundMultipleContracts([salt], false, {
      value: amount
    });
    await tx.wait();
    balances.sc.after = (await sc.getDeposit(alice.address)).toString()
    balances.token.after = (await tokenContract.balanceOf(alice.address)).toString()
    expect(balances.sc.after - balances.sc.before).to.be.equal(parseInt(amount));
    expect(balances.token.after - balances.token.before).to.be.equal(parseInt(amount));
  });

  it('2. should be able to deposit 1 eth to two different service contracts calling from factory', async function () {
    const { salt, sc } = serviceContracts[0];
    const { salt: salt2, sc: sc2 } = serviceContracts[1];
    let balances = {
      sc: {},
      token: {}
    }
    balances.sc.before = (await factoryContract.getBalanceOf(alice.address)).toString()
    balances.token.before = (await tokenContract.balanceOf(alice.address)).toString()
    let amount = "1000000000000000000"
    const tx = await factoryContract.connect(alice).fundMultipleContracts([salt], false, {
      value: amount
    });
    const tx2 = await factoryContract.connect(alice).fundMultipleContracts([salt2], false, {
      value: amount
    });
    await tx.wait();
    await tx2.wait();
    balances.sc.after = (await factoryContract.getBalanceOf(alice.address)).toString()
    balances.token.after = (await tokenContract.balanceOf(alice.address)).toString()
    expect(balances.sc.after - balances.sc.before).to.be.equal(parseInt(2*amount));
    expect(balances.token.after - balances.token.before).to.be.equal(parseInt(2*amount));
  });

  it('3. should be able to deposit 2 eth to service contract calling from factory in two transactions of 1 eth each', async function () {
    const { salt, sc } = serviceContracts[0];
    let balances = {
      sc: {},
      token: {}
    }
    let amount = "1000000000000000000"
    balances.sc.before = (await sc.getDeposit(alice.address)).toString()
    balances.token.before = (await tokenContract.balanceOf(alice.address)).toString()
    const tx = await factoryContract.connect(alice).fundMultipleContracts([salt], false, {
      value: amount
    });
    const tx2 = await factoryContract.connect(alice).fundMultipleContracts([salt], false, {
      value: amount
    });
    await tx.wait();
    await tx2.wait();
    balances.sc.after = (await sc.getDeposit(alice.address)).toString()
    balances.token.after = (await tokenContract.balanceOf(alice.address)).toString()
    expect(balances.sc.after - balances.sc.before).to.be.equal(parseInt(2*amount));
    expect(balances.token.after - balances.token.before).to.be.equal(parseInt(2*amount));
  });

  it('4. should be able to deposit only what is left for the smart contract to reach 32 eth, if a single service contract is used', async function () {
    const { salt, sc } = serviceContracts[0];
    let balances = {
      sc: {},
      token: {}
    }
    let amount = "40000000000000000000"
    balances.sc.before = (await sc.getDeposit(alice.address)).toString()
    balances.token.before = (await tokenContract.balanceOf(alice.address)).toString()
    const tx = await factoryContract.connect(alice).fundMultipleContracts([salt], false, {
      value: amount
    });
    const tx2 = await factoryContract.connect(alice).fundMultipleContracts([salt], false, {
      value: amount
    });
    await tx.wait();
    await tx2.wait();
    balances.sc.after = (await sc.getDeposit(alice.address)).toString()
    balances.token.after = (await tokenContract.balanceOf(alice.address)).toString()
    expect(balances.sc.after - balances.sc.before).to.be.equal(parseInt("32000000000000000000"));
    expect(balances.token.after - balances.token.before).to.be.equal(parseInt("32000000000000000000"));
  });
  it('5. should be able to deposit 64 eth and create two service contracts in a row', async function () {
    const { salt, sc } = serviceContracts[0];
    const { salt: salt2, sc: sc2 } = serviceContracts[1];
    let balances = {
      sc: {},
      sc2: {},
      token: {}
    }
    let amount = "64000000000000000000"
    balances.sc.before = (await sc.getDeposit(alice.address)).toString()
    balances.sc2.before = (await sc2.getDeposit(alice.address)).toString()
    balances.token.before = (await tokenContract.balanceOf(alice.address)).toString()
    const tx = await factoryContract.connect(alice).fundMultipleContracts([salt,salt2], false, {
      value: amount
    });
    await tx.wait();
    balances.sc.after = (await sc.getDeposit(alice.address)).toString()
    balances.sc2.after = (await sc.getDeposit(alice.address)).toString()
    balances.token.after = (await tokenContract.balanceOf(alice.address)).toString()
    expect(balances.sc.after - balances.sc.before).to.be.equal(parseInt("32000000000000000000"));
    expect(balances.sc2.after - balances.sc2.before).to.be.equal(parseInt("32000000000000000000"));
    expect(balances.token.after - balances.token.before).to.be.equal(parseInt("64000000000000000000"));
  });
});