const {deployments} = require('hardhat');
const {ethers} = require('hardhat');
const chai = require('chai');
require('solidity-coverage');
const expect = chai.expect;
const { deploymentVariables, waitConfirmations } = require("../helpers/variables");
const { network } = require("hardhat")

describe('Complete64eth', () => {
  let owner, aliceWhale, operator, bob;
  let factoryContract, serviceContractIndex, tokenContract;
  let serviceContracts = [];

  beforeEach(async function () {
    if (network.config.type == 'hardhat') await deployments.fixture();
    [owner, aliceWhale, bob] = await ethers.getSigners();
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


  it('1. should be able to deposit 64eth and withdraw them', async function () {
    /*
      1. deposit 64 eth
      2. withdraw 32 eth
    */
    const { salt:salt1, sc:sc1 } = serviceContracts[0];
    const { salt:salt2, sc:sc2 } = serviceContracts[1];
    const { salt:salt3, sc:sc3 } = serviceContracts[2];
    let balances = {
      sc1: {},
      sc2: {},
      token: {}
    }
    let amount = "64000000000000000000"
    let amountRemining = "32000000000000000000"
    balances.sc1.before_1 = (await sc1.getDeposit(aliceWhale.address)).toString()
    balances.sc2.before_1 = (await sc2.getDeposit(aliceWhale.address)).toString()
    balances.token.before_1 = (await tokenContract.balanceOf(aliceWhale.address)).toString()

    const tx = await factoryContract.connect(aliceWhale).fundMultipleContracts([salt1,salt2,salt3], {
      value: amount
    });
    

    await tx.wait(waitConfirmations[network.config.type]);


    balances.sc1.after_1 = (await sc1.getDeposit(aliceWhale.address)).toString()
    balances.sc2.after_1 = (await sc2.getDeposit(aliceWhale.address)).toString()
    balances.token.after_1 = (await tokenContract.balanceOf(aliceWhale.address)).toString()

    console.log((await factoryContract.getBalanceOf(aliceWhale.address)).toString())
    expect(balances.sc1.after_1 - balances.sc1.before_1).to.be.equal(parseInt(amountRemining));
    expect(balances.sc2.after_1 - balances.sc2.before_1).to.be.equal(parseInt(amountRemining));
    
    expect(balances.token.after_1 - balances.token.before_1).to.be.equal(parseInt(amount));
    
     balances.sc1.before_2 = (await sc1.getDeposit(aliceWhale.address)).toString()
     balances.sc2.before_2 = (await sc2.getDeposit(aliceWhale.address)).toString()
     balances.token.before_2 = (await tokenContract.balanceOf(aliceWhale.address)).toString()

     const withdrawAllowance = await factoryContract.connect(aliceWhale).increaseWithdrawalAllowance(amount);
     const withdraw = await factoryContract.connect(aliceWhale).withdraw(sc1.address);
     await withdraw.wait(waitConfirmations[network.config.type]);

     balances.sc1.after_2 = (await sc1.getDeposit(aliceWhale.address)).toString()
     balances.sc2.after_2 = (await sc2.getDeposit(aliceWhale.address)).toString()
     balances.token.after_2 = (await tokenContract.balanceOf(aliceWhale.address)).toString()
     console.log(balances)
     expect(balances.sc1.before_2 - balances.sc1.after_2).to.be.equal(parseInt(amountRemining));
     expect(balances.sc2.before_2 - balances.sc2.after_2).to.be.equal(parseInt(0));
     expect(balances.token.before_2 - balances.token.after_2 ).to.be.equal(parseInt(amountRemining));     
  });
});