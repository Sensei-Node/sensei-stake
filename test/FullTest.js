const {deployments} = require('hardhat');
const {ethers} = require('hardhat');
const chai = require('chai');
require('solidity-coverage');
const expect = chai.expect;
const { deploymentVariables, waitConfirmations } = require("../helpers/variables");
const { network } = require("hardhat")
const should = chai.should();
const EventEmitter = require("events");

describe('FullTest', () => {
  let owner, aliceWhale, operator, bob;
  let serviceContractIndex, tokenContract, depositContract;
  let serviceContracts = [];

  beforeEach(async function () {
    emitter = new EventEmitter();
    if (network.config.type == 'hardhat') await deployments.fixture();
    [owner, aliceWhale, bob, operator] = await ethers.getSigners();

    // get deposit contract
    const depositContractDeployment = await deployments.get('DepositContract')
    const depContract = await ethers.getContractFactory(
      'DepositContract'
    );
    depositContract = await depContract.attach(depositContractDeployment.address);
    
    
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

  it('1. Should be able to do the whole cycle', async function () {
    /*
      1. deposit 32 eth
      2. create validator (mint nft)
      3. send 1 eth to simulate rewards
      4. withdraw from deposit contract
      5. end operator service
      6. withdraw
      7. operator claim
    */
    const { salt, sc } = serviceContracts[0];
    const { salt: salt1, sc: sc1 } = serviceContracts[1];
    let balances = {}
    let tokens = {}
    
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
    tokens.afterCreateValidator = (await tokenContract.balanceOf(aliceWhale.address)).toString();

    // 3. send 1 eth to simulate rewards
    const rewards = ethers.utils.parseEther("1.0");
    const ethsend = await owner.sendTransaction({
      to: depositContract.address,
      value: rewards, // Sends exactly 1.0 ether
    });

    // 4. withdraw from deposit contract
    balances.beforeWithdrawDC = (await ethers.provider.getBalance(sc.address)).toString();
    const wtx = await depositContract.withdrawAllToDepositor();
    await wtx.wait(waitConfirmations[network.config.type]);
    balances.afterWithdrawDC = (await ethers.provider.getBalance(sc.address)).toString();
        
      // pre 5.0 change block time post exit date (2025/09/15)
      await ethers.provider.send("evm_mine", [parseInt(new Date(2024, 0, 2).getTime() / 1000)])
    
    // 5. end operator service
    const eos = await sc.endOperatorServices();
    await eos.wait(waitConfirmations[network.config.type]);

      // 5.1 get withdrawable amount (alice)
      const withdrawableAmt = (await sc.getWithdrawableAmount()).toString();
      
      // 5.2 get operator claimable amount
      const operatorClaimable = (await sc.operatorClaimable()).toString();

      // rewards + amount == withdrawable + operator claimable
      expect(parseInt(withdrawableAmt) + parseInt(operatorClaimable)).to.be.equal(parseInt(amount) + parseInt(rewards));

    // 6. withdraw
    balances.beforeFullWithdraw = (await ethers.provider.getBalance(sc.address)).toString();
    tokens.beforeFullWithdraw = (await tokenContract.balanceOf(aliceWhale.address)).toString();
    const tokenId = await tokenContract.saltToTokenId(salt);
    const withdraw = await tokenContract.connect(aliceWhale).withdraw(tokenId);
    await withdraw.wait(waitConfirmations[network.config.type]);
    balances.afterFullWithdraw = (await ethers.provider.getBalance(sc.address)).toString();
    tokens.afterFullWithdraw = (await tokenContract.balanceOf(aliceWhale.address)).toString();

    // 7. operator claim
    const operatorBalBeforeClaim = (await ethers.provider.getBalance(owner.address)).toString();
    const opc = await sc.connect(owner).operatorClaim();
    await opc.wait(waitConfirmations[network.config.type]);
    const operatorBalAfterClaim = (await ethers.provider.getBalance(owner.address)).toString();
    let tx_fee = ethers.utils.parseEther("0.05");
    let received = parseInt(operatorBalAfterClaim) - parseInt(operatorBalBeforeClaim);
    balances.afterOperatorClaim = (await ethers.provider.getBalance(sc.address)).toString();

    // balance de lo que retira mas la fee, ser mayor igual a operator claimable (lo que puede retirar)
    expect(received + parseInt(tx_fee)).to.be.greaterThanOrEqual(parseInt(operatorClaimable));

    console.log(balances, tokens)

    // ser 32 (despues de retirar del deposit contract y antes del retiro final)
    expect(parseInt(balances.afterWithdrawDC)).to.be.greaterThanOrEqual(parseInt(balances.beforeFullWithdraw));
    expect(parseInt(balances.afterWithdrawDC)).to.be.greaterThanOrEqual(parseInt(amount));
    
    // ser 0 (antes de retirar del deposit contract y luego del retiro final)
    expect(parseInt(balances.beforeWithdrawDC)).to.be.lessThanOrEqual(parseInt(balances.afterFullWithdraw));
    expect(parseInt(balances.beforeWithdrawDC)).to.be.greaterThanOrEqual(parseInt(0));

    // ser 1 (al mintear)
    expect(parseInt(tokens.afterCreateValidator)).to.be.equal(parseInt(tokens.beforeFullWithdraw));
    // ser 0 (al quemar)
    expect(parseInt(tokens.afterFullWithdraw)).to.be.equal(parseInt(0));
  });

  it('2. Should be able to withdraw from deposit contract (mock) being contract owner', async function () {
    /*
      1. deposit 32 eth
      2. create validator (mint nft)
      3. withdraw from deposit contract
      4. end operator service
      5. withdraw
    */
    const { salt, sc } = serviceContracts[0];
    let balances = {}
    
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
    
    // 3. withdraw from deposit contract
    balances.beforeWithdrawDC = (await ethers.provider.getBalance(owner.address)).toString();
    const wtx = await depositContract.withdrawAllToOwner();
    await wtx.wait(waitConfirmations[network.config.type]);
    balances.afterWithdrawDC = (await ethers.provider.getBalance(owner.address)).toString();

    const withdrawn = parseInt(balances.afterWithdrawDC) - parseInt(balances.beforeWithdrawDC);
    const tx_fee = ethers.utils.parseEther("0.05")
    expect(parseInt(amount) - parseInt(tx_fee)).to.be.lessThanOrEqual(withdrawn);
  });

  // it('1. Should be able to do the whole cycle', async function () {
  //   /*
  //     1. deposit 32 eth
  //     2. create validator (mint nft)
  //     3. withdraw from deposit contract
  //     4. end operator service
  //     5. withdraw
  //   */
  //   const { salt, sc } = serviceContracts[0];
  //   const { salt: salt1, sc: sc1 } = serviceContracts[1];
  //   let balances = {}
  //   let tokens = {}
    
  //   let amount = "32000000000000000000"

  //   // 1. deposit 32 eth
  //   const tx = await tokenContract.connect(aliceWhale).fundMultipleContracts([salt], {
  //     value: amount
  //   });
  //   await tx.wait(waitConfirmations[network.config.type]);

  //   // extra deposit for coverage
  //   // const tx2 = await tokenContract.connect(aliceWhale).fundMultipleContracts([salt1], {
  //   //   value: amount
  //   // });
  //   // await tx2.wait(waitConfirmations[network.config.type]);
    
  //   // 2. create validator (mint nft)
  //   const { validatorPubKey, depositSignature, depositDataRoot, exitDate } = serviceContracts[0];
  //   const createValidator = await sc.connect(aliceWhale).createValidator(
  //     validatorPubKey,
  //     depositSignature,
  //     depositDataRoot,
  //     exitDate
  //   );
  //   await createValidator.wait(waitConfirmations[network.config.type]);
  //   tokens.afterCreateValidator = (await tokenContract.balanceOf(aliceWhale.address)).toString();

  //   // extra create validator for coverage
  //   // const { 
  //   //   validatorPubKey: validatorPubKey1, 
  //   //   depositSignature: depositSignature1, 
  //   //   depositDataRoot: depositDataRoot1, 
  //   //   exitDate: exitDate1 
  //   // } = serviceContracts[1];
  //   // const createValidator1 = await sc1.connect(aliceWhale).createValidator(
  //   //   validatorPubKey1,
  //   //   depositSignature1,
  //   //   depositDataRoot1,
  //   //   exitDate1
  //   // );
  //   // await createValidator1.wait(waitConfirmations[network.config.type]);
    
  //   // send 1 ether as if this were the earnings
  //   const ethsend = await owner.sendTransaction({
  //     to: depositContract.address,
  //     value: ethers.utils.parseEther("1.0"), // Sends exactly 1.0 ether
  //   });

  //   // 3. withdraw from deposit contract
  //   balances.beforeWithdrawDC = (await ethers.provider.getBalance(sc.address)).toString();
  //   const wtx = await depositContract.withdrawAllToDepositor();
  //   await wtx.wait(waitConfirmations[network.config.type]);
  //   balances.afterWithdrawDC = (await ethers.provider.getBalance(sc.address)).toString();
    
  //   // extra withdraw for coverage
  //   // const wtx2 = await depositContract.withdrawAllToOwner();
  //   // await wtx2.wait(waitConfirmations[network.config.type]);
  //   // console.log(balances)

  //   console.log('withdrawable amount', (await sc.getWithdrawableAmount()).toString())
  //   console.log('operator claimable amount', (await sc.operatorClaimable()).toString())
  //   // const opc = await sc.connect(aliceWhale).operatorClaim()
  //   // await opc.wait(waitConfirmations[network.config.type]);
        
  //   // pre 4.0 change block time post exit date (2025/09/15)
  //   await ethers.provider.send("evm_mine", [parseInt(new Date(2024, 0, 2).getTime() / 1000)])
    
  //   // 4. end operator service
  //   const eos = await sc.endOperatorServices();
  //   await eos.wait(waitConfirmations[network.config.type]);

  //   // 5. withdraw
  //   balances.beforeFullWithdraw = (await ethers.provider.getBalance(sc.address)).toString();
  //   tokens.beforeFullWithdraw = (await tokenContract.balanceOf(aliceWhale.address)).toString();
  //   const tokenId = await tokenContract.saltToTokenId(salt);
  //   const withdraw = await tokenContract.connect(aliceWhale).withdraw(tokenId);
  //   await withdraw.wait(waitConfirmations[network.config.type]);
  //   balances.afterFullWithdraw = (await ethers.provider.getBalance(sc.address)).toString();
  //   tokens.afterFullWithdraw = (await tokenContract.balanceOf(aliceWhale.address)).toString();

  //   console.log(balances, tokens)
    
  //   // ser 32 (despues de retirar del deposit contract y antes del retiro final)
  //   expect(parseInt(balances.afterWithdrawDC)).to.be.greaterThanOrEqual(parseInt(balances.beforeFullWithdraw));
  //   expect(parseInt(balances.afterWithdrawDC)).to.be.greaterThanOrEqual(parseInt(amount));
    
  //   // ser 0 (antes de retirar del deposit contract y luego del retiro final)
  //   expect(parseInt(balances.beforeWithdrawDC)).to.be.lessThanOrEqual(parseInt(balances.afterFullWithdraw));
  //   expect(parseInt(balances.beforeWithdrawDC)).to.be.greaterThanOrEqual(parseInt(0));

  //   // ser 1 (al mintear)
  //   expect(parseInt(tokens.afterCreateValidator)).to.be.equal(parseInt(tokens.beforeFullWithdraw));
  //   // ser 0 (al quemar)
  //   expect(parseInt(tokens.afterFullWithdraw)).to.be.equal(parseInt(0));
  // });
});