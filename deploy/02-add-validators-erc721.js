const axios = require('axios');
const { BigNumber, utils } = ethers;
const { deploymentVariables } = require("../helpers/variables");
const fs = require('fs');
const { network } = require("hardhat");
const { Keystore } = require('@chainsafe/bls-keystore');

module.exports = async ({ deployments, upgrades, run }) => {
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
    // si en el contrato miramos el tokenIdCounter, es exactamente ese numero el que hay que poner aca
    const start_ = 0;

    // amount of validators
    const serviceContractDeploys = deploymentVariables.servicesToDeploy;
    let validatorPublicKeys = []
    let validatorsData = {}

    // token contract
    const TokenContract = await ethers.getContractFactory(
        'SenseiStakeV2'
    );
    const tokenDeployment = await deployments.get("SenseiStakeV2");
    const tokenContract = await TokenContract.attach(tokenDeployment.address);
    const NNETWK = {
        TOKEN_ADDRESS: tokenDeployment.address,
        CONTRACT_IMPL_ADDRESS: await tokenContract.servicesContractImpl()
    }

    const _date = parseInt((new Date().getTime()) / 1000);
    const _dir = __dirname + `/../keystores/${_date}`
    const _dir_validators = __dirname + `/../validators_data/${_date}`

    let validator_init_array = []

    for (let index = 1 + start_; index <= serviceContractDeploys + start_; index++) {
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
        // let dDate = new Date(new Date().toISOString().slice(0, 10));
        // dDate.setMonth(dDate.getMonth() + 6);
        // const exitDate = BigNumber.from(dDate.getTime() / 1000);

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
                serviceContractAddress: utils.hexlify(contractAddress)
            };
        } else {
            validator_init_array.push([
                utils.hexZeroPad(utils.hexlify(index), 32),
                operatorPubKeyBytes,
                depositData.depositSignature,
                depositData.depositDataRoot
            ])
        }

        validatorPublicKeys.push(utils.hexlify(operatorPubKeyBytes));

        // store keystore in keystores directory
        if (['testnet', 'mainnet'].includes(network.config.type)) {
            if (!fs.existsSync(_dir)) {
                fs.mkdirSync(_dir);
            }
            const keystoreName = `keystore-m_12381_3600_${index - 1}_0_0-${_date}.json`
            fs.writeFileSync(`${_dir}/${keystoreName}`, JSON.stringify(keystore));
        }
    }

    if (['testnet', 'mainnet'].includes(network.config.type)) {
        fs.writeFileSync(`${_dir}/validator_public_keys.json`, JSON.stringify(validatorPublicKeys));
        if (validatorsData && Object.getPrototypeOf(validatorsData) === Object.prototype && Object.keys(validatorsData).length !== 0) {
            if (!fs.existsSync(_dir_validators)) {
                fs.mkdirSync(_dir_validators);
            }
            fs.writeFileSync(`${_dir_validators}/validators_data.json`, JSON.stringify(validatorsData));
        }
    }

    // console.log(validator_init_array[0].map(x => utils.hexlify(x)));

    try {
        const fcs = await tokenContract.unsafeBatchAddValidator(validator_init_array)
        if (['testnet', 'mainnet'].includes(network.config.type)) {
            await fcs.wait(deploymentVariables.waitConfirmations)
        }
    } catch (err) {
        console.log(err);
    }
}

module.exports.tags = ["all", "service_contract", "without_dc"]
module.exports.dependencies = ['SenseiStake'];