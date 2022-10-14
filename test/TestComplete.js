const {deployments} = require('hardhat');
const {ethers} = require('hardhat');
const chai = require('chai');
require('solidity-coverage');
const expect = chai.expect;
const { deploymentVariables, waitConfirmations } = require("../helpers/variables");
const { network } = require("hardhat")

describe('Complete', () => {
  let owner, aliceWhale, operator, bob;
  let serviceContractIndex, tokenContract, contrService;
  let serviceContracts = [];
  let sc
  let sc_addr
  let amount = ethers.utils.parseEther("32")

  beforeEach(async function () {
    if (network.config.type == 'hardhat') await deployments.fixture();
    [owner, aliceWhale, bob, operator] = await ethers.getSigners();
    
    // get service contract index
    serviceContractIndex = deploymentVariables.servicesToDeploy;
    
    // get token deployment
    const tokenDeployment = await deployments.get('SenseiStake')
    const contrToken = await ethers.getContractFactory(
      'SenseiStake'
    );
    tokenContract = await contrToken.attach(tokenDeployment.address);

    // get deposit contract
    const depositContractDeployment = await deployments.get('DepositContract')
    const depContract = await ethers.getContractFactory(
        'DepositContract'
    );
    depositContract = await depContract.attach(depositContractDeployment.address);

    contrService = await ethers.getContractFactory(
      'SenseistakeServicesContract'
    );
    balances.alice.deposit_before_token = (await tokenContract.balanceOf(aliceWhale.address)).toString();
    const tx = await tokenContract.connect(aliceWhale).createContract({
      value: ethers.utils.parseEther('32')
    });
    sc_addr = await tokenContract.getServiceContractAddress(1);
    sc = await contrService.attach(sc_addr);
    await tx.wait(waitConfirmations[network.config.type]);
  });

  let balances = {
    alice: {},
    bob: {},
    sc: {},
    sc2: {},
    token: {}
  }
  describe('1. test complete path', () => {
    it('1.1 create validator and view token (happy path)', async function () {
      /*
        1. deposit 32 eth
        2. create validator (mint nft)
        3. get token uri
        4. view new token 
        5. EndOperator services
        6. operator Claim
        7. withdraw
      */

      // 1. deposit 32 eth
      // 2. create validator (mint nft)
      // 3. get token uri
      //await createContract(tokenContract, aliceWhale, amount);
      balances.alice.deposit_after_token = (await tokenContract.balanceOf(aliceWhale.address)).toString();
      
      // 4. view new token  
      const tokenURI_ = await tokenContract.tokenURI(1);
      // console.log(tokenURI_);
      expect(tokenURI_).to.not.be.a('undefined');

      const sc_addr = await tokenContract.getServiceContractAddress(1);
      const sc = await contrService.attach(sc_addr);
      expect(parseInt((await ethers.provider.getBalance(sc_addr)).toString())).to.equal(0);

      // withdraw from deposit contract
      await withdrawAllToDepositor();
      
      expect(await sc.getWithdrawableAmount()).to.equal(0)
      expect(await sc.validatorActive()).to.equal(true) // active

      // 5. EndOperator services
      await callToEOS(sc, tokenContract, aliceWhale);
      
      // 6. operator Claim
      const claim = sc.operatorClaim();
      await expect(claim).to.be.revertedWith('EmptyClaimableForOperator()')

      balances.alice.withdraw_before_token = (await tokenContract.balanceOf(aliceWhale.address)).toString();
      balances.sc.withdraw_before_eth = (await ethers.provider.getBalance(sc_addr)).toString()
      
      // 7. withdraw
      await tokenContract.connect(aliceWhale).withdraw(1);
      balances.alice.withdraw_after_token = (await tokenContract.balanceOf(aliceWhale.address)).toString();
      balances.sc.withdraw_after_eth = (await ethers.provider.getBalance(sc_addr)).toString()

      expect(parseInt(balances.alice.withdraw_before_token) - parseInt(balances.alice.withdraw_after_token)).to.equal(1);
      expect(parseInt(balances.sc.withdraw_before_eth) - parseInt(balances.sc.withdraw_after_eth)).to.equal(parseInt(amount));

    });
  });

  describe('2. test end Operator Services', () => {
    it('2.1 endOperator Services working ', async function () {
      /*
        1. deposit 32 eth (and create contract)
        2. EndOperator services 
      */
      await withdrawAllToDepositor();
      await callToEOS(sc, tokenContract, aliceWhale);
      expect (await sc.validatorActive()).to.equal(false);
    }); 
    it('2.2 endOperator Services without had withdrawn before should be revert CannotEndZeroBalance ', async function () {
      /*
        1. deposit 32 eth (and create contract)
        2. EndOperator services without had withdrawn before
        3. revert with CannotEndZeroBalance
      */

      await expect (tokenContract.connect(aliceWhale).endOperatorServices(1)).to.be.revertedWith("CannotEndZeroBalance");
      expect (await sc.validatorActive()).to.equal(true);
    });
    it('2.2 endOperator Services out of time should be revert NotAllowedAtCurrentTime', async function () {
      /*
        1. deposit 32 eth (and create contract)
        2. EndOperator services before exit date
        3. revert with NotAllowedAtCurrentTime
      */
      await withdrawAllToDepositor();
      const eeop = tokenContract.connect(aliceWhale).endOperatorServices(1)
      await expect (eeop).to.be.revertedWith("NotAllowedAtCurrentTime()");
      expect (await sc.validatorActive()).to.equal(true);
    });
  });
  
  describe('4. test receive ethers', () => {
    it('4.1 Service contract should not receive eth', async function () {
      /*
        1. deposit 32 eth
        2. create validator (mint nft)
        3. try to send eth to the contract
      */

      await aliceWhale.sendTransaction({
        to:sc_addr, 
        value: ethers.utils.parseUnits("1","ether")
      });

    });
  });

  describe('5. test Operator Claim', () => {
    it('5.1 Operator Claim', async function () {
      /*
        1. deposit 32 eth
        2. create validator (mint nft)
        3. try to send eth to the contract
      */

      await aliceWhale.sendTransaction({
        to:sc_addr, 
        value: ethers.utils.parseUnits("3","ether")
      });
      await withdrawAllToDepositor();
      
      await callToEOS(sc, tokenContract, aliceWhale);
      const ownerBefore = await ethers.provider.getBalance(owner.address)
      const claim_afterEOS =  (await sc.operatorClaimable());
      expect(claim_afterEOS).to.equal(ethers.utils.parseEther("0.3"));
      const txClaim = await sc.operatorClaim()
      expect (txClaim).to.be.ok;
      //expect (txClaim.value).to.equal(claim_afterEOS);
      const claim_afterClaim =  (await sc.operatorClaimable());
      expect(claim_afterClaim).to.equal(0);
      const ownerAfter  = await ethers.provider.getBalance(owner.address);
      const profitOwner = (ownerAfter).sub(ownerBefore)
      const tx_fee = ethers.utils.parseEther("0.005");
      expect(parseInt(profitOwner.add(tx_fee))).to.greaterThanOrEqual(parseInt(ethers.utils.parseEther("0.3")))
    });
  });

  describe('7. test getWithdrawableAmount', () => {
    it('7.1 getWithdrawableAmount: shouldnt amount to withdraw ', async function () {
      
      await expect(await sc.getWithdrawableAmount()).to.be.equal('0')

    });

    it('7.2 getWithdrawableAmount: have eths to withdraw ', async function () {
    
      await withdrawAllToDepositor()
      await callToEOS(sc, tokenContract, aliceWhale);
      await expect(await sc.getWithdrawableAmount()).to.be.equal(ethers.utils.parseEther('32').toString())

    });
  });
  describe('8. modifier OnlyOperator', () => {
    it('8.1 should not access non operator in onlyOperator ', async function () {

      await expect(sc.connect(aliceWhale).operatorClaim()).to.be.revertedWith("NotOperator")

    });
  });

  describe('9. test withdrawTo', () => {
    let amount = "32000000000000000000"
    it('9.1. should access by token contract', async function () {
      await createContract(tokenContract, aliceWhale, amount);

      const sc_addr = await tokenContract.getServiceContractAddress(1);
      const sc = await contrService.attach(sc_addr);

      const accion = sc.connect(aliceWhale).withdrawTo(aliceWhale.address)
      await expect(accion).to.be.revertedWith('CallerNotAllowed');

    });
  });
  
  describe('10. test create validator', () => {

    const correctLenBytes = {
        validatorPubKey: 48,
        depositSignature: 96,
        depositDataRoot: 32,
        exitDate: 8
    }
  });
});

async function createContract(tokenContract, aliceWhale, amount) {
  const tx = await tokenContract.connect(aliceWhale).createContract({
    value: amount
  });
  const receipt = await tx.wait(waitConfirmations[network.config.type]);
}

async function withdrawAllToDepositor() {
  const wtx = await depositContract.withdrawAllToDepositor();
  await wtx.wait(waitConfirmations[network.config.type]);
}

async function callToEOS(sc, tokenContract, aliceWhale) {
  // change block time post exit date (2025/01/02)
  await ethers.provider.send("evm_mine", [parseInt(new Date(2025, 0, 2).getTime() / 1000)]);
  const claim_beforeEOS = (await sc.operatorClaimable());
  expect(claim_beforeEOS).to.equal(0);
  expect(await tokenContract.connect(aliceWhale).endOperatorServices(1)).to.be.ok;
}
