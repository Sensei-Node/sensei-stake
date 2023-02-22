const { network } = require("hardhat");
const { deploymentVariables } = require("../helpers/variables");

module.exports = async ({
    deployments,
}) => {
    const { deploy, log } = deployments;
    const [deployer] = await ethers.getSigners();

    // deposit contract address
    let ethDepositContractAddress, senseiStakeV1Address, senseistakeMetadataAddress;
    try {
        ethDepositContractAddress = await deployments.get("DepositContract");
        senseiStakeV1Address = await deployments.get("SenseiStake");
        senseistakeMetadataAddress = await deployments.get("SenseistakeMetadata");
        // console.log(`\n --- UTILIZA DEPOSIT CONTRACT PROPIO: ${ethDepositContractAddress.address} --- \n`);
    } catch (err) {
        // console.log('\n --- NO UTILIZA DEPOSIT CONTRACT PROPIO, USA EL DE LA RED --- \n');
        ethDepositContractAddress = deploymentVariables.depositContractAddress[network.config.chainId] ?
            { address: deploymentVariables.depositContractAddress[network.config.chainId] } : { address: '0x00000000219ab540356cBB839Cbe05303d7705Fa' }
        senseiStakeV1Address = deploymentVariables.senseiStakeV1Address[network.config.chainId] ?
            { address: deploymentVariables.senseiStakeV1Address[network.config.chainId] } : { address: '0x2421A0aF8baDfAe12E1c1700E369747D3DB47B09' }
        senseistakeMetadataAddress = deploymentVariables.senseistakeMetadataAddress[network.config.chainId] ?
            { address: deploymentVariables.senseistakeMetadataAddress[network.config.chainId] } : { address: '' }
    }

    // name, symbol, commissionRate
    const args = [
        "SenseiStake Ethereum Validator",
        "SSEV",
        100_000,
        ethDepositContractAddress.address,
        senseiStakeV1Address.address,
        senseistakeMetadataAddress.address
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