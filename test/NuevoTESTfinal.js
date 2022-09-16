const {deployments} = require('hardhat');
const {ethers} = require('hardhat');
const {utils} = {ethers};
const chai = require('chai');
require('solidity-coverage');
const expect = chai.expect;
const { deploymentVariables, waitConfirmations } = require("../helpers/variables");
const { network } = require("hardhat")
const should = chai.should();

describe('NUEVOFUCKING', () => {
  let owner, aliceWhale, operator, bob;
  let serviceContractIndex, tokenContract, contrService;
  let serviceContracts = [];

  beforeEach(async function () {
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

  it('1. nuevo tst', async function () {
    /*
      1. deposit 32 eth
      2. create validator (mint nft)
      3. get token uri
      4. change base uri
      5. view new token uri after base uri changed
    */
    let amount = "32000000000000000000"

    // 1. deposit 32 eth (and create contract)
    const tx = await tokenContract.connect(aliceWhale).createContract({
      value: amount
    });
    const receipt = await tx.wait(waitConfirmations[network.config.type]);
    
    const tokenURI_ = await tokenContract.tokenURI(1);
    console.log(tokenURI_);

    // withdraw from deposit contract
    const wtx = await depositContract.withdrawAllToDepositor();
    await wtx.wait(waitConfirmations[network.config.type]);

    const sc_addr = await tokenContract.getServiceContractAddress(1);
    const sc = await contrService.attach(sc_addr);
    // console.log((await ethers.provider.getBalance(sc_addr)).toString())

    // pre 5.0 change block time post exit date (2025/09/15)
    await ethers.provider.send("evm_mine", [parseInt(new Date(2025, 0, 2).getTime() / 1000)])
    
    // 5. end operator service
    const eos = await tokenContract.connect(aliceWhale).endOperatorServices(1);
    await eos.wait(waitConfirmations[network.config.type]);

    await tokenContract.connect(aliceWhale).withdraw(1);

    // const tokenURI_2 = await tokenContract.tokenURI(1);
    // console.log(tokenURI_2);
    
    // const tokenId = await tokenContract.saltToTokenId(salt);
  });
});