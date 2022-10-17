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
    const { deploy, log } = deployments;
    const [deployer] = await ethers.getSigners();
    
    const erc721Deployment = await deployments.get('SenseiStake')

    const args = [erc721Deployment.address];

    const extSenseiStake = await deploy("ExtSenseiStake", {
        contract: "ExtSenseiStake",
        from: deployer.address,
        args,
        log: true,
        waitConfirmations: deploymentVariables.waitConfirmations
    })

    if (['testnet', 'mainnet'].includes(network.config.type) && process.env.ETHERSCAN_KEY) {
        console.log('WAITING 10 seconds')
        await sleep(10000);
        const deployment = await deployments.get('ExtSenseiStake')
        await verify(deployment.address, args)
    }
}

module.exports.tags = ["all", "extSenseiStake"]