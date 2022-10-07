const {deployments} = require('hardhat');
const {ethers} = require('hardhat');
const {utils} = {ethers};
const chai = require('chai');
require('solidity-coverage');
const expect = chai.expect;
const { deploymentVariables, waitConfirmations } = require("../helpers/variables");
const { network } = require("hardhat")
const should = chai.should();

describe('Transactions', () => {
  let owner, aliceWhale, otherPerson, bob;
  let serviceContractIndex, tokenContract, contrService;
  let depositContractDeployment;

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
    depositContractDeployment = await deployments.get('DepositContract')
    const depContract = await ethers.getContractFactory(
        'DepositContract'
    );
    depositContract = await depContract.attach(depositContractDeployment.address);
    
    contrService = await ethers.getContractFactory(
        'SenseistakeServicesContract'
    );
    //utils.hexZeroPad(utils.hexlify(index), 32)
  });

  describe('1. submit new transaction', async function () {
    it('1.1 Should be able to submit new transaction if operator calls', async function () {
        await tokenContract.connect(aliceWhale).createContract({
            value: ethers.utils.parseEther("32")
        });

        const sc_addr = await tokenContract.getServiceContractAddress(1);
        const sc = await contrService.attach(sc_addr);

        const iface = new ethers.utils.Interface(depositContractDeployment.abi);
        const data = iface.encodeFunctionData('withdrawAll', []);
        
        const submitTransaction = await sc.submitTransaction(
            [depositContract.address, 0, data], 
            'Testing Get Depositor Address'
        );

        await expect(submitTransaction).to.be.ok;
    });

    it('1.2 Should fail transaction submission if not operator calls', async function () {
        await tokenContract.connect(aliceWhale).createContract({
            value: ethers.utils.parseEther("32")
        });

        const sc_addr = await tokenContract.getServiceContractAddress(1);
        const sc = await contrService.attach(sc_addr);

        const iface = new ethers.utils.Interface(depositContractDeployment.abi);
        const data = iface.encodeFunctionData('withdrawAll', []);

        const submitTransaction = sc.connect(aliceWhale).submitTransaction(
            [depositContract.address, 0, data], 
            'Testing Get Depositor Address'
        );
        
        await expect(submitTransaction).to.be.revertedWith('NotOperator');
    });

    it('1.3 Should be able to confirm transaction if owner or allowed person calls', async function () {
        await tokenContract.connect(aliceWhale).createContract({
            value: ethers.utils.parseEther("32")
        });

        const sc_addr = await tokenContract.getServiceContractAddress(1);
        const sc = await contrService.attach(sc_addr);

        // whitelisting address so that we can call withdrawAll
        await depositContract.whitelist(sc_addr);
        // getting current balance of service contract
        const balance_before = await ethers.provider.getBalance(sc_addr);

        const iface = new ethers.utils.Interface(depositContractDeployment.abi);
        const data = iface.encodeFunctionData('withdrawAll', []);
        const submitTransaction = await sc.submitTransaction(
            [depositContract.address, 0, data], 
            'Testing Withdraw All to ServiceContract'
        );
        const confirmTransaction = await sc.connect(aliceWhale).confirmTransaction(0);
        await expect(confirmTransaction).to.be.ok;
    });

    it('1.4 Should be able to execute transaction if previously confirmed by user', async function () {
        await tokenContract.connect(aliceWhale).createContract({
            value: ethers.utils.parseEther("32")
        });

        const sc_addr = await tokenContract.getServiceContractAddress(1);
        const sc = await contrService.attach(sc_addr);

        // whitelisting address so that we can call withdrawAll
        await depositContract.whitelist(sc_addr);
        // getting current balance of service contract
        const balance_before = await ethers.provider.getBalance(sc_addr);

        const iface = new ethers.utils.Interface(depositContractDeployment.abi);
        const data = iface.encodeFunctionData('withdrawAll', []);
        const submitTransaction = await sc.submitTransaction(
            [depositContract.address, 0, data], 
            'Testing Withdraw All to ServiceContract'
        );
        const confirmTransaction = await sc.connect(aliceWhale).confirmTransaction(0);
        await expect(confirmTransaction).to.be.ok;

        const executeTransaction = await sc.executeTransaction(0);
        const balance_after = await ethers.provider.getBalance(sc_addr);
        const gained = ethers.utils.formatEther(balance_after) - ethers.utils.formatEther(balance_before)

        await expect(gained).to.be.equals(32);
        await expect(executeTransaction).to.be.ok;
    });

    it('1.5 Should be able to execute transaction (testing cancel in between)', async function () {
        await tokenContract.connect(aliceWhale).createContract({
            value: ethers.utils.parseEther("32")
        });

        const sc_addr = await tokenContract.getServiceContractAddress(1);
        const sc = await contrService.attach(sc_addr);

        // whitelisting address so that we can call withdrawAll
        await depositContract.whitelist(sc_addr);
        // getting current balance of service contract
        const balance_before = await ethers.provider.getBalance(sc_addr);

        const iface = new ethers.utils.Interface(depositContractDeployment.abi);
        const data = iface.encodeFunctionData('withdrawAll', []);
        
        // we create 3 equals and confirm them by client
        for (let index = 0; index < 3; index++) {
            const submitTransaction = await sc.submitTransaction(
                [depositContract.address, 0, data], 
                'Testing Withdraw All to ServiceContract'
            );
            const confirmTransaction = await sc.connect(aliceWhale).confirmTransaction(index);
            await expect(confirmTransaction).to.be.ok;
        }

        // but then, we get rid of the first and seccond with cancel
        for (let index = 0; index < 2; index++) {
            const cancelTransaction = await sc.cancelTransaction(index);
            await expect(cancelTransaction).to.be.ok;
        }

        const executeTransaction = await sc.executeTransaction(2);
        const balance_after = await ethers.provider.getBalance(sc_addr);
        const gained = ethers.utils.formatEther(balance_after) - ethers.utils.formatEther(balance_before)

        await expect(gained).to.be.equals(32);
        await expect(executeTransaction).to.be.ok;
    });

    it('1.6 Should be able to execute transaction testing deleting again different scenario', async function () {
        await tokenContract.connect(aliceWhale).createContract({
            value: ethers.utils.parseEther("32")
        });

        const sc_addr = await tokenContract.getServiceContractAddress(1);
        const sc = await contrService.attach(sc_addr);

        // whitelisting address so that we can call withdrawAll
        await depositContract.whitelist(sc_addr);
        // getting current balance of service contract
        const balance_before = await ethers.provider.getBalance(sc_addr);

        const iface = new ethers.utils.Interface(depositContractDeployment.abi);
        const data = iface.encodeFunctionData('withdrawAll', []);
        
        // we create 3 equals and confirm them by client, and then delete them
        for (let index = 0; index < 3; index++) {
            const submitTransaction = await sc.submitTransaction(
                [depositContract.address, 0, data], 
                'Testing Withdraw All to ServiceContract'
            );
            const confirmTransaction = await sc.connect(aliceWhale).confirmTransaction(0);
            await expect(confirmTransaction).to.be.ok;

            const cancelTransaction = await sc.cancelTransaction(0);
            await expect(cancelTransaction).to.be.ok;
        }

        // const count = await sc.getTransactionCount();
        // console.log(count);

        // create the final one
        const submitTransaction = await sc.submitTransaction(
            [depositContract.address, 0, data], 
            'Testing Withdraw All to ServiceContract'
        );
        const confirmTransaction = await sc.connect(aliceWhale).confirmTransaction(0);
        const executeTransaction = await sc.executeTransaction(0);
        const balance_after = await ethers.provider.getBalance(sc_addr);
        const gained = ethers.utils.formatEther(balance_after) - ethers.utils.formatEther(balance_before)

        await expect(gained).to.be.equals(32);
        await expect(executeTransaction).to.be.ok;
    });

    it('1.7 Should be able to execute transaction testing deleting again different scenario create create delete', async function () {
        await tokenContract.connect(aliceWhale).createContract({
            value: ethers.utils.parseEther("32")
        });

        const sc_addr = await tokenContract.getServiceContractAddress(1);
        const sc = await contrService.attach(sc_addr);

        // whitelisting address so that we can call withdrawAll
        await depositContract.whitelist(sc_addr);
        // getting current balance of service contract
        const balance_before = await ethers.provider.getBalance(sc_addr);

        const iface = new ethers.utils.Interface(depositContractDeployment.abi);
        const data = iface.encodeFunctionData('withdrawAll', []);
        
        // we create 2 equals and confirm them by client, and then delete them
        await sc.submitTransaction(
            [depositContract.address, 0, data], 
            'Testing Withdraw All to ServiceContract'
        );
        await sc.connect(aliceWhale).confirmTransaction(0);
        await sc.submitTransaction(
            [depositContract.address, 0, data], 
            'Testing Withdraw All to ServiceContract'
        );
        await sc.connect(aliceWhale).confirmTransaction(1);

        // cancel 0
        await sc.cancelTransaction(0);

        const count = await sc.getTransactionCount();
        console.log('tx count', count);

        // execute 1
        const executeTransaction = await sc.executeTransaction(1);
        const balance_after = await ethers.provider.getBalance(sc_addr);
        const gained = ethers.utils.formatEther(balance_after) - ethers.utils.formatEther(balance_before)

        await expect(gained).to.be.equals(32);
        await expect(executeTransaction).to.be.ok;
    });

    it('1.8 Should fail execution if create create delete create confirm all, execute last one', async function () {
        await tokenContract.connect(aliceWhale).createContract({
            value: ethers.utils.parseEther("32")
        });

        const sc_addr = await tokenContract.getServiceContractAddress(1);
        const sc = await contrService.attach(sc_addr);

        // whitelisting address so that we can call withdrawAll
        await depositContract.whitelist(sc_addr);
        // getting current balance of service contract
        const balance_before = await ethers.provider.getBalance(sc_addr);

        const iface = new ethers.utils.Interface(depositContractDeployment.abi);
        const data = iface.encodeFunctionData('withdrawAll', []);
        
        // we create 2 equals and confirm them by client, and then delete them
        await sc.submitTransaction(
            [depositContract.address, 0, data], 
            'Testing Withdraw All to ServiceContract'
        );
        await sc.connect(aliceWhale).confirmTransaction(0);
        await sc.submitTransaction(
            [depositContract.address, 0, data], 
            'Testing Withdraw All to ServiceContract'
        );
        await sc.connect(aliceWhale).confirmTransaction(1);

        // cancel 0
        await sc.cancelTransaction(1);

        // create 1 more
        await sc.submitTransaction(
            [depositContract.address, 0, data], 
            'Testing Withdraw All to ServiceContract'
        );
        await sc.connect(aliceWhale).confirmTransaction(2);

        const count = await sc.getTransactionCount();
        console.log('tx count', count);

        // execute 1
        const executeTransaction = sc.executeTransaction(2);

        await expect(executeTransaction).to.be.revertedWith('PreviousValidTransactionNotExecuted');
    });

    // it('1.4 Should revert if caller is not token owner', async function () {
    //     await tokenContract.connect(aliceWhale).createContract({
    //         value: ethers.utils.parseEther("32")
    //     });

    //     const sc_addr = await tokenContract.getServiceContractAddress(1);
    //     const sc = await contrService.attach(sc_addr);

    //     const iface = new ethers.utils.Interface(depositContractDeployment.abi);
    //     const data = iface.encodeFunctionData('withdrawAll', []);

    //     const submitTransaction = await sc.submitTransaction(
    //         depositContract.address,
    //         0,
    //         data,
    //         'Testing Get Depositor Address'
    //     );

    //     const executeTransaction = sc.executeTransaction(0);
        
    //     await expect(executeTransaction).to.be.revertedWith('CallerNotAllowed');
    // });

    // it('1.5 Should fail if same transaction executed twice', async function () {
    //     await tokenContract.connect(aliceWhale).createContract({
    //         value: ethers.utils.parseEther("32")
    //     });

    //     const sc_addr = await tokenContract.getServiceContractAddress(1);
    //     const sc = await contrService.attach(sc_addr);

    //     // whitelisting address so that we can call withdrawAll
    //     await depositContract.whitelist(sc_addr);

    //     const iface = new ethers.utils.Interface(depositContractDeployment.abi);
    //     const data = iface.encodeFunctionData('withdrawAll', []);
    //     const submitTransaction = await sc.submitTransaction(
    //         depositContract.address,
    //         0,
    //         data,
    //         'Testing Withdraw All to ServiceContract'
    //     );
    //     await sc.connect(aliceWhale).executeTransaction(0);
    //     const executeTransaction = sc.connect(aliceWhale).executeTransaction(0);

    //     await expect(executeTransaction).to.be.revertedWith('TransactionAlreadyExecuted')
    // });
  });

