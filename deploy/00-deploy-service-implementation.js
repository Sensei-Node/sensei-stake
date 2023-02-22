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

    const senseistakeService = await deploy("SenseistakeServicesContractV2", {
        contract: "SenseistakeServicesContractV2",
        from: deployer.address,
        args,
        log: true,
        waitConfirmations: deploymentVariables.waitConfirmations
    })
}

module.exports.tags = ["all", "service_implementation", "without_dc"]