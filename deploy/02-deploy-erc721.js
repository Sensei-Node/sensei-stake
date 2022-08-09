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
    const args = ["SenseiStakeValidator", "SNSV"];
    const senseistakeERC721 = await deploy("SenseistakeERC721", {
        contract: "SenseistakeERC721",
        from: deployer.address,
        args,
        log: true,
        waitConfirmations: deploymentVariables.waitConfirmations
    })

    // if (['testnet', 'mainnet'].includes(network.config.type) && process.env.ETHERSCAN_KEY) {
    //     await verify(senseistakeERC721.address, args)
    // }
}

module.exports.tags = ["all", "erc721"]