//   describe('1. submit new transaction', async function () {
//     it('1.1 Should be able to submit new transaction if operator calls', async function () {
//         await tokenContract.connect(aliceWhale).createContract({
//             value: ethers.utils.parseEther("32")
//         });

//         const sc_addr = await tokenContract.getServiceContractAddress(1);
//         const sc = await contrService.attach(sc_addr);

//         const iface = new ethers.utils.Interface(depositContractDeployment.abi);
//         const data = iface.encodeFunctionData('withdrawAll', []);

//         const submitTransaction = sc.submitTransaction(
//             depositContract.address,
//             0,
//             data,
//             'Testing Get Depositor Address'
//         );
        
//         // const txCount = await sc.getTransactionCount();

//         await expect(submitTransaction).to.be.ok;
//         // await expect(txCount).to.be.equals(1);
//     });

//     it('1.2 Should faul transaction submission if not operator calls', async function () {
//         await tokenContract.connect(aliceWhale).createContract({
//             value: ethers.utils.parseEther("32")
//         });

//         const sc_addr = await tokenContract.getServiceContractAddress(1);
//         const sc = await contrService.attach(sc_addr);

//         const iface = new ethers.utils.Interface(depositContractDeployment.abi);
//         const data = iface.encodeFunctionData('withdrawAll', []);

