const { network } = require("hardhat");
const { Keystore } = require('@chainsafe/bls-keystore');
const { randomBytes } = require('crypto');
const axios = require('axios');
const { BigNumber, utils } = ethers;
const { deploymentVariables } = require("../helpers/variables");
const { keccak256 } = utils;
const strapi_url = process.env.STRAPI_URL;
const strapi_path = '/service-contracts'

module.exports = async ({
    deployments,
    upgrades, 
    run
}) => {
   
    const { deploy, log, save } = deployments;
    const [deployer] = await ethers.getSigners();

    const factoryDeployment = await deployments.get("SenseistakeServicesContractFactory");
    const tokenDeployment = await deployments.get("SenseistakeERC721");

    const lib = await import('../lib/senseistake-services-contract.mjs');
    ({
        bls,
        createOperatorCommitment,
        createOperatorDepositData,
        saltBytesToContractAddress
    } = lib);

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
        console.log(`\n\n\n --- UTILIZA DEPOSIT CONTRACT PROPIO: ${ethDepositContractAddress.address} --- \n\n\n`);
    } catch(err) {
        console.log('\n\n\n --- NO UTILIZA DEPOSIT CONTRACT PROPIO, USA EL DE LA RED --- \n\n\n');
        ethDepositContractAddress = deploymentVariables.depositContractAddress[network.config.chainId] ? 
        { address: deploymentVariables.depositContractAddress[network.config.chainId] } : { address: '0x00000000219ab540356cBB839Cbe05303d7705Fa' }
    }
    await servicesContract.setEthDepositContractAddress(ethDepositContractAddress.address);
    // TODO: test if a later call to this function does a revert (because of the immutable keyword)

    // save it for other deployments usage
    // const artifact = await deployments.getExtendedArtifact('SenseistakeServicesContract');
    // let proxyDeployments = {
    //     address: servicesContract.address,
    //     ...artifact
    // }

    if (['testnet', 'mainnet'].includes(network.config.type)) {
        if (jwt) {
            const _date = parseInt((new Date().getTime()) / 1000);
            const keystoreName = `keystore-m_12381_3600_0_0_0-${_date}.json`
            try {
                await axios.post(strapi_url+strapi_path, {
                    validatorPubKey: utils.hexlify(depositData.validatorPubKey),
                    depositSignature: utils.hexlify(depositData.depositSignature),
                    depositDataRoot: utils.hexlify(depositData.depositDataRoot),
                    exitDate: utils.hexlify(exitDate),
                    keystore,
                    keystoreName,
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

    // Storage saving
    const index = ((await deployments.get("SSLastIndex")).address) + 1;
    console.log("INDEX TO DEPLOY", index);
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

    await save('SSLastIndex', { address: index })
}

module.exports.tags = ["single-service-contract"]