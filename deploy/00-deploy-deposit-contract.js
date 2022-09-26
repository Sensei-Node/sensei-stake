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

    const senseistakeDepositContract = await deploy("DepositContract", {
        contract: "DepositContract",
        from: deployer.address,
        args,
        log: true,
        waitConfirmations: deploymentVariables.waitConfirmations
    })

    const DepositContract = await ethers.getContractFactory(
        'DepositContract'
    );
    const depositDeployment = await deployments.get("DepositContract");
    const depositContract = await DepositContract.attach(depositDeployment.address);

    let whitelisted = process.env.WHITELISTED
    if (whitelisted) {
        whitelisted = whitelisted.split(',')
        if (whitelisted.length != 0) {
            for (const addr of whitelisted) {
                const witl = await depositContract.whitelist(addr)
                if (['testnet', 'mainnet'].includes(network.config.type)) {
                    await witl.wait(deploymentVariables.waitConfirmations)
                }
            }
        }
    }


}

module.exports.tags = ["all", "deposit_contract"]