//         const submitTransaction = sc.connect(aliceWhale).submitTransaction(
//             depositContract.address,
//             0,
//             data,
//             'Testing Get Depositor Address'
//         );
        
//         await expect(submitTransaction).to.be.revertedWith('NotOperator');
//     });

//     it('1.3 Should be able to execute transaction if token owner', async function () {
//         await tokenContract.connect(aliceWhale).createContract({
//             value: ethers.utils.parseEther("32")
//         });

//         const sc_addr = await tokenContract.getServiceContractAddress(1);
//         const sc = await contrService.attach(sc_addr);

//         // whitelisting address so that we can call withdrawAll
//         await depositContract.whitelist(sc_addr);
//         // getting current balance of service contract
//         const balance_before = await ethers.provider.getBalance(sc_addr);

//         const iface = new ethers.utils.Interface(depositContractDeployment.abi);
//         const data = iface.encodeFunctionData('withdrawAll', []);
//         const submitTransaction = await sc.submitTransaction(
//             depositContract.address,
//             0,
//             data,
//             'Testing Withdraw All to ServiceContract'
//         );
//         const executeTransaction = await sc.connect(aliceWhale).executeTransaction(0);
        
//         const balance_after = await ethers.provider.getBalance(sc_addr);
//         const gained = ethers.utils.formatEther(balance_after) - ethers.utils.formatEther(balance_before)

