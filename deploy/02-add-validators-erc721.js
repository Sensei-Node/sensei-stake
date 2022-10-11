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
        verifySignatureDepositMessageRoot,
        verifySignatureGeneric,
        bufferHex
    } = lib);

    const [deployer] = await ethers.getSigners();

    // start from
    const start_ = 5;

    // amount of validators
    const serviceContractDeploys = deploymentVariables.servicesToDeploy;
    let validatorPublicKeys = []
    let validatorsData = {}

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
    const _dir_validators = __dirname + `/../validators_data/${_date}`

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
        // console.log('PRIVATE KEY', operatorPrivKey.toHex())
        // const keystoreDecryptedPrivKey = '0x' + (await keystore.decrypt(deploymentVariables.keystorePassword)).toString('hex')
        // console.log('DECRYPTED KEYSTORE', keystoreDecryptedPrivKey)
        const contractAddress = saltBytesToContractAddress(utils.hexZeroPad(utils.hexlify(index), 32), NNETWK);
        const depositData = createOperatorDepositData(operatorPrivKey, contractAddress, network.config.type);
        let dDate = new Date(new Date().toISOString().slice(0, 10));
        dDate.setMonth(dDate.getMonth() + 6);
        const exitDate = BigNumber.from(dDate.getTime() / 1000);

        // Local check for signature validity
        const validSignature = verifySignatureDepositMessageRoot(depositData)
        if (!validSignature) {
            console.error('Deposit signature invalid for pubkey', utils.hexlify(depositData.validatorPubKey));
            break;
        }

        // if owner was changed to multisig, we cannot upload from here
        // we will need to store data for uploading from multisig
        const tokenOwner = await tokenContract.owner();
        if (tokenOwner.toLowerCase() != deployer.address.toLowerCase()) {
            // For storing validator data in case later on needed
            validatorsData[index] = {
                index: utils.hexZeroPad(utils.hexlify(index), 32),
                validatorPubKey: utils.hexlify(operatorPubKeyBytes),
                depositSignature: utils.hexlify(depositData.depositSignature),
                depositDataRoot: utils.hexlify(depositData.depositDataRoot),
                network: network.config.type,
                exitDate: utils.hexlify(exitDate),
            };
        } else {
            const fcs = await tokenContract.addValidator(
                utils.hexZeroPad(utils.hexlify(index), 32),
                operatorPubKeyBytes,
                depositData.depositSignature,
                depositData.depositDataRoot,
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
                depositDataRoot: bufferHex(validator_bc.depositDataRoot.slice(2)),
                network: network.config.type,
                exitDate: exitDate,
                index: utils.hexZeroPad(utils.hexlify(index), 32)
            }
    
            // Checking signature of uploaded depositDataRoot with uploaded validatorPubKey (the signature was created on createOperatorDepositData.depositDataSignature)
            const validSignatureDepositData = verifySignatureGeneric(validator_corrected.validatorPubKey, validator_corrected.depositDataRoot, depositData.depositDataSignature)
            if (!validSignatureDepositData) {
                console.error('Deposit signature invalid for pubkey', utils.hexlify(validator_corrected.validatorPubKey));
                break;
            }
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
        if (!fs.existsSync(_dir_validators)){
            fs.mkdirSync(_dir_validators);
        }
        fs.writeFileSync(`${_dir_validators}/validators_data.json`, JSON.stringify(validatorsData));
    }
}

module.exports.tags = ["all", "service_contract", "without_dc"]
module.exports.dependencies = ['SenseiStake'];