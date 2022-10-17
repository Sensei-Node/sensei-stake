const {deployments} = require('hardhat');
const {ethers} = require('hardhat');
const {utils} = {ethers};
const chai = require('chai');
require('solidity-coverage');
const expect = chai.expect;
const { deploymentVariables, waitConfirmations } = require("../helpers/variables");
const { network } = require("hardhat")
const should = chai.should();

describe('ExtSenseiStake', () => {
  let owner, aliceWhale, otherPerson, bob;
  let serviceContractIndex, tokenContract, contrService, extTokenContract;
  let serviceContracts = [];

  beforeEach(async function () {
    if (network.config.type == 'hardhat') await deployments.fixture();
    [owner, aliceWhale, bob, otherPerson] = await ethers.getSigners();
    
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

    const extTokenDeployment = await deployments.get('ExtSenseiStake')
    const extContrToken = await ethers.getContractFactory(
      'ExtSenseiStake'
    );
    extTokenContract = await extContrToken.attach(extTokenDeployment.address);

    //utils.hexZeroPad(utils.hexlify(index), 32)
  });

  describe('1. Minting multiple nfts', async function () {
    it('1.1 Should work if valid ethers amount sent', async function () {
        const multiple = await extTokenContract.connect(aliceWhale).createMultipleContracts({
            value: ethers.utils.parseEther("96")
        });
        expect(await tokenContract.balanceOf(aliceWhale.address)).to.equal(3)
    });
    it('1.2 Should revert if not multiple 32 ethers amount sent', async function () {
        const multiple = extTokenContract.connect(aliceWhale).createMultipleContracts({
            value: ethers.utils.parseEther("11")
        });
        expect(multiple).to.be.revertedWith('InvalidDepositAmount')
    });
    it('1.3 Should revert if no more validators available', async function () {
        const multiple = extTokenContract.connect(aliceWhale).createMultipleContracts({
            value: ethers.utils.parseEther("320")
        });
        expect(multiple).to.be.revertedWith('NotEnoughValidatorsAvailable')

    });
  });
});