//         await expect (gained).to.be.equals(32);
//         await expect(executeTransaction).to.be.ok;
//     });

//     it('1.4 Should revert if caller is not token owner', async function () {
//         await tokenContract.connect(aliceWhale).createContract({
//             value: ethers.utils.parseEther("32")
//         });

//         const sc_addr = await tokenContract.getServiceContractAddress(1);
//         const sc = await contrService.attach(sc_addr);

//         const iface = new ethers.utils.Interface(depositContractDeployment.abi);
//         const data = iface.encodeFunctionData('withdrawAll', []);

//         const submitTransaction = await sc.submitTransaction(
//             depositContract.address,
//             0,
//             data,
//             'Testing Get Depositor Address'
//         );

//         const executeTransaction = sc.executeTransaction(0);
        
//         await expect(executeTransaction).to.be.revertedWith('CallerNotAllowed');
//     });

//     it('1.5 Should fail if same transaction executed twice', async function () {
//         await tokenContract.connect(aliceWhale).createContract({
//             value: ethers.utils.parseEther("32")
//         });

//         const sc_addr = await tokenContract.getServiceContractAddress(1);
//         const sc = await contrService.attach(sc_addr);

//         // whitelisting address so that we can call withdrawAll
//         await depositContract.whitelist(sc_addr);

//         const iface = new ethers.utils.Interface(depositContractDeployment.abi);
//         const data = iface.encodeFunctionData('withdrawAll', []);
//         const submitTransaction = await sc.submitTransaction(
//             depositContract.address,
//             0,
//             data,
//             'Testing Withdraw All to ServiceContract'
//         );
//         await sc.connect(aliceWhale).executeTransaction(0);
//         const executeTransaction = sc.connect(aliceWhale).executeTransaction(0);

//         await expect(executeTransaction).to.be.revertedWith('TransactionAlreadyExecuted')
//     });
//   });
});