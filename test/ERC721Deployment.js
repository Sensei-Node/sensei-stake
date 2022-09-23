const {deployments} = require('hardhat');
const {ethers} = require('hardhat');
const {utils} = {ethers};
const chai = require('chai');
require('solidity-coverage');
const expect = chai.expect;
const { deploymentVariables, waitConfirmations } = require("../helpers/variables");
const { network } = require("hardhat")
const should = chai.should();

describe('ERC721Deployment', async () => {
  it('Should fail if commission rate too high', async function () {
    // deposit contract address
    let ethDepositContractAddress;
    try {
        ethDepositContractAddress = await deployments.get("DepositContract");
    } catch(err) {
        ethDepositContractAddress = deploymentVariables.depositContractAddress[network.config.chainId] ? 
        { address: deploymentVariables.depositContractAddress[network.config.chainId] } : { address: '0x00000000219ab540356cBB839Cbe05303d7705Fa' }
    }
    const { deploy, log } = deployments;
    const [deployer] = await ethers.getSigners();
    const args = ["SenseiStakeValidator", "SNSV", 100_000_000, ethDepositContractAddress.address];
    const senseistakeERC721 = deploy("SenseiStake", {
        contract: "SenseiStake",
        from: deployer.address,
        args,
        log: true,
        waitConfirmations: deploymentVariables.waitConfirmations
    })
    await expect(senseistakeERC721).to.be.reverted;
  });
});