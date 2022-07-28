const { network } = require("hardhat")
const { verify } = require("../utils/verify")

module.exports = async ({
    deployments,
    upgrades, 
    run
}) => {
    const { deploy, log, save } = deployments;
    const [deployer] = await ethers.getSigners();
    const storageDeployment = await deployments.get("SenseistakeStorage")
    const tokenContract = await ethers.getContractFactory("SenseistakeERC20Wrapper")
    const args = ["SenseiNodeETH", "snETH", deployer.address, storageDeployment.address]
    const senseistakeToken = await upgrades.deployProxy(tokenContract, args);
    // log out things
    log("Token name", await senseistakeToken.name())
    log("Operator address", await senseistakeToken.getOperatorAddress())
    log("SenseistakeERC20Wrapper address:", senseistakeToken.address);
    // save it for other deployments usage
    const artifact = await deployments.getExtendedArtifact('SenseistakeERC20Wrapper');
    let proxyDeployments = {
        address: senseistakeToken.address,
        ...artifact
    }
    await save('SenseistakeERC20Wrapper', proxyDeployments);

    // if (['testnet', 'mainnet'].includes(network.config.type) && process.env.ETHERSCAN_KEY) {
    //     await verify(senseistakeToken.address, args)
    // }
}

module.exports.tags = ["all", "erc20"]