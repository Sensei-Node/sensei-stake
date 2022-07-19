const {deployments} = require('hardhat');
const {ethers} = require('hardhat');
const chai = require('chai');
const expect = chai.expect;
const { network } = require("hardhat")

describe('TransferToken', () => {
  let owner, alice, operator, bob;
  let factoryContract, serviceContractIndex, tokenContract;
  let serviceContracts = [];
  let allowances, balances, deposit_service_contracts;
  let deposit_service_contracts_indices, deposit_service_contracts_indices1, deposit_service_contracts_indices2;

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

  describe('1. should transfer full ownership of eth deposit and token', () => {
    beforeEach(async function () {
      allowances = {
        before: {},
        after_allowance: {},
        after_transfer: {},
      }
      deposit_service_contracts = {
        before: {},
        after: {},
      }
      deposit_service_contracts_indices = {
        before: {},
        after: {},
      }
      balances = {
        sc: {},
        token: {}
      }
      const { salt, sc } = serviceContracts[0];
      let amount = "1000000000000000000"
      const tx = await factoryContract.connect(alice).fundMultipleContracts([salt], false, {
        value: amount
      });
      balances.sc.before = {
        alice: (await sc.getDeposit(alice.address)).toString(),
        bob: (await sc.getDeposit(bob.address)).toString(),
      }
      balances.token.before = {
        alice: (await tokenContract.balanceOf(alice.address)).toString(),
        bob: (await tokenContract.balanceOf(bob.address)).toString(),
      }
      
      deposit_service_contracts.before.alice = await factoryContract.getDepositServiceContract(alice.address)
      deposit_service_contracts.before.bob = await factoryContract.getDepositServiceContract(bob.address)
      deposit_service_contracts_indices.before.alice = deposit_service_contracts.before.alice[0] ?
        (await factoryContract.getDepositServiceContractIndex(alice.address, deposit_service_contracts.before.alice[0])).toString() : 
        -1

      deposit_service_contracts_indices.before.bob = deposit_service_contracts.before.bob[0] ?
        (await factoryContract.getDepositServiceContractIndex(bob.address, deposit_service_contracts.before.bob[0])).toString() :
        -1
      
      allowances.before.alice = (await sc.withdrawalAllowance(alice.address, tokenContract.address)).toString()
      allowances.before.bob = (await sc.withdrawalAllowance(bob.address, tokenContract.address)).toString()
      
      const txTranf = await tokenContract.connect(alice).transfer(bob.address, amount)
      balances.sc.after = {
        alice: (await sc.getDeposit(alice.address)).toString(),
        bob: (await sc.getDeposit(bob.address)).toString(),
      }
      balances.token.after = {
        alice: (await tokenContract.balanceOf(alice.address)).toString(),
        bob: (await tokenContract.balanceOf(bob.address)).toString(),
      }

      deposit_service_contracts.after.alice = await factoryContract.getDepositServiceContract(alice.address)
      deposit_service_contracts.after.bob = await factoryContract.getDepositServiceContract(bob.address)
      deposit_service_contracts_indices.after.alice = deposit_service_contracts.after.alice[0] ?
        (await factoryContract.getDepositServiceContractIndex(alice.address, deposit_service_contracts.after.alice[0])).toString() :
        -1
      deposit_service_contracts_indices.after.bob = deposit_service_contracts.after.bob[0] ?
        (await factoryContract.getDepositServiceContractIndex(bob.address, deposit_service_contracts.after.bob[0])).toString() :
        -1

      allowances.after_transfer.alice = (await sc.withdrawalAllowance(alice.address, tokenContract.address)).toString()
      allowances.after_transfer.bob = (await sc.withdrawalAllowance(bob.address, tokenContract.address)).toString()
    });
    it('1.1 full ownership transfer: should get rid of alice allowances', async () => {
      // const { salt, sc } = serviceContracts[0];
      let amount = "1000000000000000000"
      // should initialize with zero allowances
      expect(parseInt(allowances.before.alice)).to.be.equal(parseInt(0));
      expect(parseInt(allowances.before.bob)).to.be.equal(parseInt(0));
      // finally after transfer allowances should go back to allowances[t-1] - amount (in this case 0)
      expect(parseInt(allowances.after_transfer.alice)).to.be.equal(parseInt(0));
      expect(parseInt(allowances.after_transfer.bob)).to.be.equal(parseInt(0));
    });
    it('1.2 full ownership transfer: should perform transfer of token and service contract balance', async () => {
      // const { salt, sc } = serviceContracts[0];
      let amount = "1000000000000000000"
      expect(parseInt(balances.sc.before.alice) - parseInt(balances.sc.after.alice)).to.be.equal(parseInt(amount));
      expect(parseInt(balances.sc.after.bob) - parseInt(balances.sc.before.bob)).to.be.equal(parseInt(amount));
      expect(parseInt(balances.token.before.alice) - parseInt(balances.token.after.alice)).to.be.equal(parseInt(amount));
      expect(parseInt(balances.token.after.bob) - parseInt(balances.token.before.bob)).to.be.equal(parseInt(amount));
    });
    it('1.3 full ownership transfer: get rid of allowedServiceContracts (and indices) for alice, and add it to bob', async () => {
      // const { salt, sc } = serviceContracts[0];
      // check the contracts addresses
      expect(deposit_service_contracts.before.alice[0]).to.be.equal(deposit_service_contracts.after.bob[0]);
      expect(deposit_service_contracts.before.bob.length).to.be.equal(0);
      expect(deposit_service_contracts.after.alice.length).to.be.equal(0);
      // check its indices (if -1 means no existent)
      expect(parseInt(deposit_service_contracts_indices.before.alice)).to.be.equal(parseInt(deposit_service_contracts_indices.after.bob));
      expect(parseInt(deposit_service_contracts_indices.before.bob)).to.be.equal(-1);
      expect(parseInt(deposit_service_contracts_indices.after.alice)).to.be.equal(-1);
    });
  });

  describe('2. should transfer ownership of eth deposit and token, but bob deposited before in the same SC', () => {
    beforeEach(async function () {
      allowances = {
        before: {},
        after_allowance: {},
        after_transfer: {},
      }
      deposit_service_contracts = {
        before: {},
        after: {},
      }
      deposit_service_contracts_indices = {
        before: {},
        after: {},
      }
      balances = {
        sc: {},
        token: {}
      }
      const { salt, sc } = serviceContracts[0];
      let amount = "1000000000000000000"
      const txAlice = await factoryContract.connect(alice).fundMultipleContracts([salt], false, {
        value: amount
      });

      const txBob = await factoryContract.connect(bob).fundMultipleContracts([salt], false, {
        value: amount
      });
      balances.sc.before = {
        alice: (await sc.getDeposit(alice.address)).toString(),
        bob: (await sc.getDeposit(bob.address)).toString(),
      }
      balances.token.before = {
        alice: (await tokenContract.balanceOf(alice.address)).toString(),
        bob: (await tokenContract.balanceOf(bob.address)).toString(),
      }
      
      deposit_service_contracts.before.alice = await factoryContract.getDepositServiceContract(alice.address)
      deposit_service_contracts.before.bob = await factoryContract.getDepositServiceContract(bob.address)
      deposit_service_contracts_indices.before.alice = deposit_service_contracts.before.alice[0] ?
        (await factoryContract.getDepositServiceContractIndex(alice.address, deposit_service_contracts.before.alice[0])).toString() : 
        -1
      deposit_service_contracts_indices.before.bob = deposit_service_contracts.before.bob[0] ?
        (await factoryContract.getDepositServiceContractIndex(bob.address, deposit_service_contracts.before.bob[0])).toString() :
        -1
      
      allowances.before.alice = (await sc.withdrawalAllowance(alice.address, tokenContract.address)).toString()
      allowances.before.bob = (await sc.withdrawalAllowance(bob.address, tokenContract.address)).toString()
      
      const txTranf = await tokenContract.connect(alice).transfer(bob.address, amount)
      
      balances.sc.after = {
        alice: (await sc.getDeposit(alice.address)).toString(),
        bob: (await sc.getDeposit(bob.address)).toString(),
      }
      balances.token.after = {
        alice: (await tokenContract.balanceOf(alice.address)).toString(),
        bob: (await tokenContract.balanceOf(bob.address)).toString(),
      }

      deposit_service_contracts.after.alice = await factoryContract.getDepositServiceContract(alice.address)
      deposit_service_contracts.after.bob = await factoryContract.getDepositServiceContract(bob.address)
      deposit_service_contracts_indices.after.alice = deposit_service_contracts.after.alice[0] ?
        (await factoryContract.getDepositServiceContractIndex(alice.address, deposit_service_contracts.after.alice[0])).toString() :
        -1
      deposit_service_contracts_indices.after.bob = deposit_service_contracts.after.bob[0] ?
        (await factoryContract.getDepositServiceContractIndex(bob.address, deposit_service_contracts.after.bob[0])).toString() :
        -1

      allowances.after_transfer.alice = (await sc.withdrawalAllowance(alice.address, tokenContract.address)).toString()
      allowances.after_transfer.bob = (await sc.withdrawalAllowance(bob.address, tokenContract.address)).toString()
    });
    it('2.1 full ownership transfer: should get rid of alice allowances', async () => {
      // const { salt, sc } = serviceContracts[0];
      let amount = "1000000000000000000"
      // should initialize with zero allowances
      expect(parseInt(allowances.before.alice)).to.be.equal(parseInt(0));
      expect(parseInt(allowances.before.bob)).to.be.equal(parseInt(0));
      // finally after transfer allowances should go back to allowances[t-1] - amount (in this case 0)
      expect(parseInt(allowances.after_transfer.alice)).to.be.equal(parseInt(0));
      expect(parseInt(allowances.after_transfer.bob)).to.be.equal(parseInt(0));
    });
    it('2.2 full ownership transfer: should perform transfer of token and service contract balance', async () => {
      // const { salt, sc } = serviceContracts[0];
      let amountAlice = "1000000000000000000"
      let amountBob = "1000000000000000000"
      expect(parseInt(balances.sc.before.alice) - parseInt(balances.sc.after.alice)).to.be.equal(parseInt(amountAlice));
      expect(parseInt(balances.sc.after.bob) - parseInt(balances.sc.before.bob)).to.be.equal(parseInt(amountBob));
      expect(parseInt(balances.token.before.alice) - parseInt(balances.token.after.alice)).to.be.equal(parseInt(amountAlice));
      expect(parseInt(balances.token.after.bob)).to.be.equal(parseInt(amountAlice)+parseInt(amountBob));
    });
    it('2.3 full ownership transfer: get rid of allowedServiceContracts (and indices) for alice, and add it to bob', async () => {
      expect(deposit_service_contracts.before.alice[0]).to.be.equal(deposit_service_contracts.after.bob[0]);
      expect(deposit_service_contracts.before.bob.length).to.be.equal(1);
      expect(deposit_service_contracts.after.alice.length).to.be.equal(0);
      // check its indices (if -1 means no existent)
      expect(parseInt(deposit_service_contracts_indices.before.alice)).to.be.equal(parseInt(deposit_service_contracts_indices.before.bob));
      expect(parseInt(deposit_service_contracts_indices.before.bob)).to.be.equal(0);
      expect(parseInt(deposit_service_contracts_indices.after.bob)).to.be.equal(1);
      expect(parseInt(deposit_service_contracts_indices.after.alice)).to.be.equal(-1);
    });
  });

  describe('3. should transfer ownership of eth deposit and token, but bob deposited before in the another SC', () => {
    beforeEach(async function () {
      allowances = {
        before: {},
        after_allowance: {},
        after_transfer: {},
      }
      deposit_service_contracts = {
        before: {},
        after: {},
      }
      deposit_service_contracts_indices = {
        before: {},
        after: {},
      }
      deposit_service_contracts_indices2 = {
        before: {},
        after: {},
      }
      balances = {
        sc: {},
        sc1: {},
        token: {}
      }
      const { salt, sc } = serviceContracts[0];
      const { salt:salt1, sc:sc1} = serviceContracts[1];
      let amount = "1000000000000000000"
      const txAlice = await factoryContract.connect(alice).fundMultipleContracts([salt], false, {
        value: amount
      });

      const txBob = await factoryContract.connect(bob).fundMultipleContracts([salt1], false, {
        value: amount
      });
      balances.sc.before = {
        alice: (await sc.getDeposit(alice.address)).toString(),
        bob: (await sc.getDeposit(bob.address)).toString(),
      }
      balances.sc1.before = {
        alice: (await sc1.getDeposit(alice.address)).toString(),
        bob: (await sc1.getDeposit(bob.address)).toString(),
      }
      balances.token.before = {
        alice: (await tokenContract.balanceOf(alice.address)).toString(),
        bob: (await tokenContract.balanceOf(bob.address)).toString(),
      }
      
      deposit_service_contracts.before.alice = await factoryContract.getDepositServiceContract(alice.address)
      deposit_service_contracts.before.bob = await factoryContract.getDepositServiceContract(bob.address)
      deposit_service_contracts_indices.before.alice = deposit_service_contracts.before.alice[0] ?
        (await factoryContract.getDepositServiceContractIndex(alice.address, deposit_service_contracts.before.alice[0])).toString() : 
        -1

      deposit_service_contracts_indices.before.bob = deposit_service_contracts.before.bob[0] ?
        (await factoryContract.getDepositServiceContractIndex(bob.address, deposit_service_contracts.before.bob[0])).toString() :
        -1
      deposit_service_contracts_indices2.before.alice = deposit_service_contracts.before.alice[1] ?
        (await factoryContract.getDepositServiceContractIndex(alice.address, deposit_service_contracts.before.alice[1])).toString() : 
        -1

      deposit_service_contracts_indices2.before.bob = deposit_service_contracts.before.bob[1] ?
        (await factoryContract.getDepositServiceContractIndex(bob.address, deposit_service_contracts.before.bob[1])).toString() :
        -1
      
      allowances.before.alice = (await sc.withdrawalAllowance(alice.address, tokenContract.address)).toString()
      allowances.before.bob = (await sc.withdrawalAllowance(bob.address, tokenContract.address)).toString()
      
      const txTranf = await tokenContract.connect(alice).transfer(bob.address, amount)
      
      balances.sc.after = {
        alice: (await sc.getDeposit(alice.address)).toString(),
        bob: (await sc.getDeposit(bob.address)).toString(),
      }
      balances.sc1.after = {
        alice: (await sc1.getDeposit(alice.address)).toString(),
        bob: (await sc1.getDeposit(bob.address)).toString(),
      }
      balances.token.after = {
        alice: (await tokenContract.balanceOf(alice.address)).toString(),
        bob: (await tokenContract.balanceOf(bob.address)).toString(),
      }

      deposit_service_contracts.after.alice = await factoryContract.getDepositServiceContract(alice.address)
      deposit_service_contracts.after.bob = await factoryContract.getDepositServiceContract(bob.address)

      deposit_service_contracts_indices.after.alice = deposit_service_contracts.after.alice[0] ?
        (await factoryContract.getDepositServiceContractIndex(alice.address, deposit_service_contracts.after.alice[0])).toString() :
        -1

      deposit_service_contracts_indices.after.bob = deposit_service_contracts.after.bob[0] ?
        (await factoryContract.getDepositServiceContractIndex(bob.address, deposit_service_contracts.after.bob[0])).toString() :
        -1
      deposit_service_contracts_indices2.after.alice = deposit_service_contracts.after.alice[1] ?
        (await factoryContract.getDepositServiceContractIndex(alice.address, deposit_service_contracts.after.alice[1])).toString() :
        -1

      deposit_service_contracts_indices2.after.bob = deposit_service_contracts.after.bob[1] ?
        (await factoryContract.getDepositServiceContractIndex(bob.address, deposit_service_contracts.after.bob[1])).toString() :
        -1

      allowances.after_transfer.alice = (await sc.withdrawalAllowance(alice.address, tokenContract.address)).toString()
      allowances.after_transfer.bob = (await sc.withdrawalAllowance(bob.address, tokenContract.address)).toString()
    });
    it('3.1 full ownership transfer: should get rid of alice allowances', async () => {
      let amount = "1000000000000000000"
      // should initialize with zero allowances
      expect(parseInt(allowances.before.alice)).to.be.equal(parseInt(0));
      expect(parseInt(allowances.before.bob)).to.be.equal(parseInt(0));
      // finally after transfer allowances should go back to allowances[t-1] - amount (in this case 0)
      expect(parseInt(allowances.after_transfer.alice)).to.be.equal(parseInt(0));
      expect(parseInt(allowances.after_transfer.bob)).to.be.equal(parseInt(0));
    });
    it('3.2 full ownership transfer: should perform transfer of token and service contract balance', async () => {
      // const { salt, sc } = serviceContracts[0];
      let amountAlice = "1000000000000000000"
      let amountBob = "1000000000000000000"
      expect(parseInt(balances.sc.before.alice) - parseInt(balances.sc.after.alice)).to.be.equal(parseInt(amountAlice));
      expect(parseInt(balances.sc1.before.alice) - parseInt(balances.sc1.after.alice)).to.be.equal(parseInt(0));
      expect(parseInt(balances.sc.after.bob) - parseInt(balances.sc.before.bob)).to.be.equal(parseInt(amountAlice));
      expect(parseInt(balances.sc1.after.bob) - parseInt(balances.sc1.before.bob)).to.be.equal(parseInt(0));
      expect(parseInt(balances.token.before.alice) - parseInt(balances.token.after.alice)).to.be.equal(parseInt(amountAlice));
      expect(parseInt(balances.token.after.bob)).to.be.equal(parseInt(amountAlice)+parseInt(amountBob));
    });
    it('3.3 full ownership transfer: get rid of allowedServiceContracts (and indices) for alice, and add it to bob', async () => {
      expect(deposit_service_contracts.before.alice[0]).to.be.equal(deposit_service_contracts.after.bob[1]);
      expect(deposit_service_contracts.before.bob.length).to.be.equal(1);
      expect(deposit_service_contracts.after.bob.length).to.be.equal(2);
      expect(deposit_service_contracts.before.alice.length).to.be.equal(1);
      expect(deposit_service_contracts.after.alice.length).to.be.equal(0);
      // check its indices (if -1 means no existent)
      // check its indices (if -1 means no existent)
      expect(parseInt(deposit_service_contracts_indices.before.alice)).to.be.equal(parseInt(deposit_service_contracts_indices.before.bob));
      expect(parseInt(deposit_service_contracts_indices.before.bob)).to.be.equal(0);
      expect(parseInt(deposit_service_contracts_indices.after.bob)).to.be.equal(0);
      expect(parseInt(deposit_service_contracts_indices.after.alice)).to.be.equal(-1);
      expect(parseInt(deposit_service_contracts_indices2.after.bob)).to.be.equal(1);
      expect(parseInt(deposit_service_contracts_indices2.after.alice)).to.be.equal(-1);
    });
  });

  describe('4. should transfer full ownership of eth deposit and token, deposit was made to 3 different SC', () => {
    beforeEach(async function () {
      allowances = {
        before: {},
        after_allowance: {},
        after_transfer: {},
      }
      deposit_service_contracts = {
        before: {},
        after: {},
      }
      deposit_service_contracts_indices = {
        before: {
          alice: {},
          bob: {}
        },
        after: {
          alice: {},
          bob: {}
        },
      }
      balances = {
        sc: {},
        sc1: {},
        sc2: {},
        token: {}
      }
      const { salt, sc } = serviceContracts[0];
      const { salt: salt1, sc: sc1} = serviceContracts[1];
      const { salt: salt2, sc: sc2} = serviceContracts[2];
      let amountDeposit =   "2000000000000000000"
      let amountTransfer =  "6000000000000000000"

      const txAlice = await factoryContract.connect(alice).fundMultipleContracts([salt], false, {
        value: amountDeposit
      });
      const txAlice2 = await factoryContract.connect(alice).fundMultipleContracts([salt1], false, {
        value: amountDeposit
      });
      const txAlice3 = await factoryContract.connect(alice).fundMultipleContracts([salt2], false, {
        value: amountDeposit
      });

      balances.sc.before = {
        alice: (await sc.getDeposit(alice.address)).toString(),
        bob: (await sc.getDeposit(bob.address)).toString(),
      }
      balances.sc1.before = {
        alice: (await sc1.getDeposit(alice.address)).toString(),
        bob: (await sc1.getDeposit(bob.address)).toString(),
      }
      balances.sc2.before = {
        alice: (await sc2.getDeposit(alice.address)).toString(),
        bob: (await sc2.getDeposit(bob.address)).toString(),
      }
      balances.token.before = {
        alice: (await tokenContract.balanceOf(alice.address)).toString(),
        bob: (await tokenContract.balanceOf(bob.address)).toString(),
      }
      
      deposit_service_contracts.before.alice = await factoryContract.getDepositServiceContract(alice.address)
      deposit_service_contracts.before.bob = await factoryContract.getDepositServiceContract(bob.address)
      
      for (let index = 1; index <= 3; index++) {
        deposit_service_contracts_indices.before.alice[index] = deposit_service_contracts.before.alice[index-1] ?
          (await factoryContract.getDepositServiceContractIndex(alice.address, deposit_service_contracts.before.alice[index-1])).toString() : 
          -1
        deposit_service_contracts_indices.before.bob[index] = deposit_service_contracts.before.bob[index-1] ?
          (await factoryContract.getDepositServiceContractIndex(bob.address, deposit_service_contracts.before.bob[index-1])).toString() :
          -1
      }
      
      allowances.before.alice = {
        0: (await sc.withdrawalAllowance(alice.address, tokenContract.address)).toString(),
        1: (await sc1.withdrawalAllowance(alice.address, tokenContract.address)).toString(),
        2: (await sc2.withdrawalAllowance(alice.address, tokenContract.address)).toString(),
      }
      allowances.before.bob = {
        0: (await sc.withdrawalAllowance(bob.address, tokenContract.address)).toString(),
        1: (await sc1.withdrawalAllowance(bob.address, tokenContract.address)).toString(),
        2: (await sc2.withdrawalAllowance(bob.address, tokenContract.address)).toString(),
      }
      
      const txTranf = await tokenContract.connect(alice).transfer(bob.address, amountTransfer)
      
      balances.sc.after = {
        alice: (await sc.getDeposit(alice.address)).toString(),
        bob: (await sc.getDeposit(bob.address)).toString(),
      }
      balances.sc1.after = {
        alice: (await sc1.getDeposit(alice.address)).toString(),
        bob: (await sc1.getDeposit(bob.address)).toString(),
      }
      balances.sc2.after = {
        alice: (await sc2.getDeposit(alice.address)).toString(),
        bob: (await sc2.getDeposit(bob.address)).toString(),
      }
      balances.token.after = {
        alice: (await tokenContract.balanceOf(alice.address)).toString(),
        bob: (await tokenContract.balanceOf(bob.address)).toString(),
      }

      deposit_service_contracts.after.alice = await factoryContract.getDepositServiceContract(alice.address)
      deposit_service_contracts.after.bob = await factoryContract.getDepositServiceContract(bob.address)

      for (let index = 1; index <= 3; index++) {
        deposit_service_contracts_indices.after.alice[index] = deposit_service_contracts.after.alice[index-1] ?
          (await factoryContract.getDepositServiceContractIndex(alice.address, deposit_service_contracts.after.alice[index-1])).toString() :
          -1
        deposit_service_contracts_indices.after.bob[index] = deposit_service_contracts.after.bob[index-1] ?
          (await factoryContract.getDepositServiceContractIndex(bob.address, deposit_service_contracts.after.bob[index-1])).toString() :
          -1
      }

      allowances.after_transfer.alice = {
        0: (await sc.withdrawalAllowance(alice.address, tokenContract.address)).toString(),
        1: (await sc1.withdrawalAllowance(alice.address, tokenContract.address)).toString(),
        2: (await sc2.withdrawalAllowance(alice.address, tokenContract.address)).toString(),
      }
      allowances.after_transfer.bob = {
        0: (await sc.withdrawalAllowance(bob.address, tokenContract.address)).toString(),
        1: (await sc1.withdrawalAllowance(bob.address, tokenContract.address)).toString(),
        2: (await sc2.withdrawalAllowance(bob.address, tokenContract.address)).toString(),
      }
    });
    it('4.1 full ownership transfer: should get rid of alice allowances', async () => {
      let amount = "2000000000000000000"
      // should initialize with zero allowances
      expect(parseInt(allowances.before.alice[0])).to.be.equal(parseInt(0));
      expect(parseInt(allowances.before.alice[1])).to.be.equal(parseInt(0));
      expect(parseInt(allowances.before.alice[2])).to.be.equal(parseInt(0));
      expect(parseInt(allowances.before.bob[0])).to.be.equal(parseInt(0));
      expect(parseInt(allowances.before.bob[1])).to.be.equal(parseInt(0));
      expect(parseInt(allowances.before.bob[2])).to.be.equal(parseInt(0));
      // finally after transfer allowances should go back to allowances[t-1] - amount (in this case 0)
      expect(parseInt(allowances.after_transfer.alice[0])).to.be.equal(parseInt(0));
      expect(parseInt(allowances.after_transfer.alice[1])).to.be.equal(parseInt(0));
      expect(parseInt(allowances.after_transfer.alice[2])).to.be.equal(parseInt(0));
      expect(parseInt(allowances.after_transfer.bob[0])).to.be.equal(parseInt(0));
      expect(parseInt(allowances.after_transfer.bob[1])).to.be.equal(parseInt(0));
      expect(parseInt(allowances.after_transfer.bob[2])).to.be.equal(parseInt(0));
    });
    it('4.2 full ownership transfer: should perform transfer of token and service contract balance', async () => {
      let amount =         "2000000000000000000"
      let amountTransfer = "6000000000000000000"
      expect(parseInt(balances.sc.before.alice) - parseInt(balances.sc.after.alice)).to.be.equal(parseInt(amount));
      expect(parseInt(balances.sc1.before.alice) - parseInt(balances.sc1.after.alice)).to.be.equal(parseInt(amount));
      expect(parseInt(balances.sc2.before.alice) - parseInt(balances.sc2.after.alice)).to.be.equal(parseInt(amount));
      expect(parseInt(balances.sc.after.bob) - parseInt(balances.sc.before.bob)).to.be.equal(parseInt(amount));
      expect(parseInt(balances.sc1.after.bob) - parseInt(balances.sc1.before.bob)).to.be.equal(parseInt(amount));
      expect(parseInt(balances.sc2.after.bob) - parseInt(balances.sc2.before.bob)).to.be.equal(parseInt(amount));

      expect(parseInt(balances.token.before.alice) - parseInt(balances.token.after.alice)).to.be.equal(parseInt(amountTransfer));
      expect(parseInt(balances.token.after.bob)).to.be.equal(parseInt(amountTransfer));
    });
    it('4.3 full ownership transfer: get rid of allowedServiceContracts (and indices) for alice, and add it to bob', async () => {
      expect(deposit_service_contracts.before.alice.length).to.be.equal(3);
      expect(deposit_service_contracts.after.alice.length).to.be.equal(0);
      expect(deposit_service_contracts.before.bob.length).to.be.equal(0);
      expect(deposit_service_contracts.after.bob.length).to.be.equal(3);
      for (let index = 1; index <= 3; index++) {
        // service contract address checks, mirrored checking.
        const len = deposit_service_contracts.after.bob.length;
        expect(deposit_service_contracts.before.alice[index-1]).to.be.equal(deposit_service_contracts.after.bob[len-index]);
        // index checks
        expect(parseInt(deposit_service_contracts_indices.before.bob[index])).to.be.equal(parseInt(deposit_service_contracts_indices.after.alice[index]));
        expect(parseInt(deposit_service_contracts_indices.after.bob[index])).to.be.equal(parseInt(deposit_service_contracts_indices.before.alice[index]));
      }
    });
  });

  describe('5. should share ownership given that 0.5 token out of 1 token was transfered', () => {
    beforeEach(async function () {
      allowances = {
        before: {},
        after_allowance: {},
        after_transfer: {},
      }
      deposit_service_contracts = {
        before: {},
        after: {},
      }
      deposit_service_contracts_indices = {
        before: {},
        after: {},
      }
      balances = {
        sc: {},
        token: {}
      }
      const { salt, sc } = serviceContracts[0];
      let amountDeposit = "1000000000000000000"
      let amountTransfer = "500000000000000000"
      const tx = await factoryContract.connect(alice).fundMultipleContracts([salt], false, {
        value: amountDeposit
      });
      balances.sc.before = {
        alice: (await sc.getDeposit(alice.address)).toString(),
        bob: (await sc.getDeposit(bob.address)).toString(),
      }
      balances.token.before = {
        alice: (await tokenContract.balanceOf(alice.address)).toString(),
        bob: (await tokenContract.balanceOf(bob.address)).toString(),
      }
      
      deposit_service_contracts.before.alice = await factoryContract.getDepositServiceContract(alice.address)
      deposit_service_contracts.before.bob = await factoryContract.getDepositServiceContract(bob.address)
      deposit_service_contracts_indices.before.alice = deposit_service_contracts.before.alice[0] ?
        (await factoryContract.getDepositServiceContractIndex(alice.address, deposit_service_contracts.before.alice[0])).toString() : 
        -1
      deposit_service_contracts_indices.before.bob = deposit_service_contracts.before.bob[0] ?
        (await factoryContract.getDepositServiceContractIndex(bob.address, deposit_service_contracts.before.bob[0])).toString() :
        -1
 
      allowances.before.alice = (await sc.withdrawalAllowance(alice.address, tokenContract.address)).toString()
      allowances.before.bob = (await sc.withdrawalAllowance(bob.address, tokenContract.address)).toString()

      const txTranf = await tokenContract.connect(alice).transfer(bob.address, amountTransfer)
      
      balances.sc.after = {
        alice: (await sc.getDeposit(alice.address)).toString(),
        bob: (await sc.getDeposit(bob.address)).toString(),
      }
      balances.token.after = {
        alice: (await tokenContract.balanceOf(alice.address)).toString(),
        bob: (await tokenContract.balanceOf(bob.address)).toString(),
      }

      deposit_service_contracts.after.alice = await factoryContract.getDepositServiceContract(alice.address)
      deposit_service_contracts.after.bob = await factoryContract.getDepositServiceContract(bob.address)
      deposit_service_contracts_indices.after.alice = deposit_service_contracts.after.alice[0] ?
        (await factoryContract.getDepositServiceContractIndex(alice.address, deposit_service_contracts.after.alice[0])).toString() :
        -1
      deposit_service_contracts_indices.after.bob = deposit_service_contracts.after.bob[0] ?
        (await factoryContract.getDepositServiceContractIndex(bob.address, deposit_service_contracts.after.bob[0])).toString() :
        -1

      allowances.after_transfer.alice = (await sc.withdrawalAllowance(alice.address, tokenContract.address)).toString()
      allowances.after_transfer.bob = (await sc.withdrawalAllowance(bob.address, tokenContract.address)).toString()
    });
    it('5.1 full ownership transfer: should get rid of alice allowances', async () => {
      // const { salt, sc } = serviceContracts[0];
      let amount = "500000000000000000"
      // should initialize with zero allowances
      expect(parseInt(allowances.before.alice)).to.be.equal(parseInt(0));
      expect(parseInt(allowances.before.bob)).to.be.equal(parseInt(0));
      // finally after transfer allowances should go back to allowances[t-1] - amount (in this case 0)
      expect(parseInt(allowances.after_transfer.alice)).to.be.equal(parseInt(0));
      expect(parseInt(allowances.after_transfer.bob)).to.be.equal(parseInt(0));
    });
    it('5.2 full ownership transfer: should perform transfer of token and service contract balance', async () => {
      // const { salt, sc } = serviceContracts[0];
      let amountDeposit = "1000000000000000000"
      let amountTransfer = "500000000000000000"
      expect(parseInt(balances.sc.before.alice) - parseInt(balances.sc.after.alice)).to.be.equal(parseInt(amountDeposit)-parseInt(amountTransfer));
      expect(parseInt(balances.sc.after.bob) - parseInt(balances.sc.before.bob)).to.be.equal(parseInt(amountTransfer));
      expect(parseInt(balances.token.before.alice) - parseInt(balances.token.after.alice)).to.be.equal(parseInt(amountDeposit)-parseInt(amountTransfer));
      expect(parseInt(balances.token.after.bob) - parseInt(balances.token.before.bob)).to.be.equal(parseInt(amountTransfer));
    });
    it('5.3 full ownership transfer: get rid of allowedServiceContracts (and indices) for alice, and add it to bob', async () => {
      // const { salt, sc } = serviceContracts[0];
      // check the contracts addresses
      expect(deposit_service_contracts.before.alice[0]).to.be.equal(deposit_service_contracts.after.bob[0]);
      expect(deposit_service_contracts.before.bob.length).to.be.equal(0);
      expect(deposit_service_contracts.after.alice.length).to.be.equal(1);
      // check its indices (if -1 means no existent)
      expect(parseInt(deposit_service_contracts_indices.before.alice)).to.be.equal(parseInt(deposit_service_contracts_indices.after.bob));
      expect(parseInt(deposit_service_contracts_indices.before.bob)).to.be.equal(-1);
      expect(parseInt(deposit_service_contracts_indices.after.alice)).to.be.equal(0);
    });
  });

  describe('6. should revert if tried to transfer 2 tokens given that alice only has 1', () => {
    it('6.1 with error "Not enough balance"', async () => {
      const { salt, sc } = serviceContracts[0];
      let amountDeposit =  "1000000000000000000"
      let amountTransfer = "2000000000000000000"
      const tx = await factoryContract.connect(alice).fundMultipleContracts([salt], false, {
        value: amountDeposit
      });
      const txTranf = tokenContract.connect(alice).transfer(bob.address, amountTransfer)
      await expect(txTranf).to.be.revertedWith('Not enough balance');
    });
  });
});