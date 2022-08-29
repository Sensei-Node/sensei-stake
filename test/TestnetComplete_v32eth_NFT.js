const {deployments} = require('hardhat');
const {ethers} = require('hardhat');
const chai = require('chai');
require('solidity-coverage');
const expect = chai.expect;
const { deploymentVariables, waitConfirmations } = require("../helpers/variables");
const { network } = require("hardhat")

describe('Complete32ethNFT', () => {
  let owner, aliceWhale, operator, bob;
  let factoryContract, serviceContractIndex, tokenContract;
  let serviceContracts = [];
  let tokenAmount;

  beforeEach(async function () {
    if (network.config.type == 'hardhat') await deployments.fixture();
    [owner, aliceWhale, bob, operator] = await ethers.getSigners();
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
    const tokenDeployment = await deployments.get('SenseistakeERC721')
    const contrToken = await ethers.getContractFactory(
      'SenseistakeERC721'
    );
    tokenAmount = {
      '32000000000000000000': 1,
      '64000000000000000000': 2,
    }
    tokenContract = await contrToken.attach(tokenDeployment.address);
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
    const tx = factoryContract.connect(aliceWhale).fundMultipleContracts([salt], {
      value: amount
    });
    await expect(tx).to.be.revertedWith('Deposited amount should be greater than minimum deposit');
  })

  let balances = {
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
    balances.token.before_1 = (await tokenContract.balanceOf(aliceWhale.address)).toString()
    const tx = await factoryContract.connect(aliceWhale).fundMultipleContracts([salt], {
      value: amount
    });
    await tx.wait(waitConfirmations[network.config.type]);
    balances.sc.after_1 = (await sc.getDeposit(aliceWhale.address)).toString()
    balances.token.after_1 = (await tokenContract.balanceOf(aliceWhale.address)).toString()
    expect(balances.sc.after_1 - balances.sc.before_1).to.be.equal(parseInt(amount));
    expect(balances.token.after_1 - balances.token.before_1).to.be.equal(tokenAmount[amount]);


    console.log("2.Withdraw 32 eth")
    balances.sc.before_2 = (await sc.getDeposit(aliceWhale.address)).toString()
    balances.token.before_2 = (await tokenContract.balanceOf(aliceWhale.address)).toString()
    const withdrawAllowance = await factoryContract.connect(aliceWhale).increaseWithdrawalAllowance(amount);
    const withdraw = await factoryContract.connect(aliceWhale).withdrawAll();
    await withdraw.wait(waitConfirmations[network.config.type]);
    balances.sc.after_2 = (await sc.getDeposit(aliceWhale.address)).toString()
    balances.token.after_2 = (await tokenContract.balanceOf(aliceWhale.address)).toString()
    
    expect(balances.sc.before_2 - balances.sc.after_2).to.be.equal(parseInt(amount));
    expect(balances.token.before_2 - balances.token.after_2 ).to.be.equal(tokenAmount[amount]);
    

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
      balances.token.before_3 = (await tokenContract.balanceOf(aliceWhale.address)).toString()
      console.log(balances)
      const tx2 = await factoryContract.connect(aliceWhale).fundMultipleContracts([salt,salt2], {
        value: amount
      });
      console.log(balances)
      await tx2.wait(waitConfirmations[network.config.type]);
      balances.sc.after_3 = (await sc.getDeposit(aliceWhale.address)).toString()
      balances.sc2.after_3 = (await sc2.getDeposit(aliceWhale.address)).toString()
      balances.token.after_3 = (await tokenContract.balanceOf(aliceWhale.address)).toString()
      expect(balances.sc.after_3 - balances.sc.before_3).to.be.equal(parseInt(amount/2));
      expect(balances.sc2.after_3 - balances.sc2.before_3).to.be.equal(parseInt(amount/2));
      expect(balances.token.after_3 - balances.token.before_3).to.be.equal(tokenAmount[amount]);
      console.log(balances)

      console.log("3.1.32.12.312.2 Transfer to bob")
      const depositsServiceContracts = await factoryContract.getDepositServiceContract(aliceWhale.address);
      console.log('BEFORE TRANSFER ALICE', depositsServiceContracts);
      console.log('BEFORE TRANSFER BOB', await factoryContract.getDepositServiceContract(bob.address));
      console.log('BALANCE OF erc721 ALICE BEFORE TRANSFER', (await tokenContract.balanceOf(aliceWhale.address)).toString())
      console.log('BALANCE OF erc721 BOB BEFORE TRANSFER', (await tokenContract.balanceOf(bob.address)).toString())
      
      // we will just use the first one in this test case
      const servContrDep = depositsServiceContracts[1];
      const tokenId = await tokenContract.getTokenId(servContrDep);
      console.log('TOKEN ID TO TRANSFER', tokenId)
      await tokenContract.connect(aliceWhale).transferFrom(aliceWhale.address, bob.address, tokenId);

      console.log('AFTER TRANSFER ALICe', await factoryContract.getDepositServiceContract(aliceWhale.address));
      console.log('AFTER TRANSFER BOB', await factoryContract.getDepositServiceContract(bob.address));
      console.log('BALANCE OF erc721 ALICE AFTER TRANSFER', (await tokenContract.balanceOf(aliceWhale.address)).toString())
      console.log('BALANCE OF erc721 BOB AFTER TRANSFER', (await tokenContract.balanceOf(bob.address)).toString())

      console.log("3.1.1.1.1. Test CreateValidator")
      const { validatorPubKey, depositSignature, depositDataRoot, exitDate } = serviceContracts[0];
      const createValidator = await sc.createValidator(
        validatorPubKey,
        depositSignature,
        depositDataRoot,
        exitDate
      );
      await createValidator.wait(waitConfirmations[network.config.type]);

      const ethDepositContractAddress = await deployments.get("DepositContract");
      const depositContractDeployment = await ethers.getContractFactory(
        'DepositContract'
      );

      const depositContract = await depositContractDeployment.attach(ethDepositContractAddress.address);
      
      let balanceAliceBefore = await ethers.provider.getBalance(aliceWhale.address)
      await depositContract.connect(aliceWhale).withdrawAll()
      let balanceAliceAfter = await ethers.provider.getBalance(aliceWhale.address)
      console.log(balanceAliceBefore.toString(), balanceAliceAfter.toString())
      console.log("AFTER ", ethers.utils.formatEther(balanceAliceAfter.sub(balanceAliceBefore)));

      // console.log("4. Withdraw 64 eth")
      // balances.sc.before_4 = (await sc.getDeposit(aliceWhale.address)).toString()
      // balances.sc2.before_4 = (await sc2.getDeposit(aliceWhale.address)).toString()
      // balances.token.before_4 = (await tokenContract.balanceOf(aliceWhale.address)).toString()
      // const withdrawAllowance = await factoryContract.connect(aliceWhale).increaseWithdrawalAllowance(amount);
      // const withdraw = await factoryContract.connect(aliceWhale).withdrawAll();
      // await withdraw.wait(waitConfirmations[network.config.type]);
      // balances.sc.after_4 = (await sc.getDeposit(aliceWhale.address)).toString()
      // balances.sc2.after_4 = (await sc2.getDeposit(aliceWhale.address)).toString()
      // balances.token.after_4 = (await tokenContract.balanceOf(aliceWhale.address)).toString()

      // expect((parseInt(balances.sc.before_4) + parseInt(balances.sc2.before_4))  - 
      // (parseInt(balances.sc.after_4) + parseInt(balances.sc2.after_4))).to.be.equal(parseInt(amount));
      // expect(balances.token.before_4 - balances.token.after_4 ).to.be.equal(tokenAmount[amount]);
      
  });
});