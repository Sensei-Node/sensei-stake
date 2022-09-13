const {deployments} = require('hardhat');
const {ethers} = require('hardhat');
const chai = require('chai');
require('solidity-coverage');
const expect = chai.expect;
const { deploymentVariables, waitConfirmations } = require("../helpers/variables");
const { network } = require("hardhat")
const should = chai.should();
const EventEmitter = require("events");

describe('Complete32ethNFT', () => {
  let owner, aliceWhale, operator, bob;
  let serviceContractIndex, tokenContract;
  let serviceContracts = [];

  beforeEach(async function () {
    emitter = new EventEmitter();
    if (network.config.type == 'hardhat') await deployments.fixture();
    [owner, aliceWhale, bob, operator] = await ethers.getSigners();
    
    // get service contract index
    serviceContractIndex = deploymentVariables.servicesToDeploy;
    
    // get token deployment
    const tokenDeployment = await deployments.get('SenseistakeERC721')
    const contrToken = await ethers.getContractFactory(
      'SenseistakeERC721'
    );
    tokenContract = await contrToken.attach(tokenDeployment.address);

    tokenAmount = {
      '32000000000000000000': 1,
      '64000000000000000000': 2,
    }
    
    // get all service contracts deployed
    for( let i = 1 ; i <= serviceContractIndex; i++) {
      const { address: salt } = await deployments.get('ServiceContractSalt'+i)
      const serviceDeployment = await deployments.get('SenseistakeServicesContract'+i)

      const {address: validatorPubKey} = await deployments.get('SSvalidatorPubKey'+i)
      const {address: depositSignature} = await deployments.get('SSdepositSignature'+i)
      const {address: depositDataRoot} = await deployments.get('SSdepositDataRoot'+i)
      const {address: exitDate} = await deployments.get('SSexitDate'+i)

      const contrService = await ethers.getContractFactory(
          'SenseistakeServicesContract'
      );
      serviceContracts.push({
        salt,
        sc: await contrService.attach(serviceDeployment.address),
        validatorPubKey,
        depositSignature,
        depositDataRoot,
        exitDate
      });
    }
  });

  it('0. should revert when less than 32eth are deposited', async function () {
    const { salt, sc } = serviceContracts[0];
    let amount = "5000000000000000000"
    const tx = tokenContract.connect(aliceWhale).fundMultipleContracts([salt], {
      value: amount
    });
    await expect(tx).to.be.reverted;
  })

  it('0.1 should return the surplus when more than 32eth are deposited', async function () {
    const { salt, sc } = serviceContracts[0];
    // 50 ethers
    let amount = "50000000000000000000"
    const balanceBefore = (await sc.getDeposit(aliceWhale.address))
    const tx = await tokenContract.connect(aliceWhale).fundMultipleContracts([salt], {
      value: amount
    });
    await tx.wait(waitConfirmations[network.config.type]);
    const balanceAfter = (await sc.getDeposit(aliceWhale.address))
    await expect((balanceAfter.sub(balanceBefore)).toString() ).to.equal('32000000000000000000');
  })

  let balances = {
    alice: {},
    bob: {},
    sc: {},
    sc2: {},
    token: {}
  }

  it('1,2. should be able to deposit 32eth or (multiples of 32eth) and withdraw them', async function () {
    /*
      1. deposit 32 eth
      2. withdraw 32 eth
    */
    const { salt, sc } = serviceContracts[0];
    
    let amount = "32000000000000000000"

    console.log("1. Deposit 32 eth")

    balances.sc.before_1 = (await sc.getDeposit(aliceWhale.address)).toString()
    const tx = await tokenContract.connect(aliceWhale).fundMultipleContracts([salt], {
      value: amount
    });
    await tx.wait(waitConfirmations[network.config.type]);
    balances.sc.after_1 = (await sc.getDeposit(aliceWhale.address)).toString()
    expect(balances.sc.after_1 - balances.sc.before_1).to.be.equal(parseInt(amount));

    console.log("2.Withdraw 32 eth")

    balances.sc.before_2 = (await sc.getDeposit(aliceWhale.address)).toString()
    const tokenId = await tokenContract.saltToTokenId(salt);
    const withdraw = await tokenContract.connect(aliceWhale).withdraw(tokenId);
    await withdraw.wait(waitConfirmations[network.config.type]);
    balances.sc.after_2 = (await sc.getDeposit(aliceWhale.address)).toString()
    expect(balances.sc.before_2 - balances.sc.after_2).to.be.equal(parseInt(amount));
    
    });
    it('3,4. should be able to deposit 32eth or (multiples of 32eth) and withdraw them', async function () {
      /*
      3. deposit 62 eth
      4. withdraw 64 eth
      */
      const { salt, sc } = serviceContracts[0];
      const { salt:salt2, sc:sc2 } = serviceContracts[1];

      console.log("3. Deposit 64 eth")

      amount = "64000000000000000000"
      balances.sc.before_3 = (await sc.getDeposit(aliceWhale.address)).toString()
      balances.sc2.before_3 = (await sc2.getDeposit(aliceWhale.address)).toString()
      const tx2 = await tokenContract.connect(aliceWhale).fundMultipleContracts([salt, salt2], {
        value: amount
      });
      await tx2.wait(waitConfirmations[network.config.type]);
      balances.sc.after_3 = (await sc.getDeposit(aliceWhale.address)).toString()
      balances.sc2.after_3 = (await sc2.getDeposit(aliceWhale.address)).toString()
      expect(balances.sc.after_3 - balances.sc.before_3).to.be.equal(parseInt(amount/2));
      expect(balances.sc2.after_3 - balances.sc2.before_3).to.be.equal(parseInt(amount/2));

      console.log("3.1 Test CreateValidator")

      balances.sc.deposit_before_3_1 = (await sc.getDeposit(aliceWhale.address)).toString();
      balances.sc2.deposit_before_3_1 = (await sc2.getDeposit(aliceWhale.address)).toString();
      const { validatorPubKey, depositSignature, depositDataRoot, exitDate } = serviceContracts[0];
      const createValidator = await sc.connect(aliceWhale).createValidator(
        validatorPubKey,
        depositSignature,
        depositDataRoot,
        exitDate
      );
      await createValidator.wait(waitConfirmations[network.config.type]);
      balances.sc.deposit_after_3_1 = (await sc.getDeposit(aliceWhale.address)).toString();
      balances.sc2.deposit_after_3_1 = (await sc2.getDeposit(aliceWhale.address)).toString();
      expect(parseInt(balances.sc.deposit_before_3_1)).to.be.equal(amount/2);
      expect(parseInt(balances.sc2.deposit_before_3_1)).to.be.equal(parseInt(amount/2));

      console.log("3.2 Transfer to bob")

      balances.sc.Alice_deposit_before_3_2 = (await sc.getDeposit(aliceWhale.address)).toString();
      balances.sc2.Alice_deposit_before_3_2 = (await sc2.getDeposit(aliceWhale.address)).toString();
      balances.sc.Bob_deposit_before_3_2 = (await sc.getDeposit(bob.address)).toString();
      balances.sc2.Bob_deposit_before_3_2 = (await sc2.getDeposit(bob.address)).toString();

      const tokenId = await tokenContract.saltToTokenId(salt);

       balances.token.ownerOfTokenBefore = await tokenContract.ownerOf(tokenId);
      balances.token.alice_before = (await tokenContract.balanceOf(aliceWhale.address)).toString();
      balances.token.bob_before = (await tokenContract.balanceOf(bob.address)).toString();

      console.log('TOKEN ID TO TRANSFER', tokenId)
      const txTransfer = await tokenContract.connect(aliceWhale).transferFrom(aliceWhale.address, bob.address, tokenId);
      await txTransfer.wait(waitConfirmations[network.config.type]);
      
      balances.sc.Alice_deposit_after_3_2 = (await sc.getDeposit(aliceWhale.address)).toString();
      balances.sc2.Alice_deposit_after_3_2 = (await sc2.getDeposit(aliceWhale.address)).toString();
      balances.sc.Bob_deposit_after_3_2 = (await sc.getDeposit(bob.address)).toString();
      balances.sc2.Bob_deposit_after_3_2 = (await sc2.getDeposit(bob.address)).toString();
       balances.token.ownerOfTokenAfter = await tokenContract.ownerOf(tokenId);
      balances.token.alice_after = (await tokenContract.balanceOf(aliceWhale.address)).toString();
      balances.token.bob_after = (await tokenContract.balanceOf(bob.address)).toString();

      expect(parseInt(balances.sc.Bob_deposit_after_3_2) - parseInt(balances.sc.Bob_deposit_before_3_2)).to.equal(amount/2)
      expect(parseInt(balances.sc.Alice_deposit_before_3_2) - parseInt(balances.sc.Alice_deposit_after_3_2)).to.equal(amount/2)
      expect(parseInt(balances.sc2.Alice_deposit_before_3_2) - parseInt(balances.sc2.Alice_deposit_after_3_2)).to.equal(0)
       expect(balances.token.ownerOfTokenAfter).to.equal(bob.address)
       expect(balances.token.ownerOfTokenBefore).to.equal(aliceWhale.address)
      expect(parseInt(balances.token.bob_after) - parseInt(balances.token.bob_before)).to.equal(1)
      expect(parseInt(balances.token.alice_before) - parseInt(balances.token.alice_after)).to.equal(1)
      
  });
});