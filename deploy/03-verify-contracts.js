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
    let depositDeployment;
    try {
        depositDeployment = await deployments.get('DepositContract')
    } catch {}
    const serviceDeployment = await deployments.get('SenseistakeServicesContract')
    const erc721Deployment = await deployments.get('SenseiStake')
    let ethDepositContractAddress;
    if (!depositDeployment) {
        ethDepositContractAddress = deploymentVariables.depositContractAddress[network.config.chainId] ? 
        { address: deploymentVariables.depositContractAddress[network.config.chainId] } : { address: '0x00000000219ab540356cBB839Cbe05303d7705Fa' }
    }
    if (['testnet', 'mainnet'].includes(network.config.type) && process.env.ETHERSCAN_KEY) {
        console.log('WAITING 10 seconds')
        await sleep(10000);
        if (depositDeployment) {
            // verify deposit contract
            await verify(depositDeployment.address, [])
        }
        // verify service contract
        await verify(serviceDeployment.address, [ethDepositContractAddress.address])
        // verify erc721 contract
        await verify(erc721Deployment.address, ["SenseiStake Ethereum Validator", "SSEV", 100_000, ethDepositContractAddress.address])
    }
}

module.exports.tags = ["all", "verify", "without_dc"]