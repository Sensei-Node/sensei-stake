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
    let ethDepositContractAddress, senseistakeMetadataAddress;
    try {
        ethDepositContractAddress = await deployments.get("DepositContract");
    } catch (err) {
        ethDepositContractAddress = deploymentVariables.depositContractAddress[network.config.chainId] ?
            { address: deploymentVariables.depositContractAddress[network.config.chainId] } : { address: '0x00000000219ab540356cBB839Cbe05303d7705Fa' }
    }
    try {
        senseistakeMetadataAddress = await deployments.get("SenseistakeMetadata");
    } catch (err) {
        senseistakeMetadataAddress = deploymentVariables.senseistakeMetadataAddress[network.config.chainId] ?
            { address: deploymentVariables.senseistakeMetadataAddress[network.config.chainId] } : { address: '' }
    }
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
        try {
            await verify(senseistakeMetadataAddress.address, [])
        } catch { }
        // verify service contract
        try {
            await verify(serviceDeployment.address, [])
        } catch { }
        // verify erc721 contract
        try {
            await verify(erc721Deployment.address, [
                tName,
                tSymbol,
                100_000,
                ethDepositContractAddress.address,
                senseistakeMetadataAddress.address,
                deploymentVariables.gnoContractAddress[network.config.chainId]
            ])
        } catch { }
    }
}

module.exports.tags = ["verify"]