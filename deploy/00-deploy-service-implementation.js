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

    const args = [ethers.constants.AddressZero];

    const senseistakeService = await deploy("SenseistakeServicesContract", {
        contract: "SenseistakeServicesContract",
        from: deployer.address,
        args,
        log: true,
        waitConfirmations: deploymentVariables.waitConfirmations
    })

    if (['testnet', 'mainnet'].includes(network.config.type) && process.env.ETHERSCAN_KEY) {
        await sleep(10); // esto porque etherscan tarda en detectar bytecode a veces
        await verify(senseistakeService.address, args)
    }
}

module.exports.tags = ["all", "service_implementation"]