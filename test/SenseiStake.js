const {deployments} = require('hardhat');
const {ethers} = require('hardhat');
const {utils} = {ethers};
const chai = require('chai');
require('solidity-coverage');
const expect = chai.expect;
const { deploymentVariables, waitConfirmations } = require("../helpers/variables");
const { network } = require("hardhat")
const should = chai.should();

describe('SenseiStakeComplete', () => {
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

  describe('1. AddValidator should fail if incorrect data provided', async function () {
    const correctLenBytes = {
        validatorPubKey: 48,
        depositSignature: 96,
        depositDataRoot: 32,
        exitDate: 8
    }
    const exitDate = ethers.BigNumber.from(new Date(2025, 0, 1).getTime() / 1000);
    it('1.1 Should fail if wrong length: validatorPubKey', async function () {
        const addValidator = tokenContract.addValidator(
            ethers.utils.hexZeroPad(ethers.utils.hexlify(5), correctLenBytes['tokenId']),
            ethers.utils.hexZeroPad(ethers.utils.hexlify(5), correctLenBytes['validatorPubKey']-2),
            ethers.utils.hexZeroPad(ethers.utils.hexlify(5), correctLenBytes['depositSignature']),
            ethers.utils.hexZeroPad(ethers.utils.hexlify(5), correctLenBytes['depositDataRoot']),
            exitDate
        )
        await expect(addValidator).to.be.revertedWith("InvalidPublicKey");
    })
    it('1.2 Should fail if wrong length: depositSignature', async function () {
        const addValidator = tokenContract.addValidator(
            ethers.utils.hexZeroPad(ethers.utils.hexlify(5), correctLenBytes['tokenId']),
            ethers.utils.hexZeroPad(ethers.utils.hexlify(5), correctLenBytes['validatorPubKey']),
            ethers.utils.hexZeroPad(ethers.utils.hexlify(5), correctLenBytes['depositSignature']-2),
            ethers.utils.hexZeroPad(ethers.utils.hexlify(5), correctLenBytes['depositDataRoot']),
            exitDate
        )
        await expect(addValidator).to.be.revertedWith("InvalidDepositSignature");
    })
    it('1.3 Should fail if wrong length: depositDataRoot', async function () {
        const addValidator = tokenContract.addValidator(
            ethers.utils.hexZeroPad(ethers.utils.hexlify(5), correctLenBytes['tokenId']),
            ethers.utils.hexZeroPad(ethers.utils.hexlify(5), correctLenBytes['validatorPubKey']),
            ethers.utils.hexZeroPad(ethers.utils.hexlify(5), correctLenBytes['depositSignature']),
            ethers.utils.hexZeroPad(ethers.utils.hexlify(5), correctLenBytes['depositDataRoot']-2),
            exitDate
        )
        await expect(addValidator).to.be.reverted;
    })
    it('1.4 Should fail if exit date earlier than current block', async function () {
        const addValidator = tokenContract.addValidator(
            ethers.utils.hexZeroPad(ethers.utils.hexlify(5), correctLenBytes['tokenId']),
            ethers.utils.hexZeroPad(ethers.utils.hexlify(5), correctLenBytes['validatorPubKey']),
            ethers.utils.hexZeroPad(ethers.utils.hexlify(5), correctLenBytes['depositSignature']),
            ethers.utils.hexZeroPad(ethers.utils.hexlify(5), correctLenBytes['depositDataRoot']),
            ethers.BigNumber.from(new Date(2021, 0, 1).getTime() / 1000)
        )
        await expect(addValidator).to.be.revertedWith("NotEarlierThanOriginalDate");
    })
  });
});