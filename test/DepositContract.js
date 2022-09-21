const {deployments} = require('hardhat');
const {ethers} = require('hardhat');
const {utils} = {ethers};
const chai = require('chai');
require('solidity-coverage');
const expect = chai.expect;
const { deploymentVariables, waitConfirmations } = require("../helpers/variables");
const { network } = require("hardhat")
const should = chai.should();

describe('DepositContract', () => {
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

  describe('1. withdrawAllToOwner tests', async function () {
    it('1.1. withdrawAllToOwner should work if called by owner', async function () {
      let amount = ethers.utils.parseEther("32")
      const tx = await tokenContract.connect(aliceWhale).createContract({
          value: amount
      });
      await tx.wait(waitConfirmations[network.config.type]);
      const balance_before = await ethers.provider.getBalance(owner.address);
      const wtx = await depositContract.withdrawAllToOwner();
      await wtx.wait(waitConfirmations[network.config.type]); 
      const balance_after = await ethers.provider.getBalance(owner.address);
      const fee = ethers.utils.parseEther("0.05");
      expect(parseInt(balance_before.add(fee).add(amount).toString())).to.be.greaterThanOrEqual(parseInt(balance_after.toString()));
    });
  
    it('1.2. withdrawAllToOwner should fail if called by not owner', async function () {
      let amount = ethers.utils.parseEther("32")
      const tx = await tokenContract.connect(aliceWhale).createContract({
          value: amount
      });
      await tx.wait(waitConfirmations[network.config.type]);
      const balance_before = await ethers.provider.getBalance(owner.address);
      const wtx = depositContract.connect(aliceWhale).withdrawAllToOwner();
      await expect(wtx).to.be.reverted;
    });
  });
});