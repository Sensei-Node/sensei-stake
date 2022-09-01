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

    const senseistakeService = await deploy("DepositContract", {
        contract: "DepositContract",
        from: deployer.address,
        args,
        log: true,
        waitConfirmations: deploymentVariables.waitConfirmations
    })

    // if (['testnet', 'mainnet'].includes(network.config.type) && process.env.ETHERSCAN_KEY) {
    //     await verify(senseistakeService.address, args)
    // }
}

module.exports.tags = ["all", "deposit_contract"]