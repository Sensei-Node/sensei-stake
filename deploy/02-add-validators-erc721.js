const axios = require('axios');
const { BigNumber, utils } = ethers;
const { deploymentVariables } = require("../helpers/variables");
const fs = require('fs');
const { network } = require("hardhat");
const { Keystore } = require('@chainsafe/bls-keystore');

module.exports = async ({deployments, upgrades, run}) => {
    const lib = await import('../lib/senseistake-services-contract.mjs');
    ({
        bls,
        createOperatorDepositData,
        saltBytesToContractAddress,
        verifySignature,
        bufferHex
    } = lib);

    // start from
    const start_ = 0;

    // amount of validators
    const serviceContractDeploys = deploymentVariables.servicesToDeploy;
    let validatorPublicKeys = []

    // token contract
    const TokenContract = await ethers.getContractFactory(
        'SenseiStake'
    );
    const tokenDeployment = await deployments.get("SenseiStake");
    const tokenContract = await TokenContract.attach(tokenDeployment.address);
    const NNETWK = {
        TOKEN_ADDRESS: tokenDeployment.address,
        CONTRACT_IMPL_ADDRESS: await tokenContract.servicesContractImpl()
    }

    const _date = parseInt((new Date().getTime()) / 1000);
    const _dir = __dirname + `/../keystores/${_date}`

    for (let index = 1+start_; index <= serviceContractDeploys+start_; index++) {
        // deposit data and keystores
        console.log('Adding Validator', index);
        const operatorPrivKey = bls.SecretKey.fromKeygen();
        const operatorPubKeyBytes = operatorPrivKey.toPublicKey().toBytes();
        const keystorePath = "m/12381/60/0/0";
        const keystore = await Keystore.create(
            deploymentVariables.keystorePassword,
            operatorPrivKey.toBytes(),
            operatorPubKeyBytes,
            keystorePath);
        const contractAddress = saltBytesToContractAddress(utils.hexZeroPad(utils.hexlify(index), 32), NNETWK);
        const depositData = createOperatorDepositData(operatorPrivKey, contractAddress, network.config.type);
        const exitDate = BigNumber.from(new Date(2024, 0, 1).getTime() / 1000);

        // Local check for signature validity
        const validSignature = verifySignature(depositData)
        if (!validSignature) {
            console.error('Deposit signature invalid for pubkey', utils.hexlify(depositData.validatorPubKey));
            break;
        }
        
        const fcs = await tokenContract.addValidator(
            utils.hexZeroPad(utils.hexlify(index), 32),
            operatorPubKeyBytes,
            depositData.depositSignature,
            depositData.depositDataRoot,
            depositData.depositMessageRoot,
            exitDate
        )
        if (['testnet', 'mainnet'].includes(network.config.type)) {
            await fcs.wait(deploymentVariables.waitConfirmations)
        }

        // Blockchain validator check for signature validity
        // First we get uploaded validator data
        const validator_bc = await tokenContract.validators(index);
        const validator_corrected = {
            // validatorPubKey: bufferHex('b43c3e2192124c3c7bb3871d65dd0bbbf467bd534f2c45a40db02cddcdd4a0245bf7368908f9ffac102d4bfb84efd5bb'), // this should fail and break
            validatorPubKey: bufferHex(validator_bc.validatorPubKey.slice(2)),
            depositSignature: bufferHex(validator_bc.depositSignature.slice(2)),
            depositMessageRoot: bufferHex(validator_bc.depositMessageRoot.slice(2)),
            network: network.config.type
        }
        // Then we format it with buffer and verify it
        const validSignature_blockchain = verifySignature(validator_corrected)
        if (!validSignature_blockchain) {
            console.error('Deposit signature invalid for pubkey', validator_bc.validatorPubKey);
            break;
        }

        validatorPublicKeys.push(utils.hexlify(operatorPubKeyBytes));
    
        // console.log("\n-- Validator (operator) deposit data --")
        // console.log("Validator public address: ", utils.hexlify(service_contract.depositData.validatorPubKey));
        // console.log("Validator deposit signature: ", utils.hexlify(service_contract.depositData.depositSignature));
        // console.log("Validator deposit data root: ", utils.hexlify(service_contract.depositData.depositDataRoot));
        // console.log("Exit date: ", utils.hexlify(service_contract.exitDate));
        // console.log("-- EOF --\n")
        // console.log("\n-- Validator (operator) keystore --")
        // console.log(JSON.stringify(service_contract.keystore));
        // console.log("-- EOF --\n")

        // store keystore in keystores directory
        if (['testnet', 'mainnet'].includes(network.config.type)) {
            if (!fs.existsSync(_dir)){
                fs.mkdirSync(_dir);
            }
            const keystoreName = `keystore-m_12381_3600_${index-1}_0_0-${_date}.json`
            fs.writeFileSync(`${_dir}/${keystoreName}`, JSON.stringify(keystore));
        }
    }  
    
    if (['testnet', 'mainnet'].includes(network.config.type)) {
        fs.writeFileSync(`${_dir}/validator_public_keys.json`, JSON.stringify(validatorPublicKeys));
    }
}

module.exports.tags = ["all", "service_contract"]