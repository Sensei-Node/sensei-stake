const {deployments} = require('hardhat');
const {ethers} = require('hardhat');
const {utils} = {ethers};
const chai = require('chai');
require('solidity-coverage');
const expect = chai.expect;
const { deploymentVariables, waitConfirmations } = require("../helpers/variables");
const { network } = require("hardhat")
const should = chai.should();

describe('Complete', () => {
  let owner, aliceWhale, operator, bob;
  let serviceContractIndex, tokenContract, contrService;
  let serviceContracts = [];

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
    //utils.hexZeroPad(utils.hexlify(index), 32)
  });

  let balances = {
    alice: {},
    bob: {},
    sc: {},
    sc2: {},
    token: {}
  }

  it('1. create validator and view token (happy path)', async function () {
    /*
      1. deposit 32 eth
      2. create validator (mint nft)
      3. get token uri
      4. change base uri
      5. view new token uri after base uri changed
      6. EndOperator services
      7. operator Claim
      8. withdraw
    */
    let amount = "32000000000000000000"

    balances.alice.deposit_before_token = (await tokenContract.balanceOf(aliceWhale.address)).toString();

    // 1. deposit 32 eth (and create contract)
    await createContract(tokenContract, aliceWhale, amount);
    balances.alice.deposit_after_token = (await tokenContract.balanceOf(aliceWhale.address)).toString();
    
    const tokenURI_ = await tokenContract.tokenURI(1);
    console.log(tokenURI_);

    const sc_addr = await tokenContract.getServiceContractAddress(1);
    const sc = await contrService.attach(sc_addr);
    expect(parseInt((await ethers.provider.getBalance(sc_addr)).toString())).to.equal(0);
    expect(amount).to.equal(ethers.utils.parseEther("32"));

    // withdraw from deposit contract
    await withdrawAllToDepositor();
        
    expect(await sc.getWithdrawableAmount()).to.equal(0)
    expect(await sc.state()).to.equal(2) // PostDeposit

    await callToEOS(sc, tokenContract, aliceWhale);
    
    // operator Claim
    const claimable = (await sc.operatorClaim());
    expect(claimable.value).to.equal(0)

    balances.alice.withdraw_before_token = (await tokenContract.balanceOf(aliceWhale.address)).toString();
    balances.sc.withdraw_before_eth = (await ethers.provider.getBalance(sc_addr)).toString()
    // 8. withdraw
    await tokenContract.connect(aliceWhale).withdraw(1);
    balances.alice.withdraw_after_token = (await tokenContract.balanceOf(aliceWhale.address)).toString();
    balances.sc.withdraw_after_eth = (await ethers.provider.getBalance(sc_addr)).toString()

    expect(parseInt(balances.alice.withdraw_before_token) - parseInt(balances.alice.withdraw_after_token)).to.equal(1);
    expect(parseInt(balances.sc.withdraw_before_eth) - parseInt(balances.sc.withdraw_after_eth)).to.equal(parseInt(amount));

  });


  it('2.1 endOperator Services without had withdrawn before should be revert CannotEndZeroBalance ', async function () {
    /*
      1. deposit 32 eth
      2. EndOperator services without had withdrawn before
    */
    let amount = "32000000000000000000"

    // 1. deposit 32 eth (and create contract)
    await createContract(tokenContract, aliceWhale, amount);

    const sc_addr = await tokenContract.getServiceContractAddress(1);
    const sc = await contrService.attach(sc_addr);

    // 2. end operator service
    await expect (tokenContract.connect(aliceWhale).endOperatorServices(1)).to.be.revertedWith("CannotEndZeroBalance");
  });

  it('2.2 endOperator Services out of time should be revert NotAllowedAtCurrentTime  ', async function () {
    /*
      1. deposit 32 eth
      2. EndOperator services before exit date
    */
    let amount = "32000000000000000000"

    // 1. deposit 32 eth (and create contract)
    const tx = await tokenContract.connect(aliceWhale).createContract({
      value: amount
    });
    const receipt = await tx.wait(waitConfirmations[network.config.type]);

    const sc_addr = await tokenContract.getServiceContractAddress(1);
    const sc = await contrService.attach(sc_addr);
    
    await withdrawAllToDepositor();
    
    await expect (tokenContract.connect(aliceWhale).endOperatorServices(1)).to.be.revertedWith("NotAllowedAtCurrentTime()");
  });

  it('2.3 endOperator Services in withdrawal state should be revert NotAllowedInCurrentState  ', async function () {
    /*
      1. deposit 32 eth
      2. EndOperator services after another endOperator Service
    */
    let amount = "32000000000000000000"

    // 1. deposit 32 eth (and create contract)
    await createContract(tokenContract, aliceWhale, amount);

    const sc_addr = await tokenContract.getServiceContractAddress(1);
    const sc = await contrService.attach(sc_addr);
    
    await withdrawAllToDepositor();
  
    // pre 5.0 change block time post exit date (2025/09/15)
    await ethers.provider.send("evm_mine", [parseInt(new Date(2025, 0, 2).getTime() / 1000)])

    expect (await tokenContract.connect(aliceWhale).endOperatorServices(1)).to.be.ok;
    await expect (tokenContract.connect(aliceWhale).endOperatorServices(1)).to.be.revertedWith("NotAllowedInCurrentState()");

  });

  it('3.0 update ExitDate (happy path)', async function () {
    /*
      1. deposit 32 eth
      3. update exit date
    */
    let amount = "32000000000000000000"

    // 1. deposit 32 eth (and create contract)
    await createContract(tokenContract, aliceWhale, amount);

    const sc_addr = await tokenContract.getServiceContractAddress(1);
    const sc = await contrService.attach(sc_addr);

    await expect(sc.updateExitDate(parseInt(new Date(2026, 0, 2).getTime() / 1000))).to.be.ok;
    
  });

  it('3.1 update ExitDate earlier time param should revert with NotEarlierThanOriginalDate', async function () {
    /*
      1. deposit 32 eth
      2. create validator (mint nft)
      3. update exit date with params of earlier date
    */
    let amount = "32000000000000000000"

    // 1. deposit 32 eth (and create contract)
    const tx = await tokenContract.connect(aliceWhale).createContract({
      value: amount
    });
    const receipt = await tx.wait(waitConfirmations[network.config.type]);

    const sc_addr = await tokenContract.getServiceContractAddress(1);
    const sc = await contrService.attach(sc_addr);

    await expect(sc.updateExitDate(parseInt(new Date(2023, 0, 2).getTime() / 1000))).to.be.revertedWith("NotEarlierThanOriginalDate");
    
  });

  it('3.2 update ExitDate in withdrawal state revert with ValidatorNotActive', async function () {
    /*
      1. deposit 32 eth
      2. create validator (mint nft)
      3. update exit date
    */
    let amount = "32000000000000000000"

    // 1. deposit 32 eth (and create contract)
    await createContract(tokenContract, aliceWhale, amount);

    const sc_addr = await tokenContract.getServiceContractAddress(1);
    const sc = await contrService.attach(sc_addr);
    
    await withdrawAllToDepositor();
    
    await callToEOS(sc, tokenContract, aliceWhale);

    await expect(sc.updateExitDate(
      parseInt(new Date(2026, 0, 2).getTime() / 1000))).to.be.revertedWith("ValidatorNotActive");
    
  });

  it('4. Service contract should not receive eth', async function () {
    /*
      1. deposit 32 eth
      2. create validator (mint nft)
      3. try to send eth to the contract
    */
    let amount = "32000000000000000000"

    // 1. deposit 32 eth (and create contract)
    await createContract(tokenContract, aliceWhale, amount);

    const sc_addr = await tokenContract.getServiceContractAddress(1);
    const sc = await contrService.attach(sc_addr);

    const txSend = await aliceWhale.sendTransaction({
      to:sc_addr, 
      value: ethers.utils.parseUnits("1","ether")
    });

  });


  it('5. Operator Claim', async function () {
    /*
      1. deposit 32 eth
      2. create validator (mint nft)
      3. try to send ethg to the contract
    */
    let amount = "32000000000000000000"

    // 1. deposit 32 eth (and create contract)
    await createContract(tokenContract, aliceWhale, amount);

    const sc_addr = await tokenContract.getServiceContractAddress(1);
    const sc = await contrService.attach(sc_addr);
    const txSend = await aliceWhale.sendTransaction({
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

  it('6. Change commission rate', async function () {
    await expect(tokenContract.changeCommissionRate(200_000)).to.be.ok
    .to.emit(tokenContract, 'CommissionRateChanged').withArgs(200_000);       
    await expect(tokenContract.changeCommissionRate(0)).to.be.ok
    .to.emit(tokenContract, 'CommissionRateChanged').withArgs(0);
    await expect(tokenContract.changeCommissionRate(10)).to.be.ok
    .to.emit(tokenContract, 'CommissionRateChanged').withArgs(10);
    await expect( tokenContract.changeCommissionRate(2_000_000)).to.be.reverted
    tokenContract.should.not.emit("CommissionRateChanged");
    await expect(tokenContract.changeCommissionRate(500_000)).to.be.ok
    .to.emit(tokenContract, 'CommissionRateChanged').withArgs(500_000);
    await expect(tokenContract.changeCommissionRate(500_001)).to.be.reverted
    tokenContract.should.not.emit("CommissionRateChanged");
    await expect(tokenContract.changeCommissionRate(undefined)).to.be.reverted
    tokenContract.should.not.emit("CommissionRateChanged");
    await expect(tokenContract.changeCommissionRate(-1)).to.be.reverted
    tokenContract.should.not.emit("CommissionRateChanged");
    await expect(tokenContract.changeCommissionRate()).to.be.reverted
    tokenContract.should.not.emit("CommissionRateChanged");
  });

  it('7.1 getWithdrawableAmount: shouldnt amount to withdraw ', async function () {
    
    const tx = await tokenContract.connect(aliceWhale).createContract({
      value: ethers.utils.parseEther('32')
    });
    const sc_addr = await tokenContract.getServiceContractAddress(1);
    const sc = await contrService.attach(sc_addr);
    const receipt = await tx.wait(waitConfirmations[network.config.type]);
    
    await expect(await sc.getWithdrawableAmount()).to.be.equal('0')

  });

  it('7.1 getWithdrawableAmount: have eths to withdraw ', async function () {
    
    const tx = await tokenContract.connect(aliceWhale).createContract({
      value: ethers.utils.parseEther('32')
    });
    const sc_addr = await tokenContract.getServiceContractAddress(1);
    const sc = await contrService.attach(sc_addr);
    const receipt = await tx.wait(waitConfirmations[network.config.type]);
    
    await withdrawAllToDepositor()

    await callToEOS(sc, tokenContract, aliceWhale);

    await expect(await sc.getWithdrawableAmount()).to.be.equal(ethers.utils.parseEther('32').toString())

  });

  describe('8. modifier OnlyOperator', () => {

    it('1 should not access non operator in onlyOperator ', async function () {
      const servciceContractDeployment = await deployments.get("SenseistakeServicesContract")
      const sContract = await ethers.getContractFactory(
        'SenseistakeServicesContract'
      );
      scContract = await sContract.attach(servciceContractDeployment.address);
      await expect(scContract.connect(aliceWhale).operatorClaim()).to.be.revertedWith("NotOperator")

    });
  });

  describe('9. test withdrawTo', () => {

    let amount = "32000000000000000000"

    it('1. should access by token contract', async function () {
      await createContract(tokenContract, aliceWhale, amount);

      const sc_addr = await tokenContract.getServiceContractAddress(1);
      const sc = await contrService.attach(sc_addr);

      const accion = sc.connect(aliceWhale).withdrawTo(aliceWhale.address)
      await expect(accion).to.be.revertedWith('NotTokenContract');

    });
  });
  describe('10. test create validator', () => {

    let amount = "32000000000000000000"
    const correctLenBytes = {
        validatorPubKey: 48,
        depositSignature: 96,
        depositDataRoot: 32,
        exitDate: 8
    }

    it('1. should only access by token contract', async function () {
      await createContract(tokenContract, aliceWhale, amount);

      const sc_addr = await tokenContract.getServiceContractAddress(1);
      const sc = await contrService.attach(sc_addr);

      const accion = sc.connect(aliceWhale).createValidator(
        ethers.utils.hexZeroPad(ethers.utils.hexlify(5), correctLenBytes['validatorPubKey']-2),
        ethers.utils.hexZeroPad(ethers.utils.hexlify(5), correctLenBytes['depositSignature']),
        ethers.utils.hexZeroPad(ethers.utils.hexlify(5), correctLenBytes['depositDataRoot'])
      )
      await expect(accion).to.be.revertedWith('NotTokenContract');

    });
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
