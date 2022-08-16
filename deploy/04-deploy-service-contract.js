const { network } = require("hardhat");
const { Keystore } = require('@chainsafe/bls-keystore');
const { randomBytes } = require('crypto');
const axios = require('axios');
const { BigNumber, utils } = ethers;
const { deploymentVariables } = require("../helpers/variables");
const strapi_url = process.env.STRAPI_URL;
const strapi_path = '/service-contracts'

module.exports = async ({
    deployments,
    upgrades, 
    run
}) => {
    const { deploy, log, save } = deployments;
    const [deployer] = await ethers.getSigners();

    const serviceContractDeploys = deploymentVariables.servicesToDeploy;

    const factoryDeployment = await deployments.get("SenseistakeServicesContractFactory");
    const tokenDeployment = await deployments.get("SenseistakeERC721");
    console.log(tokenDeployment)

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

    for (let index = 1; index <= serviceContractDeploys; index++) {
        
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
            //ERC20_TOKEN_ADDRESS: tokenDeployment.address,
            FACTORY_ADDRESS: factoryDeployment.address,
            CONTRACT_IMPL_ADDRESS: await factoryContract.getServicesContractImpl()
        }
        const contractAddress = saltBytesToContractAddress(saltBytes, NNETWK);

        const depositData = createOperatorDepositData(
            operatorPrivKey, contractAddress);

        // 3 hours from now
        const exitDate = BigNumber.from(parseInt((new Date().getTime() + 6000000000) / 1000));
        console.log('exit date', exitDate.toString())

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

        console.log("\n-- Validator (operator) deposit data --")
        // console.log("\n** Validator PRIVATE key: ", utils.hexlify(operatorPrivKey.toBytes()), "**\n");
        console.log("Validator public address: ", utils.hexlify(depositData.validatorPubKey));
        console.log("Validator deposit signature: ", utils.hexlify(depositData.depositSignature));
        console.log("Validator deposit data root: ", utils.hexlify(depositData.depositDataRoot));
        console.log("Exit date: ", utils.hexlify(exitDate));
        console.log("-- EOF --\n")

        console.log("\n-- Validator (operator) keystore --")
        console.log(JSON.stringify(keystore));
        console.log("-- EOF --\n")

        // Setting the ERC20 address in the service contract
        const SenseistakeServicesContract = await ethers.getContractFactory(
            'SenseistakeServicesContract'
        );
        const servicesContract = await SenseistakeServicesContract.attach(contractAddress);
        await servicesContract.setTokenContractAddress(tokenDeployment.address);

        // parametrizing the ethereum deposit contract address
        const ethDepositContractAddress = deploymentVariables.depositContractAddress[network.config.chainId] ? 
        deploymentVariables.depositContractAddress[network.config.chainId] : '0x00000000219ab540356cBB839Cbe05303d7705Fa'
        await servicesContract.setEthDepositContractAddress(ethDepositContractAddress);
        // TODO: test if a later call to this function does a revert (because of the immutable keyword)

        // Allow owner.address in allowance mapping
        // TODO : creo que esto ya no se necesita
        // const SenseistakeERC721 = await ethers.getContractFactory(
        //     'SenseistakeERC721'
        // );
        // ERC721 = await SenseistakeERC721.attach(tokenDeployment.address);
        // await ERC721.allowServiceContract(servicesContract.address);

        // save it for other deployments usage
        const artifact = await deployments.getExtendedArtifact('SenseistakeServicesContract');
        let proxyDeployments = {
            address: servicesContract.address,
            ...artifact
        }

        // if (['testnet', 'mainnet'].includes(network.config.type) && process.env.ETHERSCAN_KEY) {
        //     await verify(NNETWK.CONTRACT_IMPL_ADDRESS, args)
        // }
        if (jwt) {
            try {
                await axios.post(strapi_url+strapi_path, {
                    validatorPubKey: utils.hexlify(depositData.validatorPubKey),
                    depositSignature: utils.hexlify(depositData.depositSignature),
                    depositDataRoot: utils.hexlify(depositData.depositDataRoot),
                    exitDate: utils.hexlify(exitDate),
                    keystore,
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

        await save('SenseistakeServicesContract'+index, proxyDeployments);
        await save('ServiceContractSalt'+index, {address: `0x${saltBytes.toString("hex")}`});
    }
}

module.exports.tags = ["all", "service-contract"]