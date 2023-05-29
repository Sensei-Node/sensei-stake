const { network } = require("hardhat");
const { deploymentVariables } = require("../helpers/variables");

module.exports = async ({
    deployments,
}) => {
    const { deploy, log } = deployments;
    const [deployer] = await ethers.getSigners();

    // deposit contract address
    let ethDepositContractAddress, senseistakeMetadataAddress;
    try {
        ethDepositContractAddress = await deployments.get("DepositContract");
        // console.log(`\n --- UTILIZA DEPOSIT CONTRACT PROPIO: ${ethDepositContractAddress.address} --- \n`);
    } catch (err) {
        // console.log('\n --- NO UTILIZA DEPOSIT CONTRACT PROPIO, USA EL DE LA RED --- \n');
        ethDepositContractAddress = deploymentVariables.depositContractAddress[network.config.chainId] ?
            { address: deploymentVariables.depositContractAddress[network.config.chainId] } : { address: '0x00000000219ab540356cBB839Cbe05303d7705Fa' }
    }
    try {
        senseistakeMetadataAddress = await deployments.get("SenseistakeMetadata");
        // console.log(`\n --- UTILIZA DEPOSIT CONTRACT PROPIO: ${ethDepositContractAddress.address} --- \n`);
    } catch (err) {
        // console.log('\n --- NO UTILIZA DEPOSIT CONTRACT PROPIO, USA EL DE LA RED --- \n');
        senseistakeMetadataAddress = deploymentVariables.senseistakeMetadataAddress[network.config.chainId] ?
            { address: deploymentVariables.senseistakeMetadataAddress[network.config.chainId] } : { address: '' }
    }

    // name, symbol, commissionRate
    const tName = deploymentVariables.tokenDeployed[network.config.chainId].name
    const tSymbol = deploymentVariables.tokenDeployed[network.config.chainId].symbol
    const args = [
        tName,
        tSymbol,
        100_000,
        ethDepositContractAddress.address,
        senseistakeMetadataAddress.address,
        deploymentVariables.gnoContractAddress[network.config.chainId]
    ];
    const senseistakeERC721 = await deploy("SenseiStakeV2", {
        contract: "SenseiStakeV2",
        from: deployer.address,
        args,
        log: true,
        waitConfirmations: deploymentVariables.waitConfirmations
    })
}

module.exports.tags = ["all", "erc721", "without_dc"]