const {deployments} = require('hardhat');
const {ethers} = require('hardhat');
const chai = require('chai');
require('solidity-coverage');
const expect = chai.expect;
const { deploymentVariables, waitConfirmations } = require("../helpers/variables");
const { network } = require("hardhat")

describe('TestnetCompleteNoTransfer', () => {
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
    for (let index = 0; index < 1; index++) {
    /*
      1. Two users deposita 1 eth en sc1 (factory salt1)
      2. Two users retira 1 eth factory
         == 0
      3. Two users deposita 1 eth en sc1  (factory sal1)
      4. Two users deposita 1 etg en sc1 (factory sal1)
      5. Two users retira 2 eth factory
         == 0
      6. Two users deposita 1 eth en factory (factory salt1)
      7. Two users deposita 1 en factory (factory salt1)
         == 2
      8. Two users retira 0.5 eth factory
         == 1.5
      9. Two users retira 1 eth factory
         == 0.5
      10. Two users retira 0.5 eth factory
         == 0
    */
    const { salt, sc } = serviceContracts[0];
    const { salt: salt1, sc: sc1 } = serviceContracts[1];
    let receipt;
    let balances = {
      sc: {},
      token: {}
    }
    let amount = "1000000000000000000" // 1eth
    let accounts_to_use = [alice, bob]
    
    // 1. Alice deposita 1 eth en sc1 (factory salt1) 
    for (let index = 0; index < accounts_to_use.length; index++) {
      const account = accounts_to_use[index];
      balances.sc.before_1 = (await factoryContract.getBalanceOf(account.address)).toString()
      balances.token.before_1 = (await tokenContract.balanceOf(account.address)).toString()
      let tx = await factoryContract.connect(account).fundMultipleContracts([salt], false, {
        value: amount
      });
      receipt = await tx.wait(waitConfirmations[network.config.type]);
      balances.sc.after_1 = (await factoryContract.getBalanceOf(account.address)).toString()
      balances.token.after_1 = (await tokenContract.balanceOf(account.address)).toString()
      expect(balances.sc.after_1 - balances.sc.before_1).to.be.equal(parseInt(amount));
      expect(balances.token.after_1 - balances.token.before_1).to.be.equal(parseInt(amount));
      console.log('OK: 1. Alice deposita 1 eth en sc1 (factory salt1) at block', receipt.blockNumber);
    }

    // 2. Alice retira 1 eth factory
    for (let index = 0; index < accounts_to_use.length; index++) {
      const account = accounts_to_use[index];
      balances.sc.before_2 = (await factoryContract.getBalanceOf(account.address)).toString()
      balances.token.before_2 = (await tokenContract.balanceOf(account.address)).toString()
      let withdrawAllowance = await factoryContract.connect(account).increaseWithdrawalAllowance(amount);
      receipt = await withdrawAllowance.wait(waitConfirmations[network.config.type]);
      let withdraw = await factoryContract.connect(account).withdraw(amount);
      receipt = await withdraw.wait(waitConfirmations[network.config.type]);
      balances.sc.after_2 = (await factoryContract.getBalanceOf(account.address)).toString()
      balances.token.after_2 = (await tokenContract.balanceOf(account.address)).toString()
      expect(balances.sc.before_2 - balances.sc.after_2).to.be.equal(parseInt(amount));
      expect(balances.token.before_2 - balances.token.after_2).to.be.equal(parseInt(amount));
      expect(parseInt(balances.sc.after_2)).to.be.equal(parseInt(balances.sc.before_2)-parseInt(amount));
      expect(parseInt(balances.token.after_2)).to.be.equal(parseInt(balances.token.before_2)-parseInt(amount));
      console.log('OK: 2. Alice retira 1 eth factory at block', receipt.blockNumber);
    }
    
    // 3. Alice deposita 1 eth en sc1  (factory sal1)
    for (let index = 0; index < accounts_to_use.length; index++) {
      const account = accounts_to_use[index];
      balances.sc.before_3 = (await factoryContract.getBalanceOf(account.address)).toString()
      balances.token.before_3 = (await tokenContract.balanceOf(account.address)).toString()
      tx = await factoryContract.connect(account).fundMultipleContracts([salt], false, {
        value: amount
      });
      receipt = await tx.wait(waitConfirmations[network.config.type]);
      balances.sc.after_3 = (await factoryContract.getBalanceOf(account.address)).toString()
      balances.token.after_3 = (await tokenContract.balanceOf(account.address)).toString()
      expect(balances.sc.after_3 - balances.sc.before_3).to.be.equal(parseInt(amount));
      expect(balances.token.after_3 - balances.token.before_3).to.be.equal(parseInt(amount));
      console.log('OK: 3. Alice deposita 1 eth en sc1  (factory sal1) at block', receipt.blockNumber)
    }

    // 4. Alice deposita 1 eth en sc2 (factory sal2)
    for (let index = 0; index < accounts_to_use.length; index++) {
      const account = accounts_to_use[index];
      balances.sc.before_4 = (await factoryContract.getBalanceOf(account.address)).toString()
      balances.token.before_4 = (await tokenContract.balanceOf(account.address)).toString()
      tx = await factoryContract.connect(account).fundMultipleContracts([salt], false, {
        value: amount
      });
      receipt = await tx.wait(waitConfirmations[network.config.type]);
      balances.sc.after_4 = (await factoryContract.getBalanceOf(account.address)).toString()
      balances.token.after_4 = (await tokenContract.balanceOf(account.address)).toString()
      expect(balances.sc.after_4 - balances.sc.before_4).to.be.equal(parseInt(amount));
      expect(balances.token.after_4 - balances.token.before_4).to.be.equal(parseInt(amount));
      console.log('OK: 4. Alice deposita 1 eth en sc2 (factory sal2) at block', receipt.blockNumber)
    }

    // 5. Alice retira 2 eth factory
    for (let index = 0; index < accounts_to_use.length; index++) {
      const account = accounts_to_use[index];
      balances.sc.before_5 = (await factoryContract.getBalanceOf(account.address)).toString()
      balances.token.before_5 = (await tokenContract.balanceOf(account.address)).toString()
      let withdrawAmount = "2000000000000000000" // 2eth
      withdrawAllowance = await factoryContract.connect(account).increaseWithdrawalAllowance(withdrawAmount);
      receipt = await withdrawAllowance.wait(waitConfirmations[network.config.type]);
      withdraw = await factoryContract.connect(account).withdraw(withdrawAmount);
      receipt = await withdraw.wait(waitConfirmations[network.config.type]);
      balances.sc.after_5 = (await factoryContract.getBalanceOf(account.address)).toString()
      balances.token.after_5 = (await tokenContract.balanceOf(account.address)).toString()
      expect(balances.sc.before_5 - balances.sc.after_5).to.be.equal(parseInt(withdrawAmount));
      expect(balances.token.before_5 - balances.token.after_5).to.be.equal(parseInt(withdrawAmount));
      expect(parseInt(balances.sc.after_5)).to.be.equal(parseInt(balances.sc.before_5)-parseInt(withdrawAmount));
      expect(parseInt(balances.token.after_5)).to.be.equal(parseInt(balances.sc.before_5)-parseInt(withdrawAmount));
      console.log('OK: 5. Alice retira 2 eth factory at block', receipt.blockNumber)
    }

    // 6. Alice deposita 1 eth en sc1  (factory sal1)
    for (let index = 0; index < accounts_to_use.length; index++) {
      const account = accounts_to_use[index];
      let depositAmount = "1000000000000000000" // 2eth
      balances.sc.before_6 = (await factoryContract.getBalanceOf(account.address)).toString()
      balances.token.before_6 = (await tokenContract.balanceOf(account.address)).toString()
      tx = await factoryContract.connect(account).fundMultipleContracts([salt], false, {
        value: depositAmount
      });
      receipt = await tx.wait(waitConfirmations[network.config.type]);
      balances.sc.after_6 = (await factoryContract.getBalanceOf(account.address)).toString()
      balances.token.after_6 = (await tokenContract.balanceOf(account.address)).toString()
      expect(balances.sc.after_6 - balances.sc.before_6).to.be.equal(parseInt(depositAmount));
      expect(balances.token.after_6 - balances.token.before_6).to.be.equal(parseInt(depositAmount));
      console.log('OK: 6. Alice deposita 1 eth en sc1  (factory sal1) at block', receipt.blockNumber)
    }

    // 7. Bob deposita 1 en factory (factory salt1)
    for (let index = 0; index < accounts_to_use.length; index++) {
      const account = accounts_to_use[index];
      let depositAmount = "1000000000000000000" // 2eth
      balances.sc.before_7 = (await factoryContract.getBalanceOf(account.address)).toString()
      balances.token.before_7 = (await tokenContract.balanceOf(account.address)).toString()
      tx = await factoryContract.connect(account).fundMultipleContracts([salt], false, {
        value: depositAmount
      });
      receipt = await tx.wait(waitConfirmations[network.config.type]);
      balances.sc.after_7 = (await factoryContract.getBalanceOf(account.address)).toString()
      balances.token.after_7 = (await tokenContract.balanceOf(account.address)).toString()
      expect(balances.sc.after_7 - balances.sc.before_7).to.be.equal(parseInt(depositAmount));
      expect(balances.token.after_7 - balances.token.before_7).to.be.equal(parseInt(depositAmount));
      console.log('OK: 7. Bob deposita 1 eth en sc1  (factory sal1) at block', receipt.blockNumber)
    }

    // 8. Bob retira 0.5 eth factory
    deposit_service_contracts = {
      before: {},
      after: {},
    }
    deposit_service_contracts_indices = {
      before: {
        alice: {},
        bob: {},
      },
      after: {
        alice: {},
        bob: {},
      },
    }
    let acc_nm = ['alice', 'bob']
    for (let index = 0; index < accounts_to_use.length; index++) {
      const account = accounts_to_use[index];
      amount = "500000000000000000"
      balances.sc.before_8 = (await factoryContract.getBalanceOf(account.address)).toString()
      balances.token.before_8 = (await tokenContract.balanceOf(account.address)).toString()
      deposit_service_contracts.before[acc_nm[index]] = await factoryContract.getDepositServiceContract(account.address)
      withdrawAllowance = await factoryContract.connect(account).increaseWithdrawalAllowance(amount);
      receipt = await withdrawAllowance.wait(waitConfirmations[network.config.type]);
      withdraw = await factoryContract.connect(account).withdraw(amount);
      receipt = await withdraw.wait(waitConfirmations[network.config.type]);
      balances.sc.after_8 = (await factoryContract.getBalanceOf(account.address)).toString()
      balances.token.after_8 = (await tokenContract.balanceOf(account.address)).toString()
      deposit_service_contracts.after[acc_nm[index]] = await factoryContract.getDepositServiceContract(account.address)
      expect(balances.sc.before_8 - balances.sc.after_8).to.be.equal(parseInt(amount));
      expect(balances.token.before_8 - balances.token.after_8).to.be.equal(parseInt(amount));
      // deposit contracts mappings
      expect(deposit_service_contracts.before[acc_nm[index]].length).to.be.equal(deposit_service_contracts.after[acc_nm[index]].length);
      console.log('OK: 8. Bob retira 0.5 eth factory', receipt.blockNumber);
    }

    // 9. Alice retira 1 eth factory
    deposit_service_contracts = {
      before: {},
      after: {},
    }
    deposit_service_contracts_indices = {
      before: {
        alice: {},
        bob: {},
      },
      after: {
        alice: {},
        bob: {},
      },
    }
    for (let index = 0; index < accounts_to_use.length; index++) {
      const account = accounts_to_use[index];
      amount = "1000000000000000000"
      balances.sc.before_9 = (await factoryContract.getBalanceOf(account.address)).toString()
      balances.token.before_9 = (await tokenContract.balanceOf(account.address)).toString()
      deposit_service_contracts.before[acc_nm[index]] = await factoryContract.getDepositServiceContract(account.address)
      withdrawAllowance = await factoryContract.connect(account).increaseWithdrawalAllowance(amount);
      receipt = await withdrawAllowance.wait(waitConfirmations[network.config.type]);
      const tota = deposit_service_contracts.before[acc_nm[index]];
      for (let index = 0; index < tota.length; index++) {
        deposit_service_contracts_indices.before[acc_nm[index]][index] = tota[index] ?
          (await factoryContract.getDepositServiceContractIndex(account.address, tota[index])).toString() : 
          -1
      }
      withdraw = await factoryContract.connect(account).withdraw(amount);
      receipt = await withdraw.wait(waitConfirmations[network.config.type]);
      balances.sc.after_9 = (await factoryContract.getBalanceOf(account.address)).toString()
      balances.token.after_9 = (await tokenContract.balanceOf(account.address)).toString()
      deposit_service_contracts.after[acc_nm[index]] = await factoryContract.getDepositServiceContract(account.address)
      const totb = deposit_service_contracts.after[acc_nm[index]];
      for (let index = 0; index < totb.length; index++) {
        deposit_service_contracts_indices.after[acc_nm[index]][index] = totb[index] ?
          (await factoryContract.getDepositServiceContractIndex(account.address, totb[index])).toString() :
          -1
      }
      expect(parseInt(balances.sc.before_9) - parseInt(balances.sc.after_9)).to.be.equal(parseInt(amount));
      expect(parseInt(balances.token.before_9) - parseInt(balances.token.after_9)).to.be.equal(parseInt(amount));
      expect(parseInt(balances.sc.after_9)).to.be.equal(parseInt(balances.sc.before_9) - parseInt(amount));
      expect(parseInt(balances.token.after_9)).to.be.equal(parseInt(balances.token.before_9) - parseInt(amount));
      // service contracts checks
      // expect(deposit_service_contracts.before.alice.length).to.be.equal(1);
      expect(deposit_service_contracts.after[acc_nm[index]].length).to.be.equal(deposit_service_contracts.before[acc_nm[index]].length);
      // check its indices (if -1 means no existent)
      // todo aca
      // expect(parseInt(deposit_service_contracts_indices.after.alice[deposit_service_contracts_indices.after.alice.length-1])).to.be.equal(-1);
      console.log('OK: 9. Alice retira 1 eth factory at block', receipt.blockNumber);
    }

    // 10. Two users retira 0.5 eth factory
    // for (let index = 0; index < accounts_to_use.length; index++) {
    //   const account = accounts_to_use[index];
    //   // 10. Bob retira 0.5 eth factory
    //   amount = "500000000000000000"
    //   balances.sc.before_10 = (await factoryContract.getBalanceOf(account.address)).toString()
    //   balances.token.before_10 = (await tokenContract.balanceOf(account.address)).toString()
    //   deposit_service_contracts.before[acc_nm[index]] = await factoryContract.getDepositServiceContract(account.address)
    //   withdrawAllowance = await factoryContract.connect(account).increaseWithdrawalAllowance(amount);
    //   receipt = await withdrawAllowance.wait(waitConfirmations[network.config.type]);
    //   withdraw = await factoryContract.connect(account).withdraw(amount);
    //   receipt = await withdraw.wait(waitConfirmations[network.config.type]);
    //   balances.sc.after_10 = (await factoryContract.getBalanceOf(account.address)).toString()
    //   balances.token.after_10 = (await tokenContract.balanceOf(account.address)).toString()
    //   deposit_service_contracts.after[acc_nm[index]] = await factoryContract.getDepositServiceContract(account.address)
    //   expect(balances.sc.before_10 - balances.sc.after_10).to.be.equal(parseInt(amount));
    //   expect(balances.token.before_10 - balances.token.after_10).to.be.equal(parseInt(amount));
    //   // deposit contracts mappings
    //   // expect(deposit_service_contracts.before.bob.length).to.be.equal(1);
    //   expect(deposit_service_contracts.after[acc_nm[index]].length).to.be.equal(deposit_service_contracts.before[acc_nm[index]].length-1);
    //   console.log('OK: 10. Bob retira 0.5 eth factory at block', receipt.blockNumber);
    // }
    }
  });
});