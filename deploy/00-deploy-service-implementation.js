const { network } = require("hardhat");
const { deploymentVariables } = require("../helpers/variables");

module.exports = async ({
    deployments,
    upgrades, 
    run
}) => {
    const { deploy, log } = deployments;
    const [deployer] = await ethers.getSigners();

    let ethDepositContractAddress;
    try {
        ethDepositContractAddress = await deployments.get("DepositContract");
    } catch(err) {
        ethDepositContractAddress = deploymentVariables.depositContractAddress[network.config.chainId] ? 
        { address: deploymentVariables.depositContractAddress[network.config.chainId] } : { address: '0x00000000219ab540356cBB839Cbe05303d7705Fa' }
    }

    const args = [];

    const senseistakeService = await deploy("SenseistakeServicesContract", {
        contract: "SenseistakeServicesContract",
        from: deployer.address,
        args,
        log: true,
        waitConfirmations: deploymentVariables.waitConfirmations
    })
}

module.exports.tags = ["all", "service_implementation", "without_dc"]