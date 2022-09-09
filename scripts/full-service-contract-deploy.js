const { network } = require("hardhat");
const { Keystore } = require('@chainsafe/bls-keystore');
const { randomBytes } = require('crypto');
const axios = require('axios');
const { BigNumber, utils } = ethers;
const { deploymentVariables } = require("../helpers/variables");
const { keccak256 } = utils;
const strapi_url = process.env.STRAPI_URL;
const strapi_path = '/service-contracts'
const fs = require('fs');

module.exports.deployServiceContract = async (deployments, upgrades, run, jwt) => {
    const { deploy, log, save } = deployments;
    const [deployer] = await ethers.getSigners();

    const factoryDeployment = await deployments.get("SenseistakeServicesContractFactory");
    const tokenDeployment = await deployments.get("SenseistakeERC721");

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

    const FactoryContract = await ethers.getContractFactory(
        'SenseistakeServicesContractFactory'
    );
    const factoryContract = await FactoryContract.attach(factoryDeployment.address);

    const NNETWK = {
        FACTORY_ADDRESS: factoryDeployment.address,
        CONTRACT_IMPL_ADDRESS: await factoryContract.getServicesContractImpl()
    }
    const contractAddress = saltBytesToContractAddress(saltBytes, NNETWK);

    const depositData = createOperatorDepositData(operatorPrivKey, contractAddress, network.config.type);

    const exitDate = BigNumber.from(new Date(2024).getTime());
    // ~4 months from now
    // const exitDate = BigNumber.from(parseInt((new Date().getTime() + 9000000000) / 1000));
    console.log('exit date dec:', exitDate.toString(), '- bignum:', exitDate)

    let commitment = createOperatorCommitment(
        contractAddress,
        operatorPubKeyBytes,
        depositData.depositSignature,
        depositData.depositDataRoot,
        exitDate)

    const fcs = await factoryContract.createContract(saltBytes, commitment);
    if (['testnet', 'mainnet'].includes(network.config.type)) {
        await fcs.wait(2)
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
    await servicesContract.setTokenContractAddress(tokenDeployment.address);

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
    await servicesContract.setEthDepositContractAddress(ethDepositContractAddress.address);
    // TODO: test if a later call to this function does a revert (because of the immutable keyword)

    // save it for other deployments usage
    const artifact = await deployments.getExtendedArtifact('SenseistakeServicesContract');
    let proxyDeployments = {
        address: servicesContract.address,
        ...artifact
    }

    // ! POST to STRAPI newly available deploy
    if (['testnet', 'mainnet'].includes(network.config.type)) {
        if (jwt) {
            // const _date = parseInt((new Date().getTime()) / 1000);
            // const keystoreName = `keystore-m_12381_3600_${index-1}_0_0-${_date}.json`
            try {
                await axios.post(strapi_url+strapi_path, {
                    validatorPubKey: utils.hexlify(depositData.validatorPubKey),
                    depositSignature: utils.hexlify(depositData.depositSignature),
                    depositDataRoot: utils.hexlify(depositData.depositDataRoot),
                    exitDate: utils.hexlify(exitDate),
                    // keystore,
                    // keystoreName,
                    serviceContractAddress: contractAddress,
                    network: network.config.name,
                    salt: `0x${saltBytes.toString("hex")}`,
                    onQueue: true
                }, { headers: { authorization: `Bearer ${jwt}` }});
            } catch (err) {
                console.error(err);
            }
        } else {
            console.error('Unauthorized, please get the JWT token')
        }
    }

    // store keystore in keystores directory
    const _date = parseInt((new Date().getTime()) / 1000);
    const keystoreName = `keystore-m_12381_3600_${index-1}_0_0-${_date}.json`
    fs.writeFileSync(__dirname + `/../keystores/${keystoreName}`, JSON.stringify(keystore));

    // ! Storing required values in STORAGE CONTRACT

    const contract_name = "SenseistakeServicesContract" + index;
    const storageDeployment = await deployments.get('SenseistakeStorage')
    const contr = await ethers.getContractFactory(
        'SenseistakeStorage'
    );
    const storageContract = await contr.attach(storageDeployment.address);

    let tx = await storageContract.setBool(
        keccak256(ethers.utils.solidityPack(["string", "address"], ["contract.exists", servicesContract.address])),
        true
    );
    if (['testnet', 'mainnet'].includes(network.config.type)) {
        await tx.wait(1);
    }

    // Register the contract's name by address
    tx = await storageContract.setString(
        keccak256(ethers.utils.solidityPack(["string", "address"], ["contract.name", servicesContract.address])),
        contract_name
    );
    if (['testnet', 'mainnet'].includes(network.config.type)) {
        await tx.wait(1);
    }

    // Register the contract's address by name
    tx = await storageContract.setAddress(
        keccak256(ethers.utils.solidityPack(["string", "string"], ["contract.address", contract_name])),
        servicesContract.address
    );
    if (['testnet', 'mainnet'].includes(network.config.type)) {
        await tx.wait(1);
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