const {deployments} = require('hardhat');
const {ethers} = require('hardhat');
const chai = require('chai');
require('solidity-coverage');
const expect = chai.expect;
const { deploymentVariables, waitConfirmations } = require("../helpers/variables");
const { network } = require("hardhat")

describe('TestnetCompleteSeveralSalt', () => {
  let owner, alice, bob;
  let factoryContract, serviceContractIndex, tokenContract;
  let serviceContracts = [];
  let deposit_service_contracts;
  let deposit_service_contracts_indices;

  beforeEach(async function () {
    if (network.config.type == 'hardhat') await deployments.fixture();
    [owner, alice, bob] = await ethers.getSigners();
    // get factory deployment
    const factoryDeployment = await deployments.get('SenseistakeServicesContractFactory')
    const contrFactory = await ethers.getContractFactory(
      'SenseistakeServicesContractFactory'
    );
    factoryContract = await contrFactory.attach(factoryDeployment.address);
    // get service contract index
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

  it('Full deposit, withdraw, transfer test', async function () {
    /*
      1. User deposita 32 eth en sc1 (factory salt1)
      2. User deposita 32 eth en sc2 (factory salt2)
      3. User deposita 32 eth en sc3 (factory salt3)
      4. User retira all eth factory
    */
    const { salt:salt1, sc: sc1 } = serviceContracts[0];
    const { salt:salt2, sc: sc2 } = serviceContracts[1];
    const { salt:salt3, sc: sc3 } = serviceContracts[2];

    let receipt;
    let balances = {
      sc: {},
      token: {}
    }
    let amount = "32000000000000000000" // 1eth
    for(let i = 0 ; i < 3 ; i++ ){
      // 1. Alice deposita 1 eth en sc1 (factory salt1) 
      balances.sc.before_1 = (await factoryContract.getBalanceOf(alice.address)).toString()
      balances.token.before_1 = (await tokenContract.balanceOf(alice.address)).toString()
      let tx1 = await factoryContract.connect(alice).fundMultipleContracts([salt1], {
        value: amount
      });
      receipt = await tx1.wait(waitConfirmations[network.config.type]);
      balances.sc.after_1 = (await factoryContract.getBalanceOf(alice.address)).toString()
      balances.token.after_1 = (await tokenContract.balanceOf(alice.address)).toString()
      expect(balances.sc.after_1 - balances.sc.before_1).to.be.equal(parseInt(amount));
      expect(balances.token.after_1 - balances.token.before_1).to.be.equal(parseInt(amount));
      console.log('OK: 1. Alice deposita 1 eth en sc1 (factory salt1) at block', receipt.blockNumber);

      // 2. Alice deposita 1 eth en sc2 (factory salt2) 
      balances.sc.before_2 = (await factoryContract.getBalanceOf(alice.address)).toString()
      balances.token.before_2 = (await tokenContract.balanceOf(alice.address)).toString()
      let tx2 = await factoryContract.connect(alice).fundMultipleContracts([salt2], {
        value: amount
      });
      receipt = await tx2.wait(waitConfirmations[network.config.type]);
      balances.sc.after_2 = (await factoryContract.getBalanceOf(alice.address)).toString()
      balances.token.after_2 = (await tokenContract.balanceOf(alice.address)).toString()
      expect(balances.sc.after_2 - balances.sc.before_2).to.be.equal(parseInt(amount));
      expect(balances.token.after_2 - balances.token.before_2).to.be.equal(parseInt(amount));
      console.log('OK: 2. Alice deposita 1 eth en sc2 (factory salt2) at block', receipt.blockNumber);
    
      // 3. Alice deposita 1 eth en sc3 (factory salt3) 
      balances.sc.before_3 = (await factoryContract.getBalanceOf(alice.address)).toString()
      balances.token.before_3 = (await tokenContract.balanceOf(alice.address)).toString()
      let tx3 = await factoryContract.connect(alice).fundMultipleContracts([salt3], {
        value: amount
      });
      receipt = await tx3.wait(waitConfirmations[network.config.type]);
      balances.sc.after_3 = (await factoryContract.getBalanceOf(alice.address)).toString()
      balances.token.after_3 = (await tokenContract.balanceOf(alice.address)).toString()
      expect(balances.sc.after_3 - balances.sc.before_3).to.be.equal(parseInt(amount));
      expect(balances.token.after_3 - balances.token.before_3).to.be.equal(parseInt(amount));
      console.log('OK: 3. Alice deposita 1 eth en sc3 (factory salt3) at block', receipt.blockNumber);

      // 4. Alice retira 2.5 eth factory
      let amountWithdraw = "96000000000000000000" // 2.5eth
      // let amounRemaining = "500000000000000000" // 0.5eth
      balances.sc.before_4 = (await factoryContract.getBalanceOf(alice.address)).toString()
      balances.token.before_4 = (await tokenContract.balanceOf(alice.address)).toString()
      let withdrawAllowance = await factoryContract.connect(alice).increaseWithdrawalAllowance(amountWithdraw);
      receipt = await withdrawAllowance.wait(waitConfirmations[network.config.type]);
      let withdraw = await factoryContract.connect(alice).withdrawAll();
      receipt = await withdraw.wait(waitConfirmations[network.config.type]);
      balances.sc.after_4 = (await factoryContract.getBalanceOf(alice.address)).toString()
      balances.token.after_4 = (await tokenContract.balanceOf(alice.address)).toString()
      expect(balances.sc.before_4 - balances.sc.after_4).to.be.equal(parseInt(amountWithdraw));
      expect(balances.token.before_4 - balances.token.after_4).to.be.equal(parseInt(amountWithdraw));
      expect(parseInt(balances.sc.after_4)).to.be.equal(parseInt(balances.sc.before_4)-parseInt(amountWithdraw));
      expect(parseInt(balances.token.after_4)).to.be.equal(parseInt(balances.token.before_4)-parseInt(amountWithdraw));
      console.log('OK: 4. Alice retira 2.5 eth factory at block', receipt.blockNumber);
    }
    
  });
});