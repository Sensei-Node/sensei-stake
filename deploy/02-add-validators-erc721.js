const axios = require('axios');
const { BigNumber, utils } = ethers;
const { deploymentVariables } = require("../helpers/variables");
const strapi_url = process.env.STRAPI_URL;
// const { deployServiceContract } = require("../scripts/full-service-contract-deploy");
const fs = require('fs');
const { network } = require("hardhat");
const { Keystore } = require('@chainsafe/bls-keystore');
// const { keccak256 } = utils;
// const strapi_path = '/service-contracts'

module.exports = async ({deployments, upgrades, run}) => {
    let jwt;
    try {
        let { data } = await axios.post(strapi_url+'/auth/local', {
            identifier: process.env.STRAPI_OPERATOR_IDENTIFIER,
            password: process.env.STRAPI_OPERATOR_PASSWORD
        });
        jwt = data.jwt;
    } catch (err) {
        console.error(err);
    }

    const lib = await import('../lib/senseistake-services-contract.mjs');
    ({
        bls,
        createOperatorDepositData,
        saltBytesToContractAddress
    } = lib);

    // amount of validators
    const serviceContractDeploys = deploymentVariables.servicesToDeploy;
    let validatorPublicKeys = []

    // token contract
    const TokenContract = await ethers.getContractFactory(
        'SenseistakeERC721'
    );
    const tokenDeployment = await deployments.get("SenseistakeERC721");
    const tokenContract = await TokenContract.attach(tokenDeployment.address);
    const NNETWK = {
        TOKEN_ADDRESS: tokenDeployment.address,
        CONTRACT_IMPL_ADDRESS: await tokenContract.servicesContractImpl()
    }

    for (let index = 1; index <= serviceContractDeploys; index++) {
        // deposit data and keystores
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

        await tokenContract.addValidator(
            utils.hexZeroPad(utils.hexlify(index), 32),
            operatorPubKeyBytes,
            depositData.depositSignature,
            depositData.depositDataRoot,
            exitDate
        )
        if (['testnet', 'mainnet'].includes(network.config.type)) {
            await fcs.wait(deploymentVariables.waitConfirmations)
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
            const _date = parseInt((new Date().getTime()) / 1000);
            const keystoreName = `keystore-m_12381_3600_${index-1}_0_0-${_date}.json`
            fs.writeFileSync(__dirname + `/../keystores/${keystoreName}`, JSON.stringify(keystore));
        }
    }  
    
    if (['testnet', 'mainnet'].includes(network.config.type)) {
        fs.writeFileSync(__dirname + `/../keystores/validator_public_keys.json`, JSON.stringify(validatorPublicKeys));
    }
}

module.exports.tags = ["all", "service-contract"]