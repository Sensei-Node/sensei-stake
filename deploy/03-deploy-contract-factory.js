const { network } = require("hardhat")
const { verify } = require("../utils/verify")
const { deploymentVariables } = require("../helpers/variables");

module.exports = async ({
    deployments,
    upgrades, 
    run
}) => {
    const { deploy, log } = deployments;
    const [deployer] = await ethers.getSigners();

    const storageDeployment = await deployments.get("SenseistakeStorage")
    const args = [100_000, storageDeployment.address];

    const senseistakeFactory = await deploy("SenseistakeServicesContractFactory", {
        contract: "SenseistakeServicesContractFactory",
        from: deployer.address,
        args,
        log: true,
        waitConfirmations: deploymentVariables.waitConfirmations
    })

    //   goerli == 5 .. mainnet == 1
    if ([1, 5].includes(network.config.chainId) && process.env.ETHERSCAN_KEY) {
        await verify(senseistakeFactory.address, args)
    }
}

module.exports.tags = ["all", "factory"]