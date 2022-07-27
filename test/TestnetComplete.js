const {deployments} = require('hardhat');
const {ethers} = require('hardhat');
const chai = require('chai');
require('solidity-coverage');
const expect = chai.expect;
const { deploymentVariables } = require("../helpers/variables");
const { network } = require("hardhat")

describe('TestnetComplete1', () => {
  let owner, alice, operator, bob;
  let factoryContract, serviceContractIndex, tokenContract;
  let serviceContracts = [];
  let deposit_service_contracts;
  let deposit_service_contracts_indices;

  beforeEach(async function () {
    if (network.config.type == 'hardhat') await deployments.fixture();
    [owner, alice, bob, operator] = await ethers.getSigners();
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
      1. Alice deposita 1 eth en sc1 (factory salt1)
      2. Alice retira 1 eth factory
      3. Alice deposita 1 eth en sc1  (factory sal1)
      4. Alice deposita 1 etg en sc2 (factory sal2)
      5. Alice retira 2 eth factory
      6. Alice deposita 2 eth  en sc1  (factory sal1)
      7. Alice transfiere a bob 1 eth
      8. Bob retira 0.5 eth factory
      9. Alice retira 1 eth factory
      10. Bob retira 0.5 eth factory
    */
    const { salt, sc } = serviceContracts[0];
    const { salt: salt1, sc: sc1 } = serviceContracts[1];
    let receipt;
    let balances = {
      sc: {},
      token: {}
    }
    let amount = "1000000000000000000" // 1eth

    // let scc = (await factoryContract.getDepositServiceContract(alice.address)).toString()
    // if (typeof(scc) == 'string') scc = [scc]
    // console.log(scc)
    // for (let index = 0; index < scc.length; index++) {
    //   const addr = scc[index];
    //   let scci = (await factoryContract.getDepositServiceContractIndex(alice.address, addr)).toString()
    //   console.log(scci)
    // }
    // return;
    let accounts_to_use = [alice]
    
    // 1. Alice deposita 1 eth en sc1 (factory salt1) 
    for (let index = 0; index < accounts_to_use.length; index++) {
      const account = accounts_to_use[index];
      balances.sc.before_1 = (await factoryContract.getBalanceOf(account.address)).toString()
      balances.token.before_1 = (await tokenContract.balanceOf(account.address)).toString()
      let tx = await factoryContract.connect(account).fundMultipleContracts([salt], false, {
        value: amount
      });
      receipt = await tx.wait(2);
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
      receipt = await withdrawAllowance.wait(2);
      let withdraw = await factoryContract.connect(account).withdraw(amount);
      receipt = await withdraw.wait(2);
      balances.sc.after_2 = (await factoryContract.getBalanceOf(account.address)).toString()
      balances.token.after_2 = (await tokenContract.balanceOf(account.address)).toString()
      expect(balances.sc.before_2 - balances.sc.after_2).to.be.equal(parseInt(amount));
      expect(balances.token.before_2 - balances.token.after_2).to.be.equal(parseInt(amount));
      expect(parseInt(balances.sc.after_2)).to.be.equal(parseInt(balances.sc.before_2)-parseInt(balances.sc.after_2)-parseInt(amount));
      expect(parseInt(balances.token.after_2)).to.be.equal(parseInt(balances.token.before_2)-parseInt(balances.token.after_2)-parseInt(amount));
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
      receipt = await tx.wait(2);
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
      tx = await factoryContract.connect(account).fundMultipleContracts([salt1], false, {
        value: amount
      });
      receipt = await tx.wait(2);
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
      receipt = await withdrawAllowance.wait(2);
      withdraw = await factoryContract.connect(account).withdraw(withdrawAmount);
      receipt = await withdraw.wait(2);
      balances.sc.after_5 = (await factoryContract.getBalanceOf(account.address)).toString()
      balances.token.after_5 = (await tokenContract.balanceOf(account.address)).toString()
      expect(balances.sc.before_5 - balances.sc.after_5).to.be.equal(parseInt(withdrawAmount));
      expect(balances.token.before_5 - balances.token.after_5).to.be.equal(parseInt(withdrawAmount));
      expect(parseInt(balances.sc.after_5)).to.be.equal(parseInt(balances.sc.before_5)-parseInt(balances.sc.after_5)-parseInt(withdrawAmount));
      expect(parseInt(balances.token.after_5)).to.be.equal(parseInt(balances.sc.before_5)-parseInt(balances.sc.after_5)-parseInt(withdrawAmount));
      console.log('OK: 5. Alice retira 2 eth factory at block', receipt.blockNumber)
    }

    // 6. Alice deposita 2 eth en sc1  (factory sal1)
    for (let index = 0; index < accounts_to_use.length; index++) {
      const account = accounts_to_use[index];
      let withdrawAmount = "2000000000000000000" // 2eth
      balances.sc.before_6 = (await factoryContract.getBalanceOf(account.address)).toString()
      balances.token.before_6 = (await tokenContract.balanceOf(account.address)).toString()
      tx = await factoryContract.connect(account).fundMultipleContracts([salt], false, {
        value: withdrawAmount
      });
      receipt = await tx.wait(2);
      balances.sc.after_6 = (await factoryContract.getBalanceOf(account.address)).toString()
      balances.token.after_6 = (await tokenContract.balanceOf(account.address)).toString()
      expect(balances.sc.after_6 - balances.sc.before_6).to.be.equal(parseInt(withdrawAmount));
      expect(balances.token.after_6 - balances.token.before_6).to.be.equal(parseInt(withdrawAmount));
      console.log('OK: 6. Alice deposita 2 eth en sc1  (factory sal1) at block', receipt.blockNumber)
    }

    // // 2. Alice retira 1 eth factory
    // for (let index = 0; index < accounts_to_use.length; index++) {
    //   let withdrawAmount = "2000000000000000000" // 2eth
    //   const account = accounts_to_use[index];
    //   balances.sc.before_2 = (await factoryContract.getBalanceOf(account.address)).toString()
    //   balances.token.before_2 = (await tokenContract.balanceOf(account.address)).toString()
    //   let withdrawAllowance = await factoryContract.connect(account).increaseWithdrawalAllowance(withdrawAmount);
    //   receipt = await withdrawAllowance.wait(2);
    //   let withdraw = await factoryContract.connect(account).withdraw(withdrawAmount);
    //   receipt = await withdraw.wait(2);
    //   balances.sc.after_2 = (await factoryContract.getBalanceOf(account.address)).toString()
    //   balances.token.after_2 = (await tokenContract.balanceOf(account.address)).toString()
    //   expect(balances.sc.before_2 - balances.sc.after_2).to.be.equal(parseInt(withdrawAmount));
    //   expect(balances.token.before_2 - balances.token.after_2).to.be.equal(parseInt(withdrawAmount));
    //   expect(parseInt(balances.sc.after_2)).to.be.equal(parseInt(balances.sc.before_2)-parseInt(balances.sc.after_2)-parseInt(withdrawAmount));
    //   expect(parseInt(balances.token.after_2)).to.be.equal(parseInt(balances.token.before_2)-parseInt(balances.token.after_2)-parseInt(withdrawAmount));
    //   console.log('OK: 2. Alice retira 1 eth factory at block', receipt.blockNumber);
    // }

    // 7. Alice transfiere a bob 1 eth
    let amountDeposit =  "2000000000000000000"
    let amountTransfer = "1000000000000000000"
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

    balances.sc.before_7 = {
      alice: (await factoryContract.getBalanceOf(alice.address)).toString(),
      bob: (await factoryContract.getBalanceOf(bob.address)).toString(),
    }
    balances.token.before_7 = {
      alice: (await tokenContract.balanceOf(alice.address)).toString(),
      bob: (await tokenContract.balanceOf(bob.address)).toString(),
    }

    deposit_service_contracts.before.alice = await factoryContract.getDepositServiceContract(alice.address)
    deposit_service_contracts.before.bob = await factoryContract.getDepositServiceContract(bob.address)
    for (let index = 0; index < serviceContractIndex; index++) {
      deposit_service_contracts_indices.before.alice[index] = deposit_service_contracts.before.alice[index] ?
        (await factoryContract.getDepositServiceContractIndex(alice.address, deposit_service_contracts.before.alice[index])).toString() : 
        -1
      deposit_service_contracts_indices.before.bob[index] = deposit_service_contracts.before.bob[index] ?
        (await factoryContract.getDepositServiceContractIndex(bob.address, deposit_service_contracts.before.bob[index])).toString() :
        -1
    }
    const txTranf = await tokenContract.connect(alice).transfer(bob.address, amountTransfer)
    receipt = await txTranf.wait(2);

    balances.sc.after_7 = {
      alice: (await factoryContract.getBalanceOf(alice.address)).toString(),
      bob: (await factoryContract.getBalanceOf(bob.address)).toString(),
    }
    balances.token.after_7 = {
      alice: (await tokenContract.balanceOf(alice.address)).toString(),
      bob: (await tokenContract.balanceOf(bob.address)).toString(),
    }

    deposit_service_contracts.after.alice = await factoryContract.getDepositServiceContract(alice.address)
    deposit_service_contracts.after.bob = await factoryContract.getDepositServiceContract(bob.address)
    for (let index = 0; index < serviceContractIndex; index++) {
      deposit_service_contracts_indices.after.alice[index] = deposit_service_contracts.after.alice[index] ?
        (await factoryContract.getDepositServiceContractIndex(alice.address, deposit_service_contracts.after.alice[index])).toString() :
        -1
      deposit_service_contracts_indices.after.bob[index] = deposit_service_contracts.after.bob[index] ?
        (await factoryContract.getDepositServiceContractIndex(bob.address, deposit_service_contracts.after.bob[index])).toString() :
        -1
    }
    expect(parseInt(balances.sc.before_7.alice) - parseInt(balances.sc.after_7.alice)).to.be.equal(parseInt(amountDeposit)-parseInt(amountTransfer));
    expect(parseInt(balances.sc.after_7.bob) - parseInt(balances.sc.before_7.bob)).to.be.equal(parseInt(amountTransfer));
    expect(parseInt(balances.token.before_7.alice) - parseInt(balances.token.after_7.alice)).to.be.equal(parseInt(amountDeposit)-parseInt(amountTransfer));
    expect(parseInt(balances.token.after_7.bob) - parseInt(balances.token.before_7.bob)).to.be.equal(parseInt(amountTransfer));
    // service contracts checks
    let lena = deposit_service_contracts.before.alice.length
    let lenb = deposit_service_contracts.after.bob.length
    expect(deposit_service_contracts.before.alice[lena-1]).to.be.equal(deposit_service_contracts.after.bob[lenb-1]);
    expect(deposit_service_contracts.after.alice.length).to.be.equal(lena); // should have same length
    expect(lenb).to.be.equal(deposit_service_contracts.before.bob.length+1);
    // check its indices (if -1 means no existent)
    let lenai = deposit_service_contracts_indices.before.alice.length
    let lenbi = deposit_service_contracts_indices.after.bob.length
    // todo aca
    // expect(parseInt(deposit_service_contracts_indices.before.alice[lenai-1])).to.be.equal(parseInt(deposit_service_contracts_indices.after.bob[lenbi-1]));
    console.log('OK: 7. Alice transfiere a bob 1 eth at block', receipt.blockNumber)

    // 8. Bob retira 0.5 eth factory
    amount = "500000000000000000"
    balances.sc.before_8 = (await factoryContract.getBalanceOf(bob.address)).toString()
    balances.token.before_8 = (await tokenContract.balanceOf(bob.address)).toString()
    deposit_service_contracts.before.bob = await factoryContract.getDepositServiceContract(bob.address)
    withdrawAllowance = await factoryContract.connect(bob).increaseWithdrawalAllowance(amount);
    receipt = await withdrawAllowance.wait(2);
    withdraw = await factoryContract.connect(bob).withdraw(amount);
    receipt = await withdraw.wait(2);
    balances.sc.after_8 = (await factoryContract.getBalanceOf(bob.address)).toString()
    balances.token.after_8 = (await tokenContract.balanceOf(bob.address)).toString()
    deposit_service_contracts.after.bob = await factoryContract.getDepositServiceContract(bob.address)
    expect(balances.sc.before_8 - balances.sc.after_8).to.be.equal(parseInt(amount));
    expect(balances.token.before_8 - balances.token.after_8).to.be.equal(parseInt(amount));
    // deposit contracts mappings
    expect(deposit_service_contracts.before.bob.length).to.be.equal(deposit_service_contracts.after.bob.length);
    console.log('OK: 8. Bob retira 0.5 eth factory', receipt.blockNumber);

    // 9. Alice retira 1 eth factory
    amount = "1000000000000000000"
    balances.sc.before_9 = (await factoryContract.getBalanceOf(alice.address)).toString()
    balances.token.before_9 = (await tokenContract.balanceOf(alice.address)).toString()
    deposit_service_contracts.before.alice = await factoryContract.getDepositServiceContract(alice.address)
    withdrawAllowance = await factoryContract.connect(alice).increaseWithdrawalAllowance(amount);
    receipt = await withdrawAllowance.wait(2);
    for (let index = 0; index < serviceContractIndex; index++) {
      deposit_service_contracts_indices.before.alice[index] = deposit_service_contracts.before.alice[index] ?
        (await factoryContract.getDepositServiceContractIndex(alice.address, deposit_service_contracts.before.alice[index])).toString() : 
        -1
    }
    withdraw = await factoryContract.connect(alice).withdraw(amount);
    receipt = await withdraw.wait(2);
    balances.sc.after_9 = (await factoryContract.getBalanceOf(alice.address)).toString()
    balances.token.after_9 = (await tokenContract.balanceOf(alice.address)).toString()
    deposit_service_contracts.after.alice = await factoryContract.getDepositServiceContract(alice.address)
    for (let index = 0; index < serviceContractIndex; index++) {
      deposit_service_contracts_indices.after.alice[index] = deposit_service_contracts.after.alice[index] ?
        (await factoryContract.getDepositServiceContractIndex(alice.address, deposit_service_contracts.after.alice[index])).toString() :
        -1
    }
    expect(parseInt(balances.sc.before_9) - parseInt(balances.sc.after_9)).to.be.equal(parseInt(amount));
    expect(parseInt(balances.token.before_9) - parseInt(balances.token.after_9)).to.be.equal(parseInt(amount));
    expect(parseInt(balances.sc.after_9)).to.be.equal(parseInt(balances.sc.before_9) - parseInt(balances.sc.after_9) - parseInt(amount));
    expect(parseInt(balances.token.after_9)).to.be.equal(parseInt(balances.token.before_9) - parseInt(balances.token.after_9) - parseInt(amount));
    // service contracts checks
    // expect(deposit_service_contracts.before.alice.length).to.be.equal(1);
    expect(deposit_service_contracts.after.alice.length).to.be.equal(deposit_service_contracts.before.alice.length-1);
    // check its indices (if -1 means no existent)
    // todo aca
    // expect(parseInt(deposit_service_contracts_indices.after.alice[deposit_service_contracts_indices.after.alice.length-1])).to.be.equal(-1);
    console.log('OK: 9. Alice retira 1 eth factory at block', receipt.blockNumber);

    // 10. Bob retira 0.5 eth factory
    amount = "500000000000000000"
    balances.sc.before_10 = (await factoryContract.getBalanceOf(bob.address)).toString()
    balances.token.before_10 = (await tokenContract.balanceOf(bob.address)).toString()
    deposit_service_contracts.before.bob = await factoryContract.getDepositServiceContract(bob.address)
    withdrawAllowance = await factoryContract.connect(bob).increaseWithdrawalAllowance(amount);
    receipt = await withdrawAllowance.wait(2);
    withdraw = await factoryContract.connect(bob).withdraw(amount);
    receipt = await withdraw.wait(2);
    balances.sc.after_10 = (await factoryContract.getBalanceOf(bob.address)).toString()
    balances.token.after_10 = (await tokenContract.balanceOf(bob.address)).toString()
    deposit_service_contracts.after.bob = await factoryContract.getDepositServiceContract(bob.address)
    expect(balances.sc.before_10 - balances.sc.after_10).to.be.equal(parseInt(amount));
    expect(balances.token.before_10 - balances.token.after_10).to.be.equal(parseInt(amount));
    // deposit contracts mappings
    // expect(deposit_service_contracts.before.bob.length).to.be.equal(1);
    expect(deposit_service_contracts.after.bob.length).to.be.equal(deposit_service_contracts.before.bob.length-1);
    console.log('OK: 10. Bob retira 0.5 eth factory at block', receipt.blockNumber);
  });
});