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
    const args = [];
    const senseistakeStorage = await deploy("SenseistakeStorage", {
        contract: "SenseistakeStorage",
        from: deployer.address,
        args,
        log: true,
        waitConfirmations: deploymentVariables.waitConfirmations
    })

    //   goerli == 5 .. mainnet == 1
    if ([1, 5].includes(network.config.chainId) && process.env.ETHERSCAN_KEY) {
        await verify(senseistakeStorage.address, args)
    }
}

module.exports.tags = ["all", "storage"]