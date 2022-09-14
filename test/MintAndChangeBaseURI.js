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

  let balances = {
    alice: {},
    bob: {},
    sc: {},
    sc2: {},
    token: {}
  }

  it('1. should be able change baseURI and tokenURI should change accordingly', async function () {
    /*
      1. deposit 32 eth
      2. create validator (mint nft)
      3. get token uri
      4. change base uri
      5. view new token uri after base uri changed
    */
    const { salt, sc } = serviceContracts[0];
    
    let amount = "32000000000000000000"

    // 1. deposit 32 eth
    const tx = await tokenContract.connect(aliceWhale).fundMultipleContracts([salt], {
      value: amount
    });
    await tx.wait(waitConfirmations[network.config.type]);
    
    // 2. create validator (mint nft)
    const { validatorPubKey, depositSignature, depositDataRoot, exitDate } = serviceContracts[0];
    const createValidator = await sc.connect(aliceWhale).createValidator(
      validatorPubKey,
      depositSignature,
      depositDataRoot,
      exitDate
    );
    await createValidator.wait(waitConfirmations[network.config.type]);
    const tokenId = await tokenContract.saltToTokenId(salt);

    // 3. get token uri
    const tokenURI = await tokenContract.tokenURI(tokenId);
    console.log(tokenURI);

    // 4. change base uri
    const tx2 = await tokenContract.changeBaseUri('base://test/');
    await tx2.wait(waitConfirmations[network.config.type]);

    // 5. view new token uri after base uri changed
    
    const tokenURI2 = await tokenContract.tokenURI(tokenId);
    console.log(tokenURI2);

    expect(tokenURI).not.to.equal(tokenURI2)
  });
});