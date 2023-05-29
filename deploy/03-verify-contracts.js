const { network } = require("hardhat")
const { verify } = require("../utils/verify")
const { deploymentVariables } = require("../helpers/variables");
const sleep = (milliseconds) => {
    return new Promise(resolve => setTimeout(resolve, milliseconds))
}

module.exports = async ({
    deployments,
    upgrades,
    run
}) => {
    const serviceDeployment = await deployments.get('SenseistakeServicesContractV2')
    const erc721Deployment = await deployments.get('SenseiStakeV2')
    let ethDepositContractAddress, senseiStakeV1Address, senseistakeMetadataAddress;
    try {
        ethDepositContractAddress = await deployments.get("DepositContract");
        senseistakeMetadataAddress = await deployments.get("SenseistakeMetadata");
    } catch (err) {
        ethDepositContractAddress = deploymentVariables.depositContractAddress[network.config.chainId] ?
            { address: deploymentVariables.depositContractAddress[network.config.chainId] } : { address: '0x00000000219ab540356cBB839Cbe05303d7705Fa' }
        senseistakeMetadataAddress = deploymentVariables.senseistakeMetadataAddress[network.config.chainId] ?
            { address: deploymentVariables.senseistakeMetadataAddress[network.config.chainId] } : { address: '' }
    }
    // try {
    //     senseiStakeV1Address = await deployments.get("SenseiStake");
    // } catch (err) {
    //     senseiStakeV1Address = deploymentVariables.senseiStakeV1Address[network.config.chainId] ?
    //         { address: deploymentVariables.senseiStakeV1Address[network.config.chainId] } : { address: '0x2421A0aF8baDfAe12E1c1700E369747D3DB47B09' }
    // }
    const tName = deploymentVariables.tokenDeployed[network.config.chainId].name
    const tSymbol = deploymentVariables.tokenDeployed[network.config.chainId].symbol
    if (['testnet', 'mainnet'].includes(network.config.type) && process.env.ETHERSCAN_KEY) {
        console.log('WAITING 10 seconds')
        await sleep(10000);
        // try {
        //     const depositDeployment = await deployments.get('DepositContract')
        //     await verify(depositDeployment.address, [])
        // } catch { }
        // // verify metadata
        // try {
        //     await verify(senseistakeMetadataAddress.address, [])
        // } catch { }
        // verify service contract
        await verify(serviceDeployment.address, [])
        // verify erc721 contract
        await verify(erc721Deployment.address, [
            "SenseiStake Ethereum Validator",
            "SSEV",
            100_000,
            tName,
            tSymbol,
            deploymentVariables.gnoContractAddress[network.config.chainId]
        ])
    }
}

module.exports.tags = ["verify"]