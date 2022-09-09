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
  let factoryContract, serviceContractIndex, tokenContract;
  let serviceContracts = [];
  let tokenAmount;


  beforeEach(async function () {
    emitter = new EventEmitter();
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
    // 5 ether
    let amount = "5000000000000000000"
    const tx = factoryContract.connect(aliceWhale).fundMultipleContracts([salt], {
      value: amount
    });
    await expect(tx).to.be.revertedWith('Deposited amount should be greater than minimum deposit');
  })

  it('0.1 should return the surplus when more than 32eth are deposited', async function () {
    const { salt, sc } = serviceContracts[0];
    // 50 ethers
    let amount = "50000000000000000000"
    const balanceBefore = (await sc.getDeposit(aliceWhale.address))

    const tx = factoryContract.connect(aliceWhale).fundMultipleContracts([salt], {
      value: amount
    });
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
    // balances.token.before_1 = (await tokenContract.balanceOf(aliceWhale.address)).toString()
    const tx = await factoryContract.connect(aliceWhale).fundMultipleContracts([salt], {
      value: amount
    });
    await tx.wait(waitConfirmations[network.config.type]);
    balances.sc.after_1 = (await sc.getDeposit(aliceWhale.address)).toString()
    // balances.token.after_1 = (await tokenContract.balanceOf(aliceWhale.address)).toString()
    expect(balances.sc.after_1 - balances.sc.before_1).to.be.equal(parseInt(amount));
    // expect(balances.token.after_1 - balances.token.before_1).to.be.equal(tokenAmount[amount]);


    console.log("2.Withdraw 32 eth")
    balances.sc.before_2 = (await sc.getDeposit(aliceWhale.address)).toString()
    // balances.token.before_2 = (await tokenContract.balanceOf(aliceWhale.address)).toString()
    const withdrawAllowance = await factoryContract.connect(aliceWhale).increaseWithdrawalAllowance(amount);
    const withdraw = await factoryContract.connect(aliceWhale).withdrawAll();
    await withdraw.wait(waitConfirmations[network.config.type]);
    balances.sc.after_2 = (await sc.getDeposit(aliceWhale.address)).toString()
    // balances.token.after_2 = (await tokenContract.balanceOf(aliceWhale.address)).toString()
    
    console.log('ASDASDASDDASADDASADSD----------------------------', balances.sc.before_2 - balances.sc.after_2)
    expect(balances.sc.before_2 - balances.sc.after_2).to.be.equal(parseInt(amount));
    
    // expect(balances.token.before_2 - balances.token.after_2 ).to.be.equal(tokenAmount[amount]);
    

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
      // balances.token.before_3 = (await tokenContract.balanceOf(aliceWhale.address)).toString()=
      const tx2 = await factoryContract.connect(aliceWhale).fundMultipleContracts([salt,salt2], {
        value: amount
      });
      await tx2.wait(waitConfirmations[network.config.type]);
      balances.sc.after_3 = (await sc.getDeposit(aliceWhale.address)).toString()
      balances.sc2.after_3 = (await sc2.getDeposit(aliceWhale.address)).toString()
      
      // balances.token.after_3 = (await tokenContract.balanceOf(aliceWhale.address)).toString()
      expect(balances.sc.after_3 - balances.sc.before_3).to.be.equal(parseInt(amount/2));
      expect(balances.sc2.after_3 - balances.sc2.before_3).to.be.equal(parseInt(amount/2));
      
      
      
      // expect(balances.token.after_3 - balances.token.before_3).to.be.equal(tokenAmount[amount])

      console.log("3.1 Test CreateValidator")
      balances.alice.balance_before_3_1 = (await factoryContract.getBalanceOf(aliceWhale.address)).toString();
      balances.sc.deposit_before_3_1 = (await sc.getDeposit(aliceWhale.address)).toString();
      balances.sc2.deposit_before_3_1 = (await sc2.getDeposit(aliceWhale.address)).toString();
      balances.token.before_3_1 = (await tokenContract.balanceOf(aliceWhale.address)).toString();
      
      const { validatorPubKey, depositSignature, depositDataRoot, exitDate } = serviceContracts[0];
      const createValidator = await sc.connect(aliceWhale).createValidator(
        validatorPubKey,
        depositSignature,
        depositDataRoot,
        exitDate
      );
      await createValidator.wait(waitConfirmations[network.config.type]);
      
      balances.alice.deposit_after_3_1 = (await factoryContract.getBalanceOf(aliceWhale.address)).toString();
      balances.sc.deposit_after_3_1 = (await sc.getDeposit(aliceWhale.address)).toString();
      balances.sc2.deposit_after_3_1 = (await sc2.getDeposit(aliceWhale.address)).toString();
      balances.token.after_3_1 = (await tokenContract.balanceOf(aliceWhale.address)).toString();
      
      expect(parseInt(balances.alice.balance_before_3_1)).to.be.equal(parseInt(amount));
      expect(parseInt(balances.alice.deposit_after_3_1)).to.be.equal(parseInt(amount/2));
      expect(parseInt(balances.sc.deposit_before_3_1)).to.be.equal(amount/2);
      expect(parseInt(balances.sc2.deposit_before_3_1)).to.be.equal(parseInt(amount/2));
      // We keep the deposit mapping intact because we'll need to know who are the owner of the deposit
      expect(parseInt(balances.sc.deposit_after_3_1)).to.be.equal(parseInt(amount/2));
      expect(parseInt(balances.sc2.deposit_after_3_1)).to.be.equal(parseInt(amount/2));
      // 32 eth of balance of the contract went to deposit contract
      expect(parseInt(balances.alice.deposit_after_3_1)).to.be.equal(parseInt(amount/2));

      expect(parseInt( balances.token.before_3_1)).to.be.equal(0);
      expect(parseInt( balances.token.after_3_1)).to.be.equal(1);


      console.log("3.2 Transfer to bob")

      balances.alice.balance_before_3_2 = (await factoryContract.getBalanceOf(aliceWhale.address)).toString();
      balances.bob.balance_before_3_2 = (await factoryContract.getBalanceOf(bob.address)).toString();

      balances.alice.deposit_before_3_2 = (await factoryContract.getDepositOf(aliceWhale.address)).toString();
      balances.bob.deposit_before_3_2 = (await factoryContract.getDepositOf(bob.address)).toString();
      
      balances.token.alice_before_3_2 = (await tokenContract.balanceOf(aliceWhale.address)).toString();
      balances.token.bob_before_3_2 = (await tokenContract.balanceOf(bob.address)).toString();

      expect(await factoryContract.getDepositServiceContract(bob.address)).to.be.empty;

      const depositsServiceContracts = await factoryContract.getDepositServiceContract(aliceWhale.address);
      // we will just use the first one in this test case

      const tokenId = await tokenContract.getTokenId(sc.address);
      console.log('TOKEN ID TO TRANSFER', tokenId)

      const txTransfer = await tokenContract.connect(aliceWhale).transferFrom(aliceWhale.address, bob.address, tokenId);
      await txTransfer.wait(waitConfirmations[network.config.type]);

      balances.alice.balance_after_3_2 = (await factoryContract.getBalanceOf(aliceWhale.address)).toString();
      balances.bob.balance_after_3_2 = (await factoryContract.getBalanceOf(bob.address)).toString();

      balances.alice.deposit_after_3_2 = (await factoryContract.getDepositOf(aliceWhale.address)).toString();
      balances.bob.deposit_after_3_2 = (await factoryContract.getDepositOf(bob.address)).toString();
      
      balances.token.alice_after_3_2 = (await tokenContract.balanceOf(aliceWhale.address)).toString();
      balances.token.bob_after_3_2 = (await tokenContract.balanceOf(bob.address)).toString();
      console.log(balances)
      expect(await factoryContract.getDepositServiceContract(bob.address)).to.not.be.empty;
      
      //expect(parseInt(balances.alice.balance_before_3_2) - parseInt(balances.alice.after_after_3_2)).to.equal(0)
      //expect(parseInt(balances.bob.balance_after_3_2) - parseInt(balances.bob.balance_before_3_2)).to.equal(0)
      
      // The deposits is calculated based on service contract the user has, 
      // In the transfer the service contract change the owner 
      // before : alice has 2 service contract deposited = 64 
      // after : alice transfer the service contract which had created the validator to bob. 
      // alice has 1 service contract = 32 and bob has 1 service contract = 32 
      expect(parseInt(balances.alice.deposit_before_3_2)).to.be.equal(parseInt(amount));
      expect(parseInt(balances.alice.deposit_after_3_2)).to.be.equal(parseInt(amount/2));
      expect(parseInt(balances.bob.deposit_before_3_2)).to.be.equal(parseInt(0));
      expect(parseInt(balances.bob.deposit_after_3_2)).to.be.equal(parseInt(amount/2));
      
      // The balance is calculated based the balance of each service contract. 
      // In the transfer just transfer the service contracs that had deposited their balance to the deposit contract
      expect(parseInt(balances.alice.balance_before_3_2)).to.be.equal(parseInt(amount/2));
      expect(parseInt(balances.alice.balance_after_3_2)).to.be.equal(parseInt(amount/2));
      expect(parseInt(balances.bob.deposit_before_3_2)).to.be.equal(parseInt(0));
      expect(parseInt(balances.bob.deposit_after_3_2)).to.be.equal(parseInt(amount/2));
      
      expect(parseInt(balances.token.bob_after_3_2) - parseInt(balances.token.bob_before_3_2)).to.equal(1)
      expect(parseInt(balances.token.alice_before_3_2) - parseInt(balances.token.alice_after_3_2)).to.equal(1)

      // const ethDepositContractAddress = await deployments.get("DepositContract");
      // const depositContractDeployment = await ethers.getContractFactory(
      //   'DepositContract'
      // );

      // const depositContract = await depositContractDeployment.attach(ethDepositContractAddress.address);
      
      // let balanceAliceBefore = await ethers.provider.getBalance(aliceWhale.address)
      // await depositContract.connect(aliceWhale).withdrawAll()
      // let balanceAliceAfter = await ethers.provider.getBalance(aliceWhale.address)
      // console.log(balanceAliceBefore.toString(), balanceAliceAfter.toString())
      // console.log("AFTER ", ethers.utils.formatEther(balanceAliceAfter.sub(balanceAliceBefore)));

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