const {deployments, ethers} = require('hardhat');
const { utils } = ethers;
const chai = require('chai');
require('solidity-coverage');
const expect = chai.expect;
const { deploymentVariables, waitConfirmations } = require("../helpers/variables");
const { network } = require("hardhat")
const should = chai.should();
const EventEmitter = require("events");
let serviceContracts = [];

describe('OtherFunc', () => {
  let owner, aliceWhale, operator, bob;
  let serviceContractIndex, tokenContract;

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

  it('1. Change commission rate', async function () {
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

  })

  it('2. changeBaseUri', async function () {
    await expect(tokenContract.changeBaseUri("otherURL")).to.be.ok
    await expect(tokenContract.changeBaseUri()).to.be.reverted
  })

  it('3. changeDepositor', async function () {
    const { sc } = serviceContracts[0];
    await expect(sc.changeDepositor(aliceWhale.address, bob.address)).to.be.revertedWith('DepositNotOwned')
    //DepositNotOwned
  })

  it('4. getWithdrawableAmount', async function () {
    const { sc, salt } = serviceContracts[0];
    await expect(await sc.getWithdrawableAmount()).to.be.equal('0')

    const tx = await tokenContract.connect(aliceWhale).fundMultipleContracts([salt], {
      value: utils.parseEther('32').toString()
    });
    await tx.wait(waitConfirmations[network.config.type]);
    
    await expect(await sc.getWithdrawableAmount()).to.be.equal(utils.parseEther('32').toString())

    const { validatorPubKey, depositSignature, depositDataRoot, exitDate } = serviceContracts[0];
      const createValidator = await sc.connect(aliceWhale).createValidator(
        validatorPubKey,
        depositSignature,
        depositDataRoot,
        exitDate
      );
      await createValidator.wait(waitConfirmations[network.config.type]);
      
      await expect(await sc.getWithdrawableAmount()).to.be.equal('0')

  })

  it('5. updateExitDate', async function () {
    const { sc, salt } = serviceContracts[0];
    await expect(sc.updateExitDate(new Date(2025,1,0).getTime())).to.be.revertedWith("ValidatorIsNotActive()")
    const tx = await tokenContract.connect(aliceWhale).fundMultipleContracts([salt], {
      value: utils.parseEther('32').toString()
    });

    await tx.wait(waitConfirmations[network.config.type]);
    
    const { validatorPubKey, depositSignature, depositDataRoot, exitDate } = serviceContracts[0];
      const createValidator = await sc.connect(aliceWhale).createValidator(
        validatorPubKey,
        depositSignature,
        depositDataRoot,
        exitDate
      );
      await createValidator.wait(waitConfirmations[network.config.type]);
      await expect(await sc.updateExitDate(new Date(2025,1,0).getTime()/1000)).to.be.ok

  })

  it('6. NonDepositor to create validator', async function () {
    const { sc, salt } = serviceContracts[0];
    
    const { validatorPubKey, depositSignature, depositDataRoot, exitDate } = serviceContracts[0];
      const createValidator = sc.connect(aliceWhale).createValidator(
        validatorPubKey,
        depositSignature,
        depositDataRoot,
        exitDate
      );
      await expect(createValidator).to.be.revertedWith("NotDepositor");

  });

  it('7. tokenId -> salt --> tokenId', async function () {
    const { salt } = serviceContracts[0];
    await expect(await tokenContract.saltToTokenId(salt)).to.be.ok
    await expect(await tokenContract.tokenIdToSalt(await tokenContract.saltToTokenId(salt))).to.be.ok
  });

  it('8. getServiceContractAddress', async function () {
    const { salt } = serviceContracts[0];
    await expect(await tokenContract.getServiceContractAddress(salt)).to.be.ok
  });


  
});