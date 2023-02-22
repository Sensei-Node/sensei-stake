const { network } = require("hardhat");
const { deploymentVariables } = require("../helpers/variables");

module.exports = async ({
    deployments,
    upgrades,
    run
}) => {
    const { deploy, log } = deployments;
    const [deployer] = await ethers.getSigners();

    const args = [];

    const senseistakeMetadata = await deploy("SenseistakeMetadata", {
        contract: "SenseistakeMetadata",
        from: deployer.address,
        args,
        log: true,
        waitConfirmations: deploymentVariables.waitConfirmations
    })
}

module.exports.tags = ["all", "metadata", "without_dc"]