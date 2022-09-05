const { network } = require("hardhat");
const { Keystore } = require('@chainsafe/bls-keystore');
const { randomBytes } = require('crypto');
const axios = require('axios');
const { BigNumber, utils } = ethers;
const { deploymentVariables } = require("../helpers/variables");
const strapi_url = process.env.STRAPI_URL;
const strapi_path = '/service-contracts'

async function main() {
    console.log("Running deploy service contract")

    const [deployer] = await ethers.getSigners();

    const serviceContractDeploys = 1;//deploymentVariables.servicesToDeploy;
    let factoryAddress = (await axios.get(strapi_url+'/contract-factory', {})).data.address;
    const nftAddress = (await axios.get(strapi_url+'/erc-721', {})).data.address;

    console.log(factoryAddress, nftAddress)
    
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

        const FactoryContract = await ethers.getContractFactory('SenseistakeServicesContractFactory');
        const factoryContract = await FactoryContract.attach(factoryAddress);


        const NNETWK = {
            FACTORY_ADDRESS: factoryAddress,
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
        await servicesContract.setTokenContractAddress(nftAddress);

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
        const artifact = await deployments.getExtendedArtifact('SenseistakeServicesContract');
        let proxyDeployments = {
            address: servicesContract.address,
            ...artifact
        }

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

        console.log('SenseistakeServicesContract')
    }
}

// Deploy with hardhat
main();
  