const { network } = require("hardhat");
const { Keystore } = require('@chainsafe/bls-keystore');
const { randomBytes } = require('crypto');
const axios = require('axios');
const { BigNumber, utils } = ethers;
const { deploymentVariables } = require("../helpers/variables");
// const { keccak256 } = utils;
const strapi_url = process.env.STRAPI_URL;
const strapi_path = '/service-contracts'
const fs = require('fs');

module.exports.deployServiceContract = async (deployments, upgrades, run, jwt) => {
    const { deploy, log, save } = deployments;
    const [deployer] = await ethers.getSigners();

    const tokenDeployment = await deployments.get("SenseiStake");

    // Storage saving, doing it ASAP in case there is another call for this
    let index = 1;
    try {
        index = ((await deployments.get("SSLastIndex")).address) + 1;
    } catch {}
    console.log("INDEX TO DEPLOY", index);
    await save('SSLastIndex', { address: index })

    const lib = await import('../lib/senseistake-services-contract.mjs');
    ({
        bls,
        createOperatorCommitment,
        createOperatorDepositData,
        saltBytesToContractAddress
    } = lib);

    if (!jwt) {
        try {
            let { data } = await axios.post(strapi_url+'/auth/local', {
                identifier: process.env.STRAPI_OPERATOR_IDENTIFIER,
                password: process.env.STRAPI_OPERATOR_PASSWORD
            });
            jwt = data.jwt;
        } catch (err) {
            console.error(err);
        }
    }
    
    const operatorPrivKey = bls.SecretKey.fromKeygen();
    const operatorPubKeyBytes = operatorPrivKey.toPublicKey().toBytes();
    const keystorePath = "m/12381/60/0/0";
    // const keystorePath = "m/12381/3600/0/0/0";

    const keystore = await Keystore.create(
        deploymentVariables.keystorePassword,
        operatorPrivKey.toBytes(),
        operatorPubKeyBytes,
        keystorePath);

    console.log("Deploying contracts with the account:", deployer.address);
    console.log("Account balance:", (await deployer.getBalance()).toString());

    const saltBytes = randomBytes(32);

    const TokenContract = await ethers.getContractFactory(
        'SenseiStake'
    );
    const tokenContract = await TokenContract.attach(tokenDeployment.address);

    const NNETWK = {
        TOKEN_ADDRESS: tokenDeployment.address,
        CONTRACT_IMPL_ADDRESS: await tokenContract.servicesContractImpl()
    }
    const contractAddress = saltBytesToContractAddress(saltBytes, NNETWK);

    const depositData = createOperatorDepositData(operatorPrivKey, contractAddress, network.config.type);

    const exitDate = BigNumber.from(new Date(2024, 0, 1).getTime() / 1000);
    console.log('exit date dec:', exitDate.toString(), '- bignum:', exitDate)

    let commitment = createOperatorCommitment(
        contractAddress,
        operatorPubKeyBytes,
        depositData.depositSignature,
        depositData.depositDataRoot,
        exitDate)

    const fcs = await tokenContract.createContract(saltBytes, commitment);
    if (['testnet', 'mainnet'].includes(network.config.type)) {
        await fcs.wait(deploymentVariables.waitConfirmations)
    }

    console.log("Service contract deployed at: ", contractAddress);
    console.log("Salt bytes (remix format):", `["0x${saltBytes.toString("hex")}"]`);

    console.log("")
    console.log("Operator pubkey:", utils.hexlify(operatorPubKeyBytes), "- Validator pubkey:", utils.hexlify(depositData.validatorPubKey))
    console.log("")

    // Setting the ERC20 address in the service contract
    const SenseistakeServicesContract = await ethers.getContractFactory(
        'SenseistakeServicesContract'
    );
    const servicesContract = await SenseistakeServicesContract.attach(contractAddress);
    const tx1 = await servicesContract.setTokenContractAddress(tokenDeployment.address);
    if (['testnet', 'mainnet'].includes(network.config.type)) {
        await tx1.wait(deploymentVariables.waitConfirmations)
    }

    // parametrizing the ethereum deposit contract address
    let ethDepositContractAddress;
    try {
        ethDepositContractAddress = await deployments.get("DepositContract");
        console.log(`\n --- UTILIZA DEPOSIT CONTRACT PROPIO: ${ethDepositContractAddress.address} --- \n`);
    } catch(err) {
        console.log('\n --- NO UTILIZA DEPOSIT CONTRACT PROPIO, USA EL DE LA RED --- \n');
        ethDepositContractAddress = deploymentVariables.depositContractAddress[network.config.chainId] ? 
        { address: deploymentVariables.depositContractAddress[network.config.chainId] } : { address: '0x00000000219ab540356cBB839Cbe05303d7705Fa' }
    }
    const tx2 = await servicesContract.setEthDepositContractAddress(ethDepositContractAddress.address);
    if (['testnet', 'mainnet'].includes(network.config.type)) {
        await tx2.wait(deploymentVariables.waitConfirmations)
    }

    // save it for other deployments usage
    const artifact = await deployments.getExtendedArtifact('SenseistakeServicesContract');
    let proxyDeployments = {
        address: servicesContract.address,
        ...artifact
    }

    // ! POST to STRAPI newly available deploy
    if (['testnet', 'mainnet'].includes(network.config.type)) {
        if (jwt) {
            // get token id from blockchain
            const tokenId = await tokenContract.saltToTokenId(`0x${saltBytes.toString("hex")}`);
            try {
                await axios.post(strapi_url+strapi_path, {
                    validatorPubKey: utils.hexlify(depositData.validatorPubKey),
                    depositSignature: utils.hexlify(depositData.depositSignature),
                    depositDataRoot: utils.hexlify(depositData.depositDataRoot),
                    exitDate: utils.hexlify(exitDate),
                    serviceContractAddress: contractAddress,
                    network: network.config.name,
                    salt: `0x${saltBytes.toString("hex")}`,
                    onQueue: true,
                    tokenId: tokenId.toString(),
                }, { headers: { authorization: `Bearer ${jwt}` }});
            } catch (err) {
                console.error(err);
            }
        } else {
            console.error('Unauthorized, please get the JWT token')
        }
    }

    // store keystore in keystores directory
    if (['testnet', 'mainnet'].includes(network.config.type)) {
        const _date = parseInt((new Date().getTime()) / 1000);
        const keystoreName = `keystore-m_12381_3600_${index-1}_0_0-${_date}.json`
        fs.writeFileSync(__dirname + `/../keystores/${keystoreName}`, JSON.stringify(keystore));
    }

    await save('SenseistakeServicesContract'+index, proxyDeployments);
    await save('ServiceContractSalt'+index, {address: `0x${saltBytes.toString("hex")}`});
    await save('SSvalidatorPubKey'+index, {address: utils.hexlify(depositData.validatorPubKey)});
    await save('SSdepositSignature'+index, {address: utils.hexlify(depositData.depositSignature)});
    await save('SSdepositDataRoot'+index, {address: utils.hexlify(depositData.depositDataRoot)});
    await save('SSexitDate'+index, {address: utils.hexlify(exitDate)});

    return {
        depositData,
        exitDate,
        keystore
    }